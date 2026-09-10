import asyncio
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service

SEED_DATA_DIR = Path(__file__).resolve().parents[3] / "seed_data"


def _load_json(filename: str) -> list[dict]:
    with open(SEED_DATA_DIR / filename) as f:
        return json.load(f)


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


async def load_seed_data(session: AsyncSession) -> None:
    await session.execute(delete(Payment))
    await session.execute(delete(AppointmentService))
    await session.execute(delete(Appointment))
    await session.execute(delete(Service))
    await session.execute(delete(Provider))
    await session.execute(delete(Patient))

    for row in _load_json("patient.json"):
        session.add(Patient(
            id=row["id"], first_name=row["first_name"], last_name=row["last_name"],
            date_of_birth=_parse_dt(row["date_of_birth"]), gender=row["gender"],
            address=row["address"], phone=row["phone"], email=row["email"],
            source=row["source"], created_date=_parse_dt(row["created_date"]),
        ))

    for row in _load_json("provider.json"):
        session.add(Provider(
            id=row["id"], first_name=row["first_name"], last_name=row["last_name"],
            email=row["email"], phone=row["phone"],
            created_date=_parse_dt(row["created_date"]),
        ))

    for row in _load_json("service.json"):
        session.add(Service(
            id=row["id"], name=row["name"], description=row["description"],
            price=row["price"], duration=row["duration"],
            created_date=_parse_dt(row["created_date"]),
        ))

    await session.flush()

    for row in _load_json("appointment.json"):
        session.add(Appointment(
            id=row["id"], patient_id=row["patient_id"], status=row["status"],
            created_date=_parse_dt(row["created_date"]),
        ))

    await session.flush()

    for row in _load_json("appointment_service.json"):
        session.add(AppointmentService(
            appointment_id=row["appointment_id"], service_id=row["service_id"],
            provider_id=row["provider_id"], start=_parse_dt(row["start"]),
            end=_parse_dt(row["end"]),
        ))

    for row in _load_json("payment.json"):
        session.add(Payment(
            id=row["id"], patient_id=row["patient_id"], amount=row["amount"],
            date=_parse_dt(row["date"]), method=row["method"], status=row["status"],
            provider_id=row["provider_id"], appointment_id=row["appointment_id"],
            service_id=row["service_id"], created_date=_parse_dt(row["created_date"]),
        ))

    await session.commit()


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await load_seed_data(session)


if __name__ == "__main__":
    asyncio.run(main())
