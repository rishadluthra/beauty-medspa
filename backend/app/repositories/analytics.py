"""Repository functions backing the Analytics Dashboard.

Part of the data-access layer described in `app.repositories.__init__`:
these are typed, parameterized, reusable query functions, not
route-specific helpers. Routers call them, and the same functions are
intended to be callable directly by a future AI/natural-language-query
service as "tools" over the data (e.g. "what was revenue last month?").

Join fan-out avoidance (read this once, it applies throughout this file):
several functions here need a count from one child table (e.g. how many
times a service was booked, via `AppointmentService`) AND a revenue sum
from a different child table (e.g. `Payment`) for the same parent row
(a `Service`, `Provider`, ...). It is tempting to do this with a single
query that joins the parent to both child tables at once, but SQL joins
are Cartesian: if a service has 2 `AppointmentService` rows and 2 `Payment`
rows, joining both onto `Service` in one query yields 2 x 2 = 4 result
rows for that service, and summing `Payment.amount` across those 4 rows
double-counts (or worse) the real revenue.

Concrete example: a service is booked twice (2 `AppointmentService` rows)
and has one $150 payment recorded against it. A single join of
`AppointmentService` and `Payment` onto `Service` produces 2 rows (one per
booking, each carrying the same $150 payment), so `SUM(payment.amount)`
over those rows reports $300 — double the true $150. To avoid this, every
function below computes each aggregate (count, sum) in its OWN
independent `GROUP BY` subquery against a single child table, and only
then outer-joins those pre-aggregated, 1-row-per-parent subqueries onto
the parent table. That keeps each aggregate correct regardless of how many
rows exist in the other child table.
"""

from datetime import datetime, timedelta

from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.schemas.analytics import AgeBucketCount, AppointmentStatusItem, DemographicsResponse, GenderCount, OverviewStats, PaymentStatusItem, ProviderUtilizationItem, RevenuePoint, SourceBreakdownItem, TopServiceItem


async def get_overview_stats(db: AsyncSession) -> OverviewStats:
    """Return top-line KPIs for the analytics dashboard header.

    Revenue and average-transaction figures only consider payments with
    `status == "paid"` (cancelled/pending/failed payments never inflate
    revenue). All money values are integer cents. `cancellation_rate` is
    cancelled appointments / total appointments, rounded to 4 decimal
    places (0.0 if there are no appointments).
    """
    total_patients = (await db.execute(select(func.count(Patient.id)))).scalar_one()

    paid = select(Payment.amount).where(Payment.status == "paid").subquery()  # only paid payments count as revenue
    total_revenue = (await db.execute(select(func.coalesce(func.sum(paid.c.amount), 0)))).scalar_one()
    paid_count = (await db.execute(select(func.count()).select_from(paid))).scalar_one()
    avg_transaction = int(total_revenue / paid_count) if paid_count else 0

    total_appointments = (await db.execute(select(func.count(Appointment.id)))).scalar_one()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_patients = (await db.execute(
        select(func.count(Patient.id)).where(Patient.created_date >= thirty_days_ago)
    )).scalar_one()

    cancelled_count = (await db.execute(
        select(func.count(Appointment.id)).where(Appointment.status == "cancelled")
    )).scalar_one()
    cancellation_rate = (cancelled_count / total_appointments) if total_appointments else 0.0

    return OverviewStats(
        total_patients=total_patients,
        total_revenue_cents=int(total_revenue),
        total_appointments=total_appointments,
        avg_transaction_cents=avg_transaction,
        new_patients_last_30_days=new_patients,
        cancellation_rate=round(cancellation_rate, 4),
    )


async def get_revenue_over_time(db: AsyncSession) -> list[RevenuePoint]:
    """Return monthly revenue (in cents) as a time series, oldest first.

    Buckets `Payment.date` by calendar month ("YYYY-MM"). Only payments
    with `status == "paid"` are summed, so cancelled/pending/failed
    payments don't appear as revenue.
    """
    period = func.to_char(Payment.date, "YYYY-MM").label("period")
    query = (
        select(period, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
        .group_by(period)
        .order_by(period)
    )
    rows = (await db.execute(query)).all()
    return [RevenuePoint(period=row.period, revenue_cents=int(row.revenue_cents)) for row in rows]


async def get_patients_by_source(db: AsyncSession) -> list[SourceBreakdownItem]:
    """Return patient counts grouped by marketing source, most common first."""
    query = (
        select(Patient.source, func.count(Patient.id).label("patient_count"))
        .group_by(Patient.source)
        .order_by(func.count(Patient.id).desc())
    )
    rows = (await db.execute(query)).all()
    return [SourceBreakdownItem(source=row.source, patient_count=row.patient_count) for row in rows]


async def get_top_services(db: AsyncSession, limit: int = 10) -> list[TopServiceItem]:
    """Return the most-booked services, with booking count and revenue.

    Booking count comes from `AppointmentService` (how many times the
    service was scheduled); revenue comes from `Payment` (sum of `amount`
    for `status == "paid"` payments against that service). These are
    computed as two INDEPENDENT `GROUP BY` subqueries and outer-joined
    onto `Service` — see the module docstring for why a single join across
    both child tables would double-count revenue. Ordered by booking count
    descending, capped at `limit`. Revenue is in cents.
    """
    bookings = (
        select(AppointmentService.service_id, func.count(AppointmentService.id).label("booking_count"))
        .group_by(AppointmentService.service_id)
        .subquery()
    )
    revenue = (
        select(Payment.service_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")  # only paid payments count as revenue
        .group_by(Payment.service_id)
        .subquery()
    )
    query = (
        select(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.coalesce(bookings.c.booking_count, 0).label("booking_count"),
            func.coalesce(revenue.c.revenue_cents, 0).label("revenue_cents"),
        )
        .outerjoin(bookings, bookings.c.service_id == Service.id)
        .outerjoin(revenue, revenue.c.service_id == Service.id)
        .order_by(func.coalesce(bookings.c.booking_count, 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [
        TopServiceItem(
            service_id=row.service_id, service_name=row.service_name,
            booking_count=row.booking_count, revenue_cents=int(row.revenue_cents),
        )
        for row in rows
    ]


async def get_provider_utilization(db: AsyncSession) -> list[ProviderUtilizationItem]:
    """Return per-provider appointment counts and revenue, busiest first.

    Appointment count comes from `AppointmentService` (how many
    service-slots the provider performed); revenue comes from `Payment`
    (sum of `amount` for `status == "paid"` payments attributed to that
    provider). As in `get_top_services`, these are two INDEPENDENT
    `GROUP BY` subqueries outer-joined 1:1 onto `Provider`, not a single
    join across both child tables — see the module docstring for why that
    matters (it would double-count revenue for providers with more than
    one row in both child tables). Revenue is in cents.
    """
    appointment_counts = (
        select(AppointmentService.provider_id, func.count(AppointmentService.id).label("appointment_count"))
        .group_by(AppointmentService.provider_id)
        .subquery()
    )
    revenue = (
        select(Payment.provider_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")  # only paid payments count as revenue
        .group_by(Payment.provider_id)
        .subquery()
    )
    query = (
        select(
            Provider.id.label("provider_id"),
            (Provider.first_name + " " + Provider.last_name).label("provider_name"),
            func.coalesce(appointment_counts.c.appointment_count, 0).label("appointment_count"),
            func.coalesce(revenue.c.revenue_cents, 0).label("revenue_cents"),
        )
        .outerjoin(appointment_counts, appointment_counts.c.provider_id == Provider.id)
        .outerjoin(revenue, revenue.c.provider_id == Provider.id)
        .order_by(func.coalesce(appointment_counts.c.appointment_count, 0).desc())
    )
    rows = (await db.execute(query)).all()
    return [
        ProviderUtilizationItem(
            provider_id=row.provider_id, provider_name=row.provider_name,
            appointment_count=row.appointment_count, revenue_cents=int(row.revenue_cents),
        )
        for row in rows
    ]


async def get_appointment_status_breakdown(db: AsyncSession) -> list[AppointmentStatusItem]:
    """Return appointment counts grouped by status (pending/confirmed/cancelled), most common first.

    `GROUP BY` alone gives no ordering guarantee — Postgres is free to
    return rows in whatever order its query plan finds convenient, which
    can vary between runs. Explicit `ORDER BY count DESC` makes the chart
    deterministic rather than shuffling on every page load.
    """
    query = (
        select(Appointment.status, func.count(Appointment.id).label("count"))
        .group_by(Appointment.status)
        .order_by(func.count(Appointment.id).desc())
    )
    rows = (await db.execute(query)).all()
    return [AppointmentStatusItem(status=row.status, count=row.count) for row in rows]


async def get_payment_status_breakdown(db: AsyncSession) -> list[PaymentStatusItem]:
    """Return payment counts grouped by status (pending/paid/failed), most common first.

    See `get_appointment_status_breakdown` for why the explicit `ORDER BY`
    matters — `GROUP BY` alone doesn't guarantee a stable row order.
    """
    query = (
        select(Payment.status, func.count(Payment.id).label("count"))
        .group_by(Payment.status)
        .order_by(func.count(Payment.id).desc())
    )
    rows = (await db.execute(query)).all()
    return [PaymentStatusItem(status=row.status, count=row.count) for row in rows]


async def get_patient_demographics(db: AsyncSession) -> DemographicsResponse:
    """Return patient counts by gender and by age bucket.

    Age is computed in SQL from `Patient.date_of_birth` (via `age(now(), dob)`)
    and bucketed into fixed 10-year bands (18-24, 25-34, ..., 65+) using a
    SQL `CASE` expression, so bucketing happens server-side rather than by
    pulling every patient into Python.

    `gender_breakdown` is ordered most-common-first, like every other
    breakdown chart in this app. `age_buckets`, however, is a genuine scale
    (younger to older), not an arbitrary category — ordering it by count
    would scramble it, so it's explicitly ordered chronologically by each
    bucket's starting age instead, via a second `CASE` that maps each
    bucket label to its ordinal position.
    """
    gender_rows = (await db.execute(
        select(Patient.gender, func.count(Patient.id).label("count"))
        .group_by(Patient.gender)
        .order_by(func.count(Patient.id).desc())
    )).all()
    gender_breakdown = [GenderCount(gender=row.gender, count=row.count) for row in gender_rows]

    age_years = extract("year", func.age(func.now(), Patient.date_of_birth))
    bucket = case(
        (age_years < 25, "18-24"),
        (age_years < 35, "25-34"),
        (age_years < 45, "35-44"),
        (age_years < 55, "45-54"),
        (age_years < 65, "55-64"),
        else_="65+",
    ).label("bucket")
    # `GROUP BY bucket` on its own has no notion that "25-34" comes after
    # "18-24" — it's just grouping equal strings. This second CASE re-derives
    # each row's ordinal position (0..5) from the same age thresholds above,
    # purely so ORDER BY has something chronological to sort on.
    bucket_order = case(
        (age_years < 25, 0),
        (age_years < 35, 1),
        (age_years < 45, 2),
        (age_years < 55, 3),
        (age_years < 65, 4),
        else_=5,
    )
    bucket_rows = (await db.execute(
        select(bucket, func.count(Patient.id).label("count"))
        .group_by(bucket)
        .order_by(func.min(bucket_order))
    )).all()
    age_buckets = [AgeBucketCount(bucket=row.bucket, count=row.count) for row in bucket_rows]

    return DemographicsResponse(gender_breakdown=gender_breakdown, age_buckets=age_buckets)
