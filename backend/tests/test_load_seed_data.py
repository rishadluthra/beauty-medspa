"""Tests for the seed data loader (app/seed/load_seed_data.py).

Verifies that the one-time ingestion script that populates Postgres from
the raw JSON fixtures in `seed_data/` (patient.json, payment.json, etc.)
loads the expected row counts and can be safely re-run.
"""

import json

from sqlalchemy import func, select

from app.models import Patient, Payment
from app.seed.load_seed_data import SEED_DATA_DIR, load_seed_data


def _expected_count(filename: str) -> int:
    """Read a seed JSON file directly and count its entries, as an independent oracle."""
    return len(json.loads((SEED_DATA_DIR / filename).read_text()))


async def test_load_seed_data_inserts_all_patients_and_payments(db_session):
    """Loading seed data once inserts exactly as many rows as are present in the source JSON files."""
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    actual_payments = (await db_session.execute(select(func.count(Payment.id)))).scalar_one()

    assert actual_patients == _expected_count("patient.json")
    assert actual_payments == _expected_count("payment.json")


async def test_load_seed_data_is_idempotent(db_session):
    """Running the loader twice does not duplicate data.

    The loader is a script that could legitimately be re-run in practice
    (e.g. re-seeding after a schema change), so it's expected to
    truncate-and-reload rather than blindly insert -- this guards against
    a regression where re-running it silently doubles up rows.
    """
    await load_seed_data(db_session)
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    assert actual_patients == _expected_count("patient.json")
