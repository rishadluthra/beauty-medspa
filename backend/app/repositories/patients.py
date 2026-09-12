"""Repository functions for querying patients.

Part of the data-access layer described in `app.repositories.__init__`:
these are typed, parameterized, reusable query functions, not
route-specific helpers. Routers call them, and the same functions are
intended to be callable directly by a future AI/natural-language-query
service as "tools" over the data.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.schemas.patient import (
    AppointmentDetail,
    AppointmentServiceItem,
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
    `source` and `gender` are exact-match filters. `created_from`/
    `created_to` filter on `Patient.created_date` (inclusive on both ends —
    `created_to` covers the entire day, not just midnight). `age_min`/
    `age_max` filter on age *as of today*, computed from `date_of_birth`
    (see `list_patients` for how an age range converts to a date-of-birth
    range). `min_total_spent_cents` filters on lifetime spend (the same
    *paid*-payments-only sum `list_patients` already computes as
    `total_spent_cents`), for identifying high-value patients -- a patient
    with no paid payments at all is treated as 0, not excluded outright.
    All fields are optional; omitted filters are simply not applied.
    """

    search: str | None = None
    source: str | None = None
    gender: str | None = None
    created_from: date | None = None
    created_to: date | None = None
    age_min: int | None = None
    age_max: int | None = None
    min_total_spent_cents: int | None = None


@dataclass
class PatientListContext:
    """Which source list a Patient Detail page was navigated *from*, and that list's own
    current filter/sort/scope -- so `get_patient_detail`'s Previous/Next buttons walk the
    same order the agent was actually looking at (the Rebooking worklist, a
    filtered/sorted All Patients view), not always one fixed global order.

    `kind="all"` with the dataclass's own defaults (no filters, sort="name") reproduces
    exactly the old fixed global `(last_name, first_name, id)` order -- so a direct link,
    a global-search result, or any other entry point with no real list context at all can
    simply omit this argument and still get sane, deterministic behavior. An unrecognized
    `kind` value falls back the same way, in `get_patient_detail` below.

    There used to be `kind="today"`/`"day"` variants too, for Today's Appointments and
    the Calendar day drill-down. Those schedules are one row per scheduled *service*, not
    per patient (a patient can have more than one service the same day) -- per client
    feedback, clicking a schedule row now goes to a dedicated Appointment Detail page
    (`app.repositories.appointments.get_appointment_detail`) instead of this generic,
    all-history Patient Detail page, so nothing constructs those two kinds here anymore.
    """

    kind: str = "all"
    filters: PatientFilters = field(default_factory=PatientFilters)
    sort: str = "name"


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
    `_payment_totals_subquery`, for the "last_appointment_date" sort.
    """
    return (
        select(Appointment.patient_id, func.max(AppointmentService.start).label("last_appointment_date"))
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .group_by(Appointment.patient_id)
        .subquery()
    )


def _apply_patient_filters(query, filters: PatientFilters, payment_totals_sq):
    """Applies every `PatientFilters` field to `query` as a WHERE clause, exactly as
    `list_patients` needs -- factored out so `_neighbors_in_all_patients` (Prev/Next)
    filters candidates identically to however the Patient Table itself is currently
    filtered, and the two can never silently drift apart.

    `payment_totals_sq` must already be joined onto `query` (both current callers do
    this before calling here) -- needed for `min_total_spent_cents`, which filters on
    that aggregate rather than a plain `Patient` column.
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
    if filters.source:
        query = query.where(Patient.source == filters.source)
    if filters.gender:
        query = query.where(Patient.gender == filters.gender)
    if filters.created_from:
        query = query.where(Patient.created_date >= filters.created_from)
    if filters.created_to:
        query = query.where(Patient.created_date < filters.created_to + timedelta(days=1))
    if filters.age_min is not None:
        cutoff = _years_before(date.today(), filters.age_min)
        query = query.where(Patient.date_of_birth < cutoff + timedelta(days=1))
    if filters.age_max is not None:
        cutoff = _years_before(date.today(), filters.age_max + 1)
        query = query.where(Patient.date_of_birth >= cutoff + timedelta(days=1))
    if filters.min_total_spent_cents is not None:
        # A patient with no paid payments at all has NULL here (outer join), which must
        # count as 0 -- otherwise they'd silently pass a "min spent >= 0" filter instead
        # of being correctly excluded.
        query = query.where(
            func.coalesce(payment_totals_sq.c.total_spent_cents, 0) >= filters.min_total_spent_cents
        )
    return query


def _patient_sort_expressions(sort: str, payment_totals_sq, last_appointment_sq) -> tuple:
    """Maps a `sort` value to its ORDER BY expression(s), always ending in `Patient.id` as
    a final tiebreaker. Without it, patients sharing a sort value (same last name, same
    total spent, etc.) had no guaranteed stable order -- risking pagination that skips or
    repeats rows across pages, and (now) a Prev/Next window ranking that could disagree
    with what the table itself actually displays. Shared by `list_patients` and
    `_neighbors_in_all_patients` so they always agree.
    """
    options = {
        "name": (Patient.last_name.asc(), Patient.first_name.asc()),
        "created_date": (Patient.created_date.desc(),),
        "total_spent": (func.coalesce(payment_totals_sq.c.total_spent_cents, 0).desc(),),
        "last_appointment_date": (last_appointment_sq.c.last_appointment_date.desc(),),
    }
    return options.get(sort, options["name"]) + (Patient.id.asc(),)


async def list_patients(
    db: AsyncSession,
    filters: PatientFilters,
    sort: str = "name",
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
    appointment_counts = (
        select(Appointment.patient_id, func.count(Appointment.id).label("appointment_count"))
        .group_by(Appointment.patient_id)
        .subquery()
    )
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
    query = _apply_patient_filters(query, filters, payment_totals)

    # Count matching rows (post-filter) for pagination metadata, without pulling all rows.
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    # See `_patient_sort_expressions` for why every sort ends in a
    # `Patient.id` tiebreaker -- without it, ties (e.g. two patients sharing
    # a last name) had no guaranteed stable order across pages.
    query = query.order_by(*_patient_sort_expressions(sort, payment_totals, last_appointment))
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
    db: AsyncSession, patient_id: str, filters: PatientFilters, sort: str,
) -> tuple[str | None, str | None]:
    """Previous/Next `Patient.id` for `get_patient_detail`'s `kind="all"` context: the
    patient immediately before/after `patient_id` in the exact filtered+sorted order
    `list_patients` would display for these same `filters`/`sort`.

    Ranks every matching patient with `ROW_NUMBER() OVER (ORDER BY ...)` (using the same
    filter/sort building blocks `list_patients` itself uses, so the two can never
    disagree), finds `patient_id`'s own rank, then looks up rank-1 and rank+1. Returns
    `(None, None)` if the filters exclude `patient_id` entirely (e.g. the agent navigated
    in from an unfiltered link, then the underlying data changed) -- there's no principled
    "previous/next" for a patient that isn't actually in the list being scoped to.
    """
    payment_totals = _payment_totals_subquery()
    last_appointment = _last_appointment_subquery()
    base = (
        select(Patient.id)
        .outerjoin(payment_totals, payment_totals.c.patient_id == Patient.id)
        .outerjoin(last_appointment, last_appointment.c.patient_id == Patient.id)
    )
    base = _apply_patient_filters(base, filters, payment_totals)
    order_exprs = _patient_sort_expressions(sort, payment_totals, last_appointment)
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
        previous_patient_id, next_patient_id = await _neighbors_in_rebooking(db, patient_id)
    else:
        previous_patient_id, next_patient_id = await _neighbors_in_all_patients(
            db, patient_id, context.filters, context.sort,
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


def _schedule_sort_expressions(sort: str) -> tuple:
    """Maps a schedule `sort` value to its ORDER BY expression(s), always ending in
    `AppointmentService.id` as a tiebreaker -- same reasoning as `_patient_sort_expressions`,
    just for schedule rows. Shared by `_list_schedule_between` and
    `app.repositories.appointments._neighbors_in_schedule` so a schedule row's Previous/
    Next always walks the exact same order the list itself is displayed in.
    """
    options = {
        "time": (AppointmentService.start.asc(),),
        "patient_name": (Patient.last_name.asc(), Patient.first_name.asc()),
        "provider_name": (Provider.last_name.asc(), Provider.first_name.asc(), AppointmentService.start.asc()),
    }
    return options.get(sort, options["time"]) + (AppointmentService.id.asc(),)


async def _list_schedule_between(
    db: AsyncSession, start_of_day: datetime, end_of_day: datetime, reference_date: date,
    page: int, page_size: int, provider_id: str | None, service_id: str | None = None, sort: str = "time",
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
    query = query.order_by(*_schedule_sort_expressions(sort))
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
    service_id: str | None = None, sort: str = "time",
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
        db, reference_now, end_of_day, reference_date, page, page_size, provider_id, service_id, sort,
    )


async def list_schedule_for_date(
    db: AsyncSession, target_date: date, page: int = 1, page_size: int = 100, provider_id: str | None = None,
    service_id: str | None = None, sort: str = "time",
) -> TodaysAppointmentsResponse:
    """List every scheduled service on an arbitrary day, for the Calendar view's drill-down
    (click a day, see that day's schedule) -- the same shape and semantics as
    `list_todays_appointments`, just for a caller-chosen date instead of always "today".
    """
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = start_of_day + timedelta(days=1)
    return await _list_schedule_between(
        db, start_of_day, end_of_day, target_date, page, page_size, provider_id, service_id, sort,
    )


async def get_calendar_month(
    db: AsyncSession, year: int | None = None, month: int | None = None,
) -> CalendarMonthResponse:
    """Day-by-day scheduled (non-cancelled) service counts for one calendar month, for the
    Calendar view's density grid.

    Counts `AppointmentService` rows (not `Appointment`s), consistent with
    `list_todays_appointments`/`list_schedule_for_date` -- a multi-service appointment
    contributes one count per service, matching what a front desk agent would actually see
    if they drilled into that day. Every day of the month is included, even ones with zero
    scheduled services, so the frontend can render a complete grid without inferring gaps.

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

    days = []
    current = month_start
    while current < next_month_start:
        days.append(CalendarDayCount(date=current, count=counts_by_day.get(current, 0)))
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


async def list_rebooking_opportunities(
    db: AsyncSession, page: int = 1, page_size: int = 25,
) -> RebookingOpportunitiesResponse:
    """List patients who have been seen before but have nothing scheduled going forward --
    the front desk's outreach/rebooking worklist, not just a demographic filter.

    A patient qualifies if they have at least one non-cancelled appointment AND none of
    their non-cancelled appointments start on or after the reference "today" (see
    `get_reference_now`) -- i.e. nothing scheduled today, and nothing upcoming either.
    Sorted by their most recent visit, most-recent-first: a patient seen last week is a far
    more promising rebooking call than one seen a year ago, and this ordering surfaces the
    best candidates first without an arbitrary "seen within N days" cutoff that would
    silently hide someone worth calling.

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

    query = (
        select(
            Patient, last_visit.c.start, last_visit.c.service_name,
            last_visit.c.provider_first_name, last_visit.c.provider_last_name,
        )
        .join(last_visit, last_visit.c.patient_id == Patient.id)
        .outerjoin(has_upcoming, has_upcoming.c.patient_id == Patient.id)
        .where(has_upcoming.c.patient_id.is_(None))
        # `Patient.id` breaks ties between patients whose most recent visit started at the
        # exact same timestamp, so this order and `_neighbors_in_rebooking`'s ranking agree.
        .order_by(last_visit.c.start.desc(), Patient.id.asc())
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


async def _neighbors_in_rebooking(db: AsyncSession, patient_id: str) -> tuple[str | None, str | None]:
    """Previous/Next `Patient.id` for `get_patient_detail`'s `kind="rebooking"` context:
    the patient immediately before/after `patient_id` in the same most-recent-visit-first
    order `list_rebooking_opportunities` displays. Returns `(None, None)` if `patient_id`
    no longer qualifies for the worklist at all (e.g. they've since been rebooked).
    """
    reference_now = await get_reference_now(db)
    has_upcoming, last_visit = _rebooking_subqueries(reference_now)
    base = (
        select(Patient.id)
        .join(last_visit, last_visit.c.patient_id == Patient.id)
        .outerjoin(has_upcoming, has_upcoming.c.patient_id == Patient.id)
        .where(has_upcoming.c.patient_id.is_(None))
    )
    ranked = base.add_columns(
        func.row_number().over(order_by=(last_visit.c.start.desc(), Patient.id.asc())).label("rn")
    ).subquery()

    current_rn = (await db.execute(select(ranked.c.rn).where(ranked.c.id == patient_id))).scalar_one_or_none()
    if current_rn is None:
        return None, None
    previous_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn - 1))).scalar_one_or_none()
    next_id = (await db.execute(select(ranked.c.id).where(ranked.c.rn == current_rn + 1))).scalar_one_or_none()
    return previous_id, next_id
