"""Repository functions for querying patients.

Part of the data-access layer described in `app.repositories.__init__`:
these are typed, parameterized, reusable query functions, not
route-specific helpers. Routers call them, and the same functions are
intended to be callable directly by a future AI/natural-language-query
service as "tools" over the data.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.schemas.patient import (
    AppointmentDetail,
    AppointmentServiceItem,
    PatientDetail,
    PatientDetailResponse,
    PatientListItem,
    PatientListResponse,
    PaymentSummary,
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

    `search` matches (case-insensitively) against patient name, email, or
    phone. `source` and `gender` are exact-match filters. `created_from`/
    `created_to` filter on `Patient.created_date` (inclusive on both ends —
    `created_to` covers the entire day, not just midnight). `age_min`/
    `age_max` filter on age *as of today*, computed from `date_of_birth`
    (see `list_patients` for how an age range converts to a date-of-birth
    range). All fields are optional; omitted filters are simply not
    applied.
    """

    search: str | None = None
    source: str | None = None
    gender: str | None = None
    created_from: date | None = None
    created_to: date | None = None
    age_min: int | None = None
    age_max: int | None = None


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
    payment_totals = (
        select(Payment.patient_id, func.sum(Payment.amount).label("total_spent_cents"))
        .where(Payment.status == "paid")  # cancelled/pending/failed payments never count toward lifetime spend
        .group_by(Payment.patient_id)
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
    last_appointment = (
        select(Appointment.patient_id, func.max(AppointmentService.start).label("last_appointment_date"))
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .group_by(Appointment.patient_id)
        .subquery()
    )

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

    if filters.search:
        term = f"%{filters.search.lower()}%"
        query = query.where(
            func.lower(Patient.first_name + " " + Patient.last_name).like(term)
            | func.lower(Patient.email).like(term)
            | Patient.phone.like(f"%{filters.search}%")
        )
    if filters.source:
        query = query.where(Patient.source == filters.source)
    if filters.gender:
        query = query.where(Patient.gender == filters.gender)
    if filters.created_from:
        query = query.where(Patient.created_date >= filters.created_from)
    if filters.created_to:
        # `created_date` is a datetime column; comparing directly against
        # `created_to` (a date) would only include up to midnight of that
        # day, silently excluding anything created later that same day.
        # Comparing against the *next* day with `<` makes the end date
        # inclusive of its whole 24 hours.
        query = query.where(Patient.created_date < filters.created_to + timedelta(days=1))
    if filters.age_min is not None:
        # "At least age_min years old today" means born on or before
        # (today - age_min years) — e.g. to be >= 20 today, you must have
        # been born on or before this same calendar date 20 years ago.
        # `date_of_birth` is a full timestamp, not just a date, so "on or
        # before that calendar date" (inclusive of the whole day,
        # regardless of what time someone's DOB happens to carry) means
        # strictly before the *next* day — same reasoning as created_to.
        cutoff = _years_before(date.today(), filters.age_min)
        query = query.where(Patient.date_of_birth < cutoff + timedelta(days=1))
    if filters.age_max is not None:
        # "At most age_max years old today" means NOT YET (age_max + 1)
        # years old, i.e. born strictly after (today - (age_max + 1)
        # years) — someone born on or before that calendar date would
        # already be age_max + 1, one year too old. "Strictly after that
        # calendar date" (again treating date_of_birth as a full
        # timestamp) means on or after the day right after it.
        cutoff = _years_before(date.today(), filters.age_max + 1)
        query = query.where(Patient.date_of_birth >= cutoff + timedelta(days=1))

    # Count matching rows (post-filter) for pagination metadata, without pulling all rows.
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    sort_columns = {
        "name": Patient.last_name.asc(),
        "created_date": Patient.created_date.desc(),
        "total_spent": func.coalesce(payment_totals.c.total_spent_cents, 0).desc(),
        "last_appointment_date": last_appointment.c.last_appointment_date.desc(),
    }
    query = query.order_by(sort_columns.get(sort, Patient.last_name.asc()))
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


async def get_patient_detail(db: AsyncSession, patient_id: str) -> PatientDetailResponse | None:
    """Return one patient's full profile plus their complete appointment history, or None if not found.

    Unlike `list_patients` (aggregate-only, computed across ~4,000 patients
    at once), this loads full detail for a single patient: every
    appointment (ordered by its actual scheduled visit date, most recent
    first -- see `AppointmentDetail.appointment_date`, NOT by when the
    booking record was created), every service performed within each one
    (with its provider and time window, via `AppointmentService`), and the
    payment tied to each appointment, if any, plus the adjacent patient
    ids (in the default name-sorted order) for Previous/Next navigation.
    This is the data that powers the "click a patient row for more info"
    Patient Detail page — the raw appointment/service/provider/payment
    records were previously only ever touched in aggregate by the
    analytics queries, never surfaced per-patient.

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

    # Previous/Next patient, in the same (last_name, first_name, id) order
    # the Patient Table sorts by default -- a stable global ordering, not
    # tied to whatever filter/sort was active on the table when the user
    # navigated here, so the buttons behave identically regardless of
    # entry point (including a direct URL visit). `id` is included in the
    # ordering key purely as a tie-breaker for patients sharing a full
    # name, so the ordering (and thus "next"/"previous") is deterministic.
    current_key = (patient.last_name, patient.first_name, patient.id)
    order_key = tuple_(Patient.last_name, Patient.first_name, Patient.id)
    previous_patient_id = (await db.execute(
        select(Patient.id).where(order_key < current_key)
        .order_by(Patient.last_name.desc(), Patient.first_name.desc(), Patient.id.desc())
        .limit(1)
    )).scalar_one_or_none()
    next_patient_id = (await db.execute(
        select(Patient.id).where(order_key > current_key)
        .order_by(Patient.last_name.asc(), Patient.first_name.asc(), Patient.id.asc())
        .limit(1)
    )).scalar_one_or_none()

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


async def _get_upcoming_reference_now(db: AsyncSession) -> datetime:
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


async def list_upcoming_appointments(
    db: AsyncSession, page: int = 1, page_size: int = 25,
) -> UpcomingAppointmentsResponse:
    """List patients by their soonest upcoming appointment, for the front-desk-facing dashboard.

    One row per patient (their single *soonest* non-cancelled appointment
    on or after the reference "today" -- see `_get_upcoming_reference_now`),
    sorted soonest-first.
    """
    # `_get_upcoming_reference_now` returns a `date_trunc('month', ...)`
    # result, which Postgres always normalizes to midnight on day 1 of that
    # month -- already exactly the start of the reference day, no separate
    # "start of day" step needed here.
    reference_now = await _get_upcoming_reference_now(db)
    reference_date = reference_now.date()

    # Each non-cancelled appointment's earliest service start time (an
    # appointment itself has no date/time of its own -- see
    # AppointmentService), aggregated per appointment so a multi-service
    # appointment (e.g. consultation + X-ray) collapses to one row.
    appointment_starts = (
        select(
            Appointment.id.label("appointment_id"),
            Appointment.patient_id,
            Appointment.status,
            func.min(AppointmentService.start).label("start"),
        )
        .join(AppointmentService, AppointmentService.appointment_id == Appointment.id)
        .where(Appointment.status != "cancelled")
        .group_by(Appointment.id, Appointment.patient_id, Appointment.status)
        .subquery()
    )

    # Of each patient's upcoming (>= the reference date) appointments, keep
    # only the soonest one -- a patient with several upcoming bookings
    # should appear once, for their next one.
    upcoming = (
        select(
            appointment_starts.c.patient_id, appointment_starts.c.status, appointment_starts.c.start,
            func.row_number().over(
                partition_by=appointment_starts.c.patient_id, order_by=appointment_starts.c.start.asc(),
            ).label("rn"),
        )
        .where(appointment_starts.c.start >= reference_now)
        .subquery()
    )
    soonest_upcoming = select(upcoming).where(upcoming.c.rn == 1).subquery()

    query = (
        select(Patient, soonest_upcoming.c.start, soonest_upcoming.c.status)
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
        )
        for patient, appointment_start, status in rows
    ]

    return UpcomingAppointmentsResponse(
        items=items, total=total, page=page, page_size=page_size, reference_date=reference_date,
    )
