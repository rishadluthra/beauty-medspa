from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Patient, Payment
from app.schemas.analytics import OverviewStats, RevenuePoint


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
