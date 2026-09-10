from datetime import datetime, timedelta

from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.schemas.analytics import AgeBucketCount, AppointmentStatusItem, DemographicsResponse, GenderCount, OverviewStats, ProviderUtilizationItem, RevenuePoint, SourceBreakdownItem, TopServiceItem


async def get_overview_stats(db: AsyncSession) -> OverviewStats:
    total_patients = (await db.execute(select(func.count(Patient.id)))).scalar_one()

    paid = select(Payment.amount).where(Payment.status == "paid").subquery()
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
    query = (
        select(Patient.source, func.count(Patient.id).label("patient_count"))
        .group_by(Patient.source)
        .order_by(func.count(Patient.id).desc())
    )
    rows = (await db.execute(query)).all()
    return [SourceBreakdownItem(source=row.source, patient_count=row.patient_count) for row in rows]


async def get_top_services(db: AsyncSession, limit: int = 10) -> list[TopServiceItem]:
    bookings = (
        select(AppointmentService.service_id, func.count(AppointmentService.id).label("booking_count"))
        .group_by(AppointmentService.service_id)
        .subquery()
    )
    revenue = (
        select(Payment.service_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
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
    appointment_counts = (
        select(AppointmentService.provider_id, func.count(AppointmentService.id).label("appointment_count"))
        .group_by(AppointmentService.provider_id)
        .subquery()
    )
    revenue = (
        select(Payment.provider_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
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
    query = select(Appointment.status, func.count(Appointment.id).label("count")).group_by(Appointment.status)
    rows = (await db.execute(query)).all()
    return [AppointmentStatusItem(status=row.status, count=row.count) for row in rows]


async def get_patient_demographics(db: AsyncSession) -> DemographicsResponse:
    gender_rows = (await db.execute(
        select(Patient.gender, func.count(Patient.id).label("count")).group_by(Patient.gender)
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
    bucket_rows = (await db.execute(
        select(bucket, func.count(Patient.id).label("count")).group_by(bucket)
    )).all()
    age_buckets = [AgeBucketCount(bucket=row.bucket, count=row.count) for row in bucket_rows]

    return DemographicsResponse(gender_breakdown=gender_breakdown, age_buckets=age_buckets)
