"""Repository functions for querying patients.

Part of the data-access layer described in `app.repositories.__init__`:
these are typed, parameterized, reusable query functions, not
route-specific helpers. Routers call them, and the same functions are
intended to be callable directly by a future AI/natural-language-query
service as "tools" over the data.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.schemas.patient import (
    AppointmentDetail,
    AppointmentServiceItem,
    CalendarAppointmentPreview,
    CalendarDayCount,
    CalendarMonthResponse,
    PatientDetail,
    PatientDetailResponse,
    PatientListItem,
    PatientListResponse,
    PaymentSummary,
    RebookingOpportunitiesItem,
    RebookingOpportunitiesResponse,
    TodaysAppointmentItem,
    TodaysAppointmentsResponse,
    UpcomingAppointmentsResponse,
    UpcomingPatientItem,
)
from app.schemas.patient_filters import ENUM_VALUES, FIELD_TYPES, OPERATORS_BY_TYPE, PatientFilterCondition


def _years_before(from_date: date, years: int) -> date:
    """Returns the date exactly `years` before `from_date`, handling the Feb 29 edge case."""
    try:
        return from_date.replace(year=from_date.year - years)
    except ValueError:
        # from_date is Feb 29 and (from_date.year - years) isn't a leap year.
        return from_date.replace(year=from_date.year - years, day=28)


@dataclass
class PatientFilters:
    """Optional filters for `list_patients`.

    `search` matches (case-insensitively) against patient name (anywhere) or
    phone (anywhere) always; it additionally matches email (from the start
    of the address only) but ONLY when the term contains "@" -- see
    `list_patients` for why a plain name-shaped term matching against email
    produced false-positive results in this dataset even after anchoring.
    It stays its own dedicated top-level field (not folded into `filters`
    below) since it's a fast, single quick-search box, not a structured
    per-column condition.

    `filters` is the generic, per-column-type filter list -- see
    `app.schemas.patient_filters` for the field/operator registry and
    `_apply_generic_filters` for how each one becomes a WHERE clause. All
    fields are optional; an empty `filters` list (the default) applies no
    conditions.
    """

    search: str | None = None
    filters: list[PatientFilterCondition] = field(default_factory=list)


@dataclass
class PatientListContext:
    """Which source list a Patient Detail page was navigated *from*, and that list's own
    current filter/sort/scope -- so `get_patient_detail`'s Previous/Next buttons walk the
    same order the agent was actually looking at (the Rebooking worklist, a
    filtered/sorted All Patients view), not always one fixed global order.

    `kind="all"` with the dataclass's own defaults (no filters, `sort=None`) reproduces
    exactly the old fixed global `(last_name, first_name, id)` order -- so a direct link,
    a global-search result, or any other entry point with no real list context at all can
    simply omit this argument and still get sane, deterministic behavior. An unrecognized
    `kind` value falls back the same way, in `get_patient_detail` below.

    `sort`/`sort_dir` default to `None`, not a literal value, because the SENSIBLE
    default differs by `kind` -- "all" defaults to name-sorted, "rebooking" to
    most-recent-visit-first -- and `get_patient_detail` is what actually knows which
    kind it's resolving for; resolving `None` -> the right per-kind default there (not
    here) is what keeps a rebooking link with no explicit sort still landing on its own
    natural order instead of silently inheriting "all"'s.

    There used to be `kind="today"`/`"day"` variants too, for Today's Appointments and
    the Calendar day drill-down. Those schedules are one row per scheduled *service*, not
    per patient (a patient can have more than one service the same day) -- per client
    feedback, clicking a schedule row now goes to a dedicated Appointment Detail page
    (`app.repositories.appointments.get_appointment_detail`) instead of this generic,
    all-history Patient Detail page, so nothing constructs those two kinds here anymore.
    """

    kind: str = "all"
    filters: PatientFilters = field(default_factory=PatientFilters)
    sort: str | None = None
    sort_dir: str | None = None


def _payment_totals_subquery():
    """Each patient's lifetime spend in cents, summing only *paid* payments -- cancelled/
    pending/failed payments never count toward it. Shared by `list_patients` (the Patient
    Table's own total-spent column/sort) and `_neighbors_in_all_patients` (Prev/Next when
    that same sort is active), so both always agree on exactly the same figure.
    """
    return (
        select(Payment.patient_id, func.sum(Payment.amount).label("total_spent_cents"))
        .where(Payment.status == "paid")
        .group_by(Payment.patient_id)
        .subquery()
    )


def _last_appointment_subquery():
    """Each patient's most recent *scheduled visit time* (AppointmentService.start, not
    Appointment.created_date -- see list_patients). Shared the same way as
    `_payment_totals_subquery`, for the "last_appointment_date" sort/filter.
    """
    return (
        select(Appointment.patient_id, func.max(AppointmentService.start).label("last_appointment_date"))
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .group_by(Appointment.patient_id)
        .subquery()
    )


def _appointment_counts_subquery():
    """Each patient's total appointment count. Factored out (rather than inlined only in
    `list_patients`, as it originally was) now that `appointment_count` is also a
    sort/filter key -- `_neighbors_in_all_patients` needs the identical subquery to keep
    Prev/Next in agreement with the table whenever that sort/filter is active.
    """
    return (
        select(Appointment.patient_id, func.count(Appointment.id).label("appointment_count"))
        .group_by(Appointment.patient_id)
        .subquery()
    )


def _validate_filter_condition(condition: PatientFilterCondition) -> None:
    """Checks a filter condition against the field/operator registry in
    `app.schemas.patient_filters` -- raises `ValueError` (the router turns this into a
    400) for an unknown field, an operator that doesn't apply to that field's type, or an
    enum value outside that field's known set. `PatientFilterCondition` itself already
    validated the value/value2/values *shape* matches the operator; this is the second
    pass that needs the field registry, which only this module (the query-building code)
    and the router both need -- kept here, not duplicated in the router, so "is this
    filter valid" is answered exactly once.
    """
    field_type = FIELD_TYPES.get(condition.field)
    if field_type is None:
        raise ValueError(f"Unknown filter field: {condition.field!r}")
    if condition.operator not in OPERATORS_BY_TYPE[field_type]:
        raise ValueError(f"Operator {condition.operator!r} is not valid for field {condition.field!r} (type {field_type})")
    if field_type == "enum":
        known = ENUM_VALUES[condition.field]
        bad_values = [v for v in (condition.values or ([condition.value] if condition.value else [])) if v not in known]
        if bad_values:
            raise ValueError(f"Unknown value(s) {bad_values} for field {condition.field!r}")


def _text_condition_clause(expr, condition: PatientFilterCondition):
    """Builds the WHERE clause for a `text`-typed field (`name`, `email`) -- always
    case-insensitive, matching this app's existing search behavior.
    """
    value = (condition.value or "").lower()
    lowered = func.lower(expr)
    if condition.operator == "contains":
        return lowered.like(f"%{value}%")
    if condition.operator == "not_contains":
        return ~lowered.like(f"%{value}%")
    if condition.operator == "equals":
        return lowered == value
    return lowered != value  # not_equals


def _enum_condition_clause(column, condition: PatientFilterCondition):
    """Builds the WHERE clause for an `enum`-typed field (`gender`, `source`)."""
    if condition.operator == "is":
        return column == condition.value
    if condition.operator == "is_not":
        return column != condition.value
    if condition.operator == "is_any_of":
        return column.in_(condition.values or [])
    return column.notin_(condition.values or [])  # is_none_of


def _number_condition_clause(column, condition: PatientFilterCondition):
    """Builds the WHERE clause for a `number`-typed field (`age` is handled separately by
    `_age_condition_clause`, since it needs a date-of-birth translation, not a plain
    numeric comparison -- this is for the two aggregate-column fields,
    `appointment_count`/`total_spent_cents`).
    """
    if condition.operator == "between":
        v1, v2 = float(condition.value), float(condition.value2)
        return column.between(min(v1, v2), max(v1, v2))
    value = float(condition.value)
    return {
        "eq": column == value, "ne": column != value,
        "gt": column > value, "gte": column >= value,
        "lt": column < value, "lte": column <= value,
    }[condition.operator]


def _date_condition_clause(column, condition: PatientFilterCondition):
    """Builds the WHERE clause for a `date`-typed field (`created_date`,
    `last_appointment_date`), both of which are actually full `datetime` columns --
    every comparison here is whole-day (e.g. "on" means anywhere in that day, "before"
    means any time on an earlier day), the same `< upper_bound + 1 day` shape this app's
    existing `created_from`/`created_to` filter already used, just generalized to every
    operator instead of only a from/to pair.
    """
    def day(v: str) -> date:
        return date.fromisoformat(v)

    if condition.operator == "between":
        lo, hi = sorted([day(condition.value), day(condition.value2)])
        return and_(column >= lo, column < hi + timedelta(days=1))
    d = day(condition.value)
    if condition.operator == "on":
        return and_(column >= d, column < d + timedelta(days=1))
    if condition.operator == "not_on":
        return ~and_(column >= d, column < d + timedelta(days=1))
    if condition.operator == "before":
        return column < d
    if condition.operator == "after":
        return column >= d + timedelta(days=1)
    if condition.operator == "on_or_before":
        return column < d + timedelta(days=1)
    return column >= d  # on_or_after


def _age_condition_clause(condition: PatientFilterCondition):
    """Builds the WHERE clause for the `age` field -- age isn't a real column (it's
    computed from `date_of_birth` as of today), so every operator translates into a
    `date_of_birth` comparison. `_at_least`/`_at_most` reuse the exact inclusive-boundary
    math this app's original `age_min`/`age_max` filter already used and had a dedicated
    boundary test for (see `test_list_patients_filters_by_age_range_inclusive_at_both_boundaries`)
    -- every other operator is expressed in terms of those same two building blocks, so
    a single already-correct boundary calculation backs all seven operators instead of
    each reimplementing its own (and risking its own off-by-one).
    """
    today = date.today()

    def at_least(n: int):  # age >= n, inclusive
        cutoff = _years_before(today, n)
        return Patient.date_of_birth < cutoff + timedelta(days=1)

    def at_most(n: int):  # age <= n, inclusive
        cutoff = _years_before(today, n + 1)
        return Patient.date_of_birth >= cutoff + timedelta(days=1)

    if condition.operator == "between":
        lo, hi = sorted([int(condition.value), int(condition.value2)])
        return and_(at_least(lo), at_most(hi))
    n = int(condition.value)
    if condition.operator == "eq":
        return and_(at_least(n), at_most(n))
    if condition.operator == "ne":
        return ~and_(at_least(n), at_most(n))
    if condition.operator == "gt":
        return at_least(n + 1)
    if condition.operator == "gte":
        return at_least(n)
    if condition.operator == "lt":
        return at_most(n - 1)
    return at_most(n)  # lte


def _apply_generic_filters(query, conditions: list[PatientFilterCondition], payment_totals_sq, appointment_counts_sq, last_appointment_sq):
    """Applies every generic `{field, operator, value}` condition to `query` as a WHERE
    clause -- the per-column-type dispatch that replaces the old fixed named-field
    filters. `payment_totals_sq`/`appointment_counts_sq`/`last_appointment_sq` must
    already be joined onto `query` (both callers do this before calling here), since
    `total_spent_cents`/`appointment_count`/`last_appointment_date` filter on those
    aggregates rather than a plain `Patient` column.
    """
    for condition in conditions:
        _validate_filter_condition(condition)
        if condition.field == "name":
            query = query.where(_text_condition_clause(Patient.first_name + " " + Patient.last_name, condition))
        elif condition.field == "email":
            query = query.where(_text_condition_clause(Patient.email, condition))
        elif condition.field == "age":
            query = query.where(_age_condition_clause(condition))
        elif condition.field == "gender":
            query = query.where(_enum_condition_clause(Patient.gender, condition))
        elif condition.field == "source":
            query = query.where(_enum_condition_clause(Patient.source, condition))
        elif condition.field == "created_date":
            query = query.where(_date_condition_clause(Patient.created_date, condition))
        elif condition.field == "appointment_count":
            # A patient with zero appointments has NULL here (outer join) -- must count
            # as 0, not be silently excluded from e.g. an "appointment_count = 0" filter.
            query = query.where(_number_condition_clause(func.coalesce(appointment_counts_sq.c.appointment_count, 0), condition))
        elif condition.field == "total_spent_cents":
            # Same NULL-as-0 reasoning as appointment_count above.
            query = query.where(_number_condition_clause(func.coalesce(payment_totals_sq.c.total_spent_cents, 0), condition))
        elif condition.field == "last_appointment_date":
            query = query.where(_date_condition_clause(last_appointment_sq.c.last_appointment_date, condition))
    return query


def _apply_patient_filters(query, filters: PatientFilters, payment_totals_sq, appointment_counts_sq, last_appointment_sq):
    """Applies `filters.search` plus every generic filter condition to `query` -- factored
    out so `_neighbors_in_all_patients` (Prev/Next) filters candidates identically to
    however the Patient Table itself is currently filtered, and the two can never
    silently drift apart.
    """
    if filters.search:
        term = filters.search.lower()
        name_or_phone_match = (
            # Name matching is a genuine "contains anywhere" fuzzy search --
            # a substring of someone's real name is meaningfully related to
            # them, so matching it anywhere in "first last" is correct.
            func.lower(Patient.first_name + " " + Patient.last_name).like(f"%{term}%")
            | Patient.phone.like(f"%{filters.search}%")
        )
        # See list_patients's historical docstring/comments for why email matching is
        # restricted to search terms that look like an email address, anchored to the
        # start of the address only.
        if "@" in filters.search:
            query = query.where(name_or_phone_match | func.lower(Patient.email).like(f"{term}%"))
        else:
            query = query.where(name_or_phone_match)
    query = _apply_generic_filters(query, filters.filters, payment_totals_sq, appointment_counts_sq, last_appointment_sq)
    return query


def _patient_sort_expressions(sort: str, direction: str, payment_totals_sq, appointment_counts_sq, last_appointment_sq) -> tuple:
    """Maps a `(sort, direction)` pair to its ORDER BY expression(s), always ending in
    `Patient.id` as a final tiebreaker. Without it, patients sharing a sort value (same
    last name, same total spent, etc.) had no guaranteed stable order -- risking
    pagination that skips or repeats rows across pages, and a Prev/Next window ranking
    that could disagree with what the table itself actually displays. Shared by
    `list_patients` and `_neighbors_in_all_patients` so they always agree.

    `direction` ("asc"/"desc") is a genuine per-request choice now (this used to bake a
    fixed direction into each named sort option, e.g. "newest first" always meaning
    `created_date.desc()` with no ascending equivalent) -- needed once column-header
    click-to-sort replaced the old fixed dropdown, since every column has to support
    both directions the same way a spreadsheet column header does.

    `age` is the one field where the sort direction doesn't just forward onto its
    backing column's own direction: age counts UP as `date_of_birth` counts DOWN (an
    older person has an EARLIER birth date), so "youngest first" (age ascending) is
    `date_of_birth.desc()`, not `.asc()` -- every other field's direction maps straight
    onto its own column/expression.
    """
    is_desc = direction == "desc"

    def d(expr):
        return expr.desc() if is_desc else expr.asc()

    if sort == "email":
        exprs = (d(Patient.email),)
    elif sort == "age":
        exprs = (Patient.date_of_birth.asc() if is_desc else Patient.date_of_birth.desc(),)
    elif sort == "gender":
        exprs = (d(Patient.gender),)
    elif sort == "source":
        exprs = (d(Patient.source),)
    elif sort == "created_date":
        exprs = (d(Patient.created_date),)
    elif sort == "appointment_count":
        exprs = (d(func.coalesce(appointment_counts_sq.c.appointment_count, 0)),)
    elif sort == "total_spent_cents":
        exprs = (d(func.coalesce(payment_totals_sq.c.total_spent_cents, 0)),)
    elif sort == "last_appointment_date":
        exprs = (d(last_appointment_sq.c.last_appointment_date),)
    else:  # "name", and the fallback for an unrecognized sort key
        exprs = (d(Patient.last_name), d(Patient.first_name))
    return exprs + (Patient.id.asc(),)


async def list_patients(
    db: AsyncSession,
    filters: PatientFilters,
    sort: str = "name",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 25,
) -> PatientListResponse:
    """Return a paginated, filtered, sorted page of patients with aggregates.

    With ~4,000 patients in the dataset, filtering, sorting, and pagination
    are all done server-side in SQL (WHERE/ORDER BY/OFFSET-LIMIT) rather
    than fetching every patient and filtering in Python — this keeps the
    query efficient regardless of table size.

    Each patient row is enriched with three aggregates: appointment count,
    lifetime spend (sum of *paid* payments only, in cents), and the most
    recent appointment date. These are computed as three INDEPENDENT
    `GROUP BY` subqueries (one per child table), each outer-joined 1:1 onto
    `Patient`, rather than a single join across `Appointment` and `Payment`
    directly. This avoids join fan-out: if a patient has, say, 3
    appointments and 2 payments, a naive single join would produce 3 x 2 = 6
    joined rows, and summing `Payment.amount` across those rows would count
    each payment 3 times (over-counting revenue). Aggregating each child
    table independently first, then joining the pre-aggregated results,
    keeps the counts and sums correct.

    Returns a `PatientListResponse` containing the page of items plus
    total count (for pagination controls) and the echoed page/page_size.
    """
    appointment_counts = _appointment_counts_subquery()
    # "Last appointment" means the most recent *scheduled visit time*, which
    # lives on AppointmentService.start -- NOT Appointment.created_date
    # (when the booking record was entered into the system, an
    # administrative timestamp that can be, and often is, wildly different
    # from when the visit itself is/was scheduled). Using created_date here
    # was a real bug: it could show a "last appointment" date that has
    # nothing to do with when the patient was actually last scheduled to be
    # seen. See get_patient_detail for the same fix applied there.
    payment_totals = _payment_totals_subquery()
    last_appointment = _last_appointment_subquery()

    query = (
        select(
            Patient,
            func.coalesce(appointment_counts.c.appointment_count, 0).label("appointment_count"),
            func.coalesce(payment_totals.c.total_spent_cents, 0).label("total_spent_cents"),
            last_appointment.c.last_appointment_date,
        )
        .outerjoin(appointment_counts, appointment_counts.c.patient_id == Patient.id)
        .outerjoin(payment_totals, payment_totals.c.patient_id == Patient.id)
        .outerjoin(last_appointment, last_appointment.c.patient_id == Patient.id)
    )

    # See `_apply_patient_filters` for why email matching is restricted to
    # search terms that already look like an email address, anchored to the
    # start of the address only (this dataset's random email local-parts
    # otherwise produce false-positive matches against plain name searches).
    query = _apply_patient_filters(query, filters, payment_totals, appointment_counts, last_appointment)

    # Count matching rows (post-filter) for pagination metadata, without pulling all rows.
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    # See `_patient_sort_expressions` for why every sort ends in a
    # `Patient.id` tiebreaker -- without it, ties (e.g. two patients sharing
    # a last name) had no guaranteed stable order across pages.
    query = query.order_by(*_patient_sort_expressions(sort, sort_dir, payment_totals, appointment_counts, last_appointment))
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        PatientListItem(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.date(), gender=patient.gender,
            phone=patient.phone, email=patient.email, source=patient.source,
            created_date=patient.created_date, appointment_count=appointment_count,
            last_appointment_date=last_appt_date, total_spent_cents=total_spent_cents,
        )
        for patient, appointment_count, total_spent_cents, last_appt_date in rows
    ]

    return PatientListResponse(items=items, total=total, page=page, page_size=page_size)


async def _neighbors_in_all_patients(
    db: AsyncSession, patient_id: str, filters: PatientFilters, sort: str, sort_dir: str,
) -> tuple[str | None, str | None]:
    """Previous/Next `Patient.id` for `get_patient_detail`'s `kind="all"` context: the
    patient immediately before/after `patient_id` in the exact filtered+sorted order
    `list_patients` would display for these same `filters`/`sort`/`sort_dir`.

    Ranks every matching patient with `ROW_NUMBER() OVER (ORDER BY ...)` (using the same
    filter/sort building blocks `list_patients` itself uses, so the two can never
    disagree), finds `patient_id`'s own rank, then looks up rank-1 and rank+1. Returns
    `(None, None)` if the filters exclude `patient_id` entirely (e.g. the agent navigated
    in from an unfiltered link, then the underlying data changed) -- there's no principled
    "previous/next" for a patient that isn't actually in the list being scoped to.
    """
    payment_totals = _payment_totals_subquery()
    appointment_counts = _appointment_counts_subquery()
    last_appointment = _last_appointment_subquery()
    base = (
        select(Patient.id)
        .outerjoin(payment_totals, payment_totals.c.patient_id == Patient.id)
        .outerjoin(appointment_counts, appointment_counts.c.patient_id == Patient.id)
        .outerjoin(last_appointment, last_appointment.c.patient_id == Patient.id)
    )
    base = _apply_patient_filters(base, filters, payment_totals, appointment_counts, last_appointment)
    order_exprs = _patient_sort_expressions(sort, sort_dir, payment_totals, appointment_counts, last_appointment)
    ranked = base.add_columns(func.row_number().over(order_by=order_exprs).label("rn")).subquery()

    current_rn = (await db.execute(select(ranked.c.rn).where(ranked.c.id == patient_id))).scalar_one_or_none()
    if current_rn is None:
        return None, None
    previous_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn - 1))).scalar_one_or_none()
    next_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn + 1))).scalar_one_or_none()
    return previous_id, next_id


async def get_patient_detail(
    db: AsyncSession, patient_id: str, context: PatientListContext | None = None,
) -> PatientDetailResponse | None:
    """Return one patient's full profile plus their complete appointment history, or None if not found.

    Unlike `list_patients` (aggregate-only, computed across ~4,000 patients
    at once), this loads full detail for a single patient: every
    appointment (ordered by its actual scheduled visit date, most recent
    first -- see `AppointmentDetail.appointment_date`, NOT by when the
    booking record was created), every service performed within each one
    (with its provider and time window, via `AppointmentService`), and the
    payment tied to each appointment, if any, plus the adjacent patient ids
    for Previous/Next navigation -- see `context` (a `PatientListContext`)
    for how those neighbors are chosen. This is the data that powers the
    "click a patient row for more info" Patient Detail page — the raw
    appointment/service/provider/payment records were previously only ever
    touched in aggregate by the analytics queries, never surfaced
    per-patient.

    A payment maps to at most one appointment in the real seed data
    (verified directly against seed_data/payment.json: 5,311 payments,
    5,311 distinct appointment_ids), so `payment_by_appointment` is built
    as a plain id -> Payment dict. If that assumption were ever violated
    for a given appointment, this would silently keep only the
    last-fetched payment for it rather than erroring or listing all of
    them.
    """
    patient = (await db.execute(select(Patient).where(Patient.id == patient_id))).scalar_one_or_none()
    if patient is None:
        return None

    appointment_count = (await db.execute(
        select(func.count()).select_from(Appointment).where(Appointment.patient_id == patient_id)
    )).scalar_one()
    total_spent_cents = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.patient_id == patient_id, Payment.status == "paid")
    )).scalar_one()
    # The most recent *scheduled visit time* -- AppointmentService.start,
    # not Appointment.created_date (see list_patients for the full
    # explanation of why created_date is the wrong column here).
    last_appointment_date = (await db.execute(
        select(func.max(AppointmentService.start))
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .where(Appointment.patient_id == patient_id)
    )).scalar_one()

    # Fetched in no particular SQL order -- each appointment's actual
    # display/sort date (`appointment_date` below) depends on its services,
    # which aren't known until after this query, so the final chronological
    # ordering happens in Python once that's computed.
    appointments = (await db.execute(
        select(Appointment).where(Appointment.patient_id == patient_id)
    )).scalars().all()
    appointment_ids = [appointment.id for appointment in appointments]

    services_by_appointment: dict[str, list[AppointmentServiceItem]] = {}
    if appointment_ids:
        service_rows = (await db.execute(
            select(
                AppointmentService.appointment_id, Service.name, Provider.first_name, Provider.last_name,
                AppointmentService.start, AppointmentService.end, Service.price,
            )
            .join(Service, Service.id == AppointmentService.service_id)
            .join(Provider, Provider.id == AppointmentService.provider_id)
            .where(AppointmentService.appointment_id.in_(appointment_ids))
            .order_by(AppointmentService.start)
        )).all()
        for appt_id, service_name, provider_first, provider_last, start, end, price in service_rows:
            services_by_appointment.setdefault(appt_id, []).append(
                AppointmentServiceItem(
                    service_name=service_name, provider_name=f"{provider_first} {provider_last}",
                    start=start, end=end, price_cents=price,
                )
            )

    payment_by_appointment: dict[str, Payment] = {}
    if appointment_ids:
        payments = (await db.execute(
            select(Payment).where(Payment.appointment_id.in_(appointment_ids))
        )).scalars().all()
        payment_by_appointment = {payment.appointment_id: payment for payment in payments}

    def _appointment_date(appointment_id: str) -> datetime | None:
        """The appointment's actual scheduled visit date (earliest service start), or None
        if it has no AppointmentService rows yet -- NOT created_date, which is merely when
        the booking record was entered and can be entirely unrelated to when the visit is
        scheduled (this was a real bug: a patient's appointment could be booked in January
        for a visit the following January, and the old code showed the booking date).
        """
        services = services_by_appointment.get(appointment_id)
        return min((service.start for service in services), default=None) if services else None

    appointment_items = [
        AppointmentDetail(
            id=appointment.id, status=appointment.status,
            appointment_date=_appointment_date(appointment.id), created_date=appointment.created_date,
            services=services_by_appointment.get(appointment.id, []),
            payment=(
                PaymentSummary(
                    amount_cents=payment_by_appointment[appointment.id].amount,
                    method=payment_by_appointment[appointment.id].method,
                    status=payment_by_appointment[appointment.id].status,
                    date=payment_by_appointment[appointment.id].date,
                )
                if appointment.id in payment_by_appointment else None
            ),
        )
        for appointment in appointments
    ]
    # Most recent scheduled visit first. An appointment with no services yet
    # (appointment_date=None) has nothing to sort by chronologically, so it
    # sorts last rather than crowding out real dates at the top.
    appointment_items.sort(key=lambda item: item.appointment_date or datetime.min, reverse=True)

    # Previous/Next patient, scoped to whichever source list the agent actually
    # navigated from -- see `PatientListContext` and each `_neighbors_in_*`
    # helper below. `context` defaults to `PatientListContext()` (kind="all",
    # no filters, sort="name"), which reproduces the old fixed global
    # `(last_name, first_name, id)` order -- so a direct URL visit or a
    # global-search result (neither of which has a real list to scope to)
    # still gets sane, deterministic neighbors.
    context = context or PatientListContext()
    if context.kind == "rebooking":
        # This worklist's own natural default (most-recent-visit-first) -- see
        # `PatientListContext.sort`'s docstring for why that default lives here, not on
        # the dataclass itself (it differs from "all"'s own default just below).
        sort = context.sort or "last_appointment_date"
        sort_dir = context.sort_dir or "desc"
        previous_patient_id, next_patient_id = await _neighbors_in_rebooking(db, patient_id, sort, sort_dir)
    else:
        sort = context.sort or "name"
        sort_dir = context.sort_dir or "asc"
        previous_patient_id, next_patient_id = await _neighbors_in_all_patients(
            db, patient_id, context.filters, sort, sort_dir,
        )

    return PatientDetailResponse(
        patient=PatientDetail(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.date(), gender=patient.gender, address=patient.address,
            phone=patient.phone, email=patient.email, source=patient.source, created_date=patient.created_date,
            appointment_count=appointment_count, last_appointment_date=last_appointment_date,
            total_spent_cents=total_spent_cents,
        ),
        appointments=appointment_items,
        previous_patient_id=previous_patient_id,
        next_patient_id=next_patient_id,
    )


async def get_reference_now(db: AsyncSession) -> datetime:
    """The effective "today" for the Upcoming Appointments view.

    This seed dataset is a frozen snapshot: its latest scheduled
    appointment is already in the past relative to the real wall-clock
    date (verified directly against the data -- the last
    `AppointmentService.start` is 2026-01-24, well before the real
    current date). Anchoring "today" to `datetime.utcnow()` would make
    this view permanently, silently empty against this snapshot -- not a
    bug exactly, but a useless one.

    "Today" is instead the first of the month, for the second-to-last
    calendar month that has any scheduled appointment in the data. This
    isn't an arbitrary rule: booking volume in this dataset falls off a
    cliff exactly at that boundary (1,590 appointments in the month
    before it, ~145-150 in each of the two months after) -- the strong
    signature of this being roughly where the dataset was actually
    generated, with everything after being the sparser set of
    appointments that had already been booked ahead of that date at
    generation time. Landing "today" there, rather than on some
    in-between day, also gives a clean, human-legible anchor (the 1st of
    a month) instead of a date that drifts to something arbitrary-looking
    depending on exactly where in the data it falls. Against a live
    production database (new appointments keep getting scheduled into the
    real future), this should simply be `datetime.utcnow()`.
    """
    month_start = func.date_trunc("month", AppointmentService.start)
    latest_two_months = (await db.execute(
        select(month_start).distinct().order_by(month_start.desc()).limit(2)
    )).scalars().all()
    if not latest_two_months:
        return datetime.utcnow()
    if len(latest_two_months) == 1:
        return latest_two_months[0]  # only one month of data exists at all
    return latest_two_months[1]  # index 0 is the latest month; 1 is the one before it


def _schedule_sort_expressions(sort: str, direction: str = "asc") -> tuple:
    """Maps a schedule `(sort, direction)` pair to its ORDER BY expression(s), always
    ending in `AppointmentService.id` as a tiebreaker -- same reasoning as
    `_patient_sort_expressions`, just for schedule rows. Shared by `_list_schedule_between`
    and `app.repositories.appointments._neighbors_in_schedule` so a schedule row's
    Previous/Next always walks the exact same order the list itself is displayed in.

    `direction` ("asc"/"desc") is a genuine per-request choice, matching every other
    click-to-sort column in this app -- "time" defaults to ascending (the schedule's
    natural chronological reading order) but can be flipped the same as any other column.
    """
    is_desc = direction == "desc"

    def d(expr):
        return expr.desc() if is_desc else expr.asc()

    if sort == "patient_name":
        exprs = (d(Patient.last_name), d(Patient.first_name))
    elif sort == "provider_name":
        exprs = (d(Provider.last_name), d(Provider.first_name), AppointmentService.start.asc())
    elif sort == "service_name":
        exprs = (d(Service.name),)
    elif sort == "status":
        exprs = (d(Appointment.status),)
    else:  # "time", and the fallback for an unrecognized sort key
        exprs = (d(AppointmentService.start),)
    return exprs + (AppointmentService.id.asc(),)


async def _list_schedule_between(
    db: AsyncSession, start_of_day: datetime, end_of_day: datetime, reference_date: date,
    page: int, page_size: int, provider_id: str | None, service_id: str | None = None,
    sort: str = "time", sort_dir: str = "asc",
) -> TodaysAppointmentsResponse:
    """Shared query behind `list_todays_appointments` and `list_schedule_for_date`: every
    scheduled service (one row per `AppointmentService`, not per `Appointment` -- see
    `list_todays_appointments`) starting within `[start_of_day, end_of_day)`, excluding
    cancelled appointments, optionally narrowed to one provider and/or one service, in
    the order `_schedule_sort_expressions(sort)` picks (defaulting to chronological).
    """
    query = (
        select(
            AppointmentService.id, Appointment.id, Patient.id, Patient.first_name, Patient.last_name, Patient.phone,
            Service.name, Provider.first_name, Provider.last_name,
            AppointmentService.start, AppointmentService.end, Appointment.status,
        )
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Service, Service.id == AppointmentService.service_id)
        .join(Provider, Provider.id == AppointmentService.provider_id)
        .where(
            Appointment.status != "cancelled",
            AppointmentService.start >= start_of_day,
            AppointmentService.start < end_of_day,
        )
    )
    if provider_id:
        query = query.where(AppointmentService.provider_id == provider_id)
    if service_id:
        query = query.where(AppointmentService.service_id == service_id)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    # `.id` breaks ties within whatever `sort` picks (e.g. two services starting at the
    # exact same timestamp, common in this seed data) -- so the display order here and
    # the row ranking in `app.repositories.appointments`'s Previous/Next (for the
    # Appointment Detail page a schedule row links to) always agree.
    query = query.order_by(*_schedule_sort_expressions(sort, sort_dir))
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    items = [
        TodaysAppointmentItem(
            id=service_id, appointment_id=appointment_id, patient_id=patient_id,
            patient_name=f"{first_name} {last_name}", phone=phone,
            service_name=service_name, provider_name=f"{provider_first} {provider_last}",
            start=start, end=end, status=status,
        )
        for service_id, appointment_id, patient_id, first_name, last_name, phone, service_name, provider_first, provider_last, start, end, status in rows
    ]

    return TodaysAppointmentsResponse(
        items=items, total=total, page=page, page_size=page_size, reference_date=reference_date,
    )


async def list_todays_appointments(
    db: AsyncSession, page: int = 1, page_size: int = 100, provider_id: str | None = None,
    service_id: str | None = None, sort: str = "time", sort_dir: str = "asc",
) -> TodaysAppointmentsResponse:
    """List every scheduled service occurring on the reference "today", for the front desk's
    at-a-glance daily schedule -- see `get_reference_now` for what "today" means
    against this seed dataset.

    One row per `AppointmentService` (not per `Appointment`): a multi-service appointment
    (e.g. consultation, then an X-ray with a different provider) occupies more than one
    real time slot on the day's schedule, and a front desk agent needs to see each one,
    not a single row that hides which provider is busy when. Cancelled appointments are
    excluded entirely -- they aren't happening today regardless of what time they were
    scheduled for.

    `provider_id`, if given, restricts this to the services that specific provider is
    performing today -- e.g. "what does Dr. Smith have today" -- rather than the whole
    clinic's schedule. `service_id` narrows the same way, to one specific service being
    performed. `sort` picks the display order (see `_schedule_sort_expressions`) --
    chronological by default, or grouped by patient/provider name.
    """
    reference_now = await get_reference_now(db)
    reference_date = reference_now.date()
    end_of_day = reference_now + timedelta(days=1)
    return await _list_schedule_between(
        db, reference_now, end_of_day, reference_date, page, page_size, provider_id, service_id, sort, sort_dir,
    )


async def list_schedule_for_date(
    db: AsyncSession, target_date: date, page: int = 1, page_size: int = 100, provider_id: str | None = None,
    service_id: str | None = None, sort: str = "time", sort_dir: str = "asc",
) -> TodaysAppointmentsResponse:
    """List every scheduled service on an arbitrary day, for the Calendar view's drill-down
    (click a day, see that day's schedule) -- the same shape and semantics as
    `list_todays_appointments`, just for a caller-chosen date instead of always "today".
    """
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = start_of_day + timedelta(days=1)
    return await _list_schedule_between(
        db, start_of_day, end_of_day, target_date, page, page_size, provider_id, service_id, sort, sort_dir,
    )


CALENDAR_DAY_PREVIEW_LIMIT = 2  # kept small -- the month grid needs to stay compact (Apple-Calendar-style), not grow a row per extra chip


async def get_calendar_month(
    db: AsyncSession, year: int | None = None, month: int | None = None,
) -> CalendarMonthResponse:
    """Day-by-day scheduled (non-cancelled) service counts for one calendar month, for the
    Calendar view's density grid -- plus, per day, a capped preview of its earliest
    appointments (`CALENDAR_DAY_PREVIEW_LIMIT`) for the grid's Google-Calendar-style
    truncated event chips.

    Counts `AppointmentService` rows (not `Appointment`s), consistent with
    `list_todays_appointments`/`list_schedule_for_date` -- a multi-service appointment
    contributes one count per service, matching what a front desk agent would actually see
    if they drilled into that day. Every day of the month is included, even ones with zero
    scheduled services, so the frontend can render a complete grid without inferring gaps.
    The preview list uses the identical "exclude cancelled" filter as `count`, so a day's
    chips and its "+N more" math (`count - len(appointments)`) never disagree.

    `year`/`month` default to the reference "today"'s own month (see
    `get_reference_now`) when omitted, so the calendar opens on the month that
    actually has data against this static seed dataset, not the real current month.
    """
    reference_now = await get_reference_now(db)
    if year is None or month is None:
        year, month = reference_now.year, reference_now.month

    month_start = date(year, month, 1)
    next_month_start = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    day_column = func.date(AppointmentService.start)
    counts_query = (
        select(day_column.label("day"), func.count(AppointmentService.id).label("count"))
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .where(
            Appointment.status != "cancelled",
            AppointmentService.start >= month_start,
            AppointmentService.start < next_month_start,
        )
        .group_by(day_column)
    )
    counts_by_day = {row.day: row.count for row in (await db.execute(counts_query)).all()}

    # A whole month's worth of scheduled services is at most a few hundred rows against
    # this dataset's actual volume (~6,000 appointments total) -- cheap enough to fetch in
    # one query and slice per day in Python, rather than a per-day-limited window query.
    preview_query = (
        select(
            day_column.label("day"), AppointmentService.id, Patient.first_name, Patient.last_name,
            AppointmentService.start, Appointment.status,
        )
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.status != "cancelled",
            AppointmentService.start >= month_start,
            AppointmentService.start < next_month_start,
        )
        .order_by(AppointmentService.start.asc(), AppointmentService.id.asc())
    )
    previews_by_day: dict[date, list[CalendarAppointmentPreview]] = {}
    for day, service_id, first_name, last_name, start, status in (await db.execute(preview_query)).all():
        bucket = previews_by_day.setdefault(day, [])
        if len(bucket) < CALENDAR_DAY_PREVIEW_LIMIT:
            bucket.append(CalendarAppointmentPreview(
                appointment_service_id=service_id, patient_name=f"{first_name} {last_name}",
                start=start, status=status,
            ))

    days = []
    current = month_start
    while current < next_month_start:
        days.append(CalendarDayCount(
            date=current, count=counts_by_day.get(current, 0),
            appointments=previews_by_day.get(current, []),
        ))
        current += timedelta(days=1)

    return CalendarMonthResponse(month=f"{year:04d}-{month:02d}", days=days, reference_date=reference_now.date())


async def list_upcoming_appointments(
    db: AsyncSession, page: int = 1, page_size: int = 25, provider_id: str | None = None,
    only_tomorrow: bool = False,
) -> UpcomingAppointmentsResponse:
    """List patients by their soonest upcoming appointment, for planning ahead beyond today.

    One row per patient (their single *soonest* non-cancelled appointment
    strictly AFTER the reference "today" -- see `get_reference_now`),
    sorted soonest-first. Today itself is deliberately excluded here -- it's
    covered by `list_todays_appointments` instead, so the two views don't
    show overlapping appointments.

    `provider_id`, if given, restricts the services considered to that
    provider's own BEFORE finding "soonest" -- so a patient's soonest
    upcoming appointment *with that provider* is shown, not their soonest
    appointment overall (which could be a different service with a
    different provider on the same multi-service appointment).

    `only_tomorrow`, if set, additionally caps the window to the single day
    right after the reference "today" -- for the front desk page's "Coming
    Up Tomorrow" strip, which needs to show ONLY appointments actually
    happening tomorrow (the strip's own name would otherwise be inaccurate:
    without this, "soonest upcoming" can reach several days out, not just
    the next day). Computed entirely server-side from the same reference
    date every other "today"-relative view in this app uses -- deliberately
    not exposed as a caller-supplied date, so nothing here can accidentally
    be computed against the real wall-clock date instead of this frozen
    dataset's own reference anchor.

    Ranks individual `AppointmentService` rows directly (not a per-appointment
    `MIN()` aggregate) so the exact soonest row's own service/provider can be
    surfaced -- the "Coming Up" strip on the front desk page needs the actual
    service+provider, not just a bare date, the same reasoning as
    `list_rebooking_opportunities`'s "latest row per patient" pattern. The
    minimum of each patient's individual service start times is mathematically
    identical to the minimum of their per-appointment minimums, so this ranks
    the same "soonest" moment as before -- it just also identifies which row
    produced it.
    """
    # `get_reference_now` returns a `date_trunc('month', ...)`
    # result, which Postgres always normalizes to midnight on day 1 of that
    # month -- already exactly the start of the reference day, no separate
    # "start of day" step needed here.
    reference_now = await get_reference_now(db)
    reference_date = reference_now.date()
    end_of_reference_day = reference_now + timedelta(days=1)

    base = (
        select(
            Appointment.patient_id, Appointment.id.label("appointment_id"), Appointment.status,
            AppointmentService.id.label("service_id"), AppointmentService.start,
            Service.name.label("service_name"),
            Provider.first_name.label("provider_first_name"), Provider.last_name.label("provider_last_name"),
        )
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .join(Service, Service.id == AppointmentService.service_id)
        .join(Provider, Provider.id == AppointmentService.provider_id)
        .where(Appointment.status != "cancelled", AppointmentService.start >= end_of_reference_day)
    )
    if provider_id:
        base = base.where(AppointmentService.provider_id == provider_id)
    if only_tomorrow:
        # `end_of_reference_day` (already the lower bound above) IS tomorrow's start --
        # this just adds the matching upper bound to close the window to that single day.
        base = base.where(AppointmentService.start < end_of_reference_day + timedelta(days=1))

    # Of each patient's upcoming (after today) services, keep only the
    # soonest one -- a patient with several upcoming bookings should appear
    # once, for their next one.
    ranked = base.add_columns(
        func.row_number().over(
            partition_by=Appointment.patient_id, order_by=AppointmentService.start.asc(),
        ).label("rn"),
    ).subquery()
    soonest_upcoming = select(ranked).where(ranked.c.rn == 1).subquery()

    query = (
        select(
            Patient, soonest_upcoming.c.start, soonest_upcoming.c.status,
            soonest_upcoming.c.appointment_id, soonest_upcoming.c.service_id,
            soonest_upcoming.c.service_name, soonest_upcoming.c.provider_first_name,
            soonest_upcoming.c.provider_last_name,
        )
        .join(soonest_upcoming, soonest_upcoming.c.patient_id == Patient.id)
        .order_by(soonest_upcoming.c.start.asc())
    )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    items = [
        UpcomingPatientItem(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.date(), phone=patient.phone, email=patient.email,
            upcoming_appointment_date=appointment_start, appointment_status=status,
            appointment_id=appointment_id, service_id=service_id,
            service_name=service_name, provider_name=f"{provider_first} {provider_last}",
        )
        for patient, appointment_start, status, appointment_id, service_id, service_name, provider_first, provider_last in rows
    ]

    return UpcomingAppointmentsResponse(
        items=items, total=total, page=page, page_size=page_size, reference_date=reference_date,
    )


REBOOKING_STALE_DAYS = 45  # see list_rebooking_opportunities for why this exists at all


def _rebooking_subqueries(reference_now: datetime):
    """The `(has_upcoming, last_visit)` subqueries shared by `list_rebooking_opportunities`
    and `_neighbors_in_rebooking`, so Prev/Next on that worklist can never disagree with
    what the worklist itself displays. See `list_rebooking_opportunities` for what each
    subquery means and why.
    """
    has_upcoming = (
        select(Appointment.patient_id)
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .where(Appointment.status != "cancelled", AppointmentService.start >= reference_now)
        .distinct()
        .subquery()
    )
    ranked_visits = (
        select(
            Appointment.patient_id,
            AppointmentService.start,
            Service.name.label("service_name"),
            Provider.first_name.label("provider_first_name"),
            Provider.last_name.label("provider_last_name"),
            func.row_number().over(
                partition_by=Appointment.patient_id, order_by=AppointmentService.start.desc(),
            ).label("rn"),
        )
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .join(Service, Service.id == AppointmentService.service_id)
        .join(Provider, Provider.id == AppointmentService.provider_id)
        .where(Appointment.status != "cancelled")
        .subquery()
    )
    last_visit = select(ranked_visits).where(ranked_visits.c.rn == 1).subquery()
    return has_upcoming, last_visit


def _rebooking_sort_expressions(sort: str, direction: str, last_visit_sq) -> tuple:
    """Maps a rebooking-worklist `(sort, direction)` pair to its ORDER BY expression(s),
    always ending in `Patient.id` as a tiebreaker -- same reasoning as
    `_patient_sort_expressions`/`_schedule_sort_expressions`. Shared by
    `list_rebooking_opportunities` and `_neighbors_in_rebooking` so they always agree.

    Column-header click-to-sort needed this worklist to support more than its original
    single fixed order (most-recent-visit-first) -- `name`/`email` sort on the patient
    themselves; `last_service_name`/`last_provider_name` sort on that same most-recent
    visit's own service/provider (from `last_visit_sq`, the same subquery the worklist's
    columns are already populated from); `last_appointment_date` (the default) sorts on
    that visit's own date.
    """
    is_desc = direction == "desc"

    def d(expr):
        return expr.desc() if is_desc else expr.asc()

    if sort == "name":
        exprs = (d(Patient.last_name), d(Patient.first_name))
    elif sort == "email":
        exprs = (d(Patient.email),)
    elif sort == "last_service_name":
        exprs = (d(last_visit_sq.c.service_name),)
    elif sort == "last_provider_name":
        exprs = (d(last_visit_sq.c.provider_last_name), d(last_visit_sq.c.provider_first_name))
    else:  # "last_appointment_date", and the fallback for an unrecognized sort key
        exprs = (d(last_visit_sq.c.start),)
    return exprs + (Patient.id.asc(),)


async def list_rebooking_opportunities(
    db: AsyncSession, page: int = 1, page_size: int = 25,
    sort: str = "last_appointment_date", sort_dir: str = "desc",
) -> RebookingOpportunitiesResponse:
    """List patients who have genuinely gone quiet -- seen before, nothing scheduled going
    forward, AND not seen recently either -- the front desk's outreach/rebooking worklist,
    not just a demographic filter.

    A patient qualifies if they have at least one non-cancelled appointment, none of their
    non-cancelled appointments start on or after the reference "today" (see
    `get_reference_now`) -- i.e. nothing scheduled today, nothing upcoming either -- AND
    their most recent visit was at least `REBOOKING_STALE_DAYS` days before "today".

    That last condition was NOT here originally -- an earlier version deliberately left it
    out, reasoning that any cutoff risked "silently hiding someone worth calling." Live
    verification against this exact dataset showed the actual cost of that choice: 2,164 of
    4,000 patients (54%) qualified, with the very top of the "most promising" list being
    people last seen literally days before the reference date -- someone who visited last
    week hasn't lapsed, they just haven't rebooked yet, which is completely normal and not
    actionable outreach. A worklist that's already half the entire patient base, paginated
    dozens of pages deep, isn't a worklist a front desk agent will actually work through --
    reported directly as "doesn't seem very useful." The staleness floor is what turns this
    from "everyone without a future booking" into "people who have actually gone quiet."

    Sorted by their most recent visit, most-recent-first even with the floor in place: a
    patient stale for 46 days is still a more promising call than one stale for a year.

    Patients with ANY non-cancelled appointment starting today or later already have
    something on the books and don't belong on this list -- excluded via an anti-join
    (LEFT JOIN ... WHERE NULL), not a NOT IN subquery, to avoid the classic NOT IN + NULL
    pitfall entirely. The most recent non-cancelled visit's specific service+provider (not
    just an aggregated MAX() timestamp) drives last_service_name/last_provider_name: the
    front desk's rebooking pitch is naturally "you're due for another [service] with
    [provider]," so the list needs the actual service+provider from that visit, not just
    its date.
    """
    reference_now = await get_reference_now(db)
    has_upcoming, last_visit = _rebooking_subqueries(reference_now)
    # Whole-day comparison (`func.date(...)`, the same tool `get_calendar_month` already
    # uses for this), not a raw datetime `<=` -- `reference_now` is always midnight, so a
    # naive datetime comparison against a real appointment's actual time-of-day (e.g. 9am)
    # would wrongly require 46 days instead of 45 for any visit that didn't happen to land
    # exactly at midnight on the cutoff day itself.
    stale_cutoff_date = reference_now.date() - timedelta(days=REBOOKING_STALE_DAYS)

    query = (
        select(
            Patient, last_visit.c.start, last_visit.c.service_name,
            last_visit.c.provider_first_name, last_visit.c.provider_last_name,
        )
        .join(last_visit, last_visit.c.patient_id == Patient.id)
        .outerjoin(has_upcoming, has_upcoming.c.patient_id == Patient.id)
        .where(has_upcoming.c.patient_id.is_(None), func.date(last_visit.c.start) <= stale_cutoff_date)
        .order_by(*_rebooking_sort_expressions(sort, sort_dir, last_visit))
    )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    items = [
        RebookingOpportunitiesItem(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            phone=patient.phone, email=patient.email, last_appointment_date=last_appointment_date,
            last_service_name=service_name, last_provider_name=f"{provider_first_name} {provider_last_name}",
        )
        for patient, last_appointment_date, service_name, provider_first_name, provider_last_name in rows
    ]

    return RebookingOpportunitiesResponse(
        items=items, total=total, page=page, page_size=page_size, reference_date=reference_now.date(),
    )


async def _neighbors_in_rebooking(
    db: AsyncSession, patient_id: str, sort: str = "last_appointment_date", sort_dir: str = "desc",
) -> tuple[str | None, str | None]:
    """Previous/Next `Patient.id` for `get_patient_detail`'s `kind="rebooking"` context:
    the patient immediately before/after `patient_id` in the same `(sort, sort_dir)`
    order `list_rebooking_opportunities` displays (most-recent-visit-first by default).
    Returns `(None, None)` if `patient_id` no longer qualifies for the worklist at all
    (e.g. they've since been rebooked, or their last visit isn't stale enough yet --
    see `REBOOKING_STALE_DAYS`).
    """
    reference_now = await get_reference_now(db)
    has_upcoming, last_visit = _rebooking_subqueries(reference_now)
    stale_cutoff_date = reference_now.date() - timedelta(days=REBOOKING_STALE_DAYS)
    base = (
        select(Patient.id)
        .join(last_visit, last_visit.c.patient_id == Patient.id)
        .outerjoin(has_upcoming, has_upcoming.c.patient_id == Patient.id)
        .where(has_upcoming.c.patient_id.is_(None), func.date(last_visit.c.start) <= stale_cutoff_date)
    )
    ranked = base.add_columns(
        func.row_number().over(order_by=_rebooking_sort_expressions(sort, sort_dir, last_visit)).label("rn")
    ).subquery()

    current_rn = (await db.execute(select(ranked.c.rn).where(ranked.c.id == patient_id))).scalar_one_or_none()
    if current_rn is None:
        return None, None
    previous_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn - 1))).scalar_one_or_none()
    next_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn + 1))).scalar_one_or_none()
    return previous_id, next_id
