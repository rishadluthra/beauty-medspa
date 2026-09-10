import json

from sqlalchemy import func, select

from app.models import Patient, Payment
from app.seed.load_seed_data import SEED_DATA_DIR, load_seed_data


def _expected_count(filename: str) -> int:
    return len(json.loads((SEED_DATA_DIR / filename).read_text()))


async def test_load_seed_data_inserts_all_patients_and_payments(db_session):
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    actual_payments = (await db_session.execute(select(func.count(Payment.id)))).scalar_one()

    assert actual_patients == _expected_count("patient.json")
    assert actual_payments == _expected_count("payment.json")


async def test_load_seed_data_is_idempotent(db_session):
    await load_seed_data(db_session)
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    assert actual_patients == _expected_count("patient.json")
