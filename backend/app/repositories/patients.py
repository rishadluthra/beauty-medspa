"""Repository functions for querying patients.

Part of the data-access layer described in `app.repositories.__init__`:
these are typed, parameterized, reusable query functions, not
route-specific helpers. Routers call them, and the same functions are
intended to be callable directly by a future AI/natural-language-query
service as "tools" over the data.
"""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
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
    last_appointment = (
        select(Appointment.patient_id, func.max(Appointment.created_date).label("last_appointment_date"))
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
    appointment (most recent first), every service performed within each
    one (with its provider and time window, via `AppointmentService`), and
    the payment tied to each appointment, if any. This is the data that
    powers the "click a patient row for more info" Patient Detail page —
    the raw appointment/service/provider/payment records were previously
    only ever touched in aggregate by the analytics queries, never
    surfaced per-patient.

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
    last_appointment_date = (await db.execute(
        select(func.max(Appointment.created_date)).where(Appointment.patient_id == patient_id)
    )).scalar_one()

    appointments = (await db.execute(
        select(Appointment).where(Appointment.patient_id == patient_id).order_by(Appointment.created_date.desc())
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

    appointment_items = [
        AppointmentDetail(
            id=appointment.id, status=appointment.status, created_date=appointment.created_date,
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

    return PatientDetailResponse(
        patient=PatientDetail(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.date(), gender=patient.gender, address=patient.address,
            phone=patient.phone, email=patient.email, source=patient.source, created_date=patient.created_date,
            appointment_count=appointment_count, last_appointment_date=last_appointment_date,
            total_spent_cents=total_spent_cents,
        ),
        appointments=appointment_items,
    )
