from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Patient, Payment
from app.schemas.patient import PatientListItem, PatientListResponse


@dataclass
class PatientFilters:
    search: str | None = None
    source: str | None = None
    gender: str | None = None


async def list_patients(
    db: AsyncSession,
    filters: PatientFilters,
    sort: str = "name",
    page: int = 1,
    page_size: int = 25,
) -> PatientListResponse:
    appointment_counts = (
        select(Appointment.patient_id, func.count(Appointment.id).label("appointment_count"))
        .group_by(Appointment.patient_id)
        .subquery()
    )
    payment_totals = (
        select(Payment.patient_id, func.sum(Payment.amount).label("total_spent_cents"))
        .where(Payment.status == "paid")
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
