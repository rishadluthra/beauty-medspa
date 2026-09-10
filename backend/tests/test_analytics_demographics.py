"""Tests for the analytics repository's patient demographics breakdown.

Covers get_patient_demographics, which relies on Postgres-specific date
arithmetic (age calculation from date_of_birth) to bucket patients --
part of why db_session runs against real Postgres rather than SQLite
(see tests/conftest.py).
"""

from datetime import datetime

from app.repositories.analytics import get_patient_demographics
from tests.factories import make_patient


async def test_demographics_buckets_by_gender_and_age(db_session):
    """Patients are grouped by gender and bucketed into 10-year age ranges computed from date_of_birth.

    A 30-year-old and a 60-year-old patient should land in the "25-34"
    and "55-64" buckets respectively.
    """
    now = datetime.utcnow()
    db_session.add_all([
        make_patient(id="pat_1", gender="female", date_of_birth=now.replace(year=now.year - 30)),
        make_patient(id="pat_2", gender="male", date_of_birth=now.replace(year=now.year - 60)),
    ])
    await db_session.commit()

    result = await get_patient_demographics(db_session)

    assert {g.gender: g.count for g in result.gender_breakdown} == {"female": 1, "male": 1}
    buckets = {b.bucket: b.count for b in result.age_buckets}
    assert buckets["25-34"] == 1
    assert buckets["55-64"] == 1


async def test_demographics_age_buckets_are_chronologically_ordered(db_session):
    """age_buckets comes back youngest-to-oldest regardless of insertion order.

    `GROUP BY` alone gives no ordering guarantee, so this deliberately adds
    patients to the DB in a scrambled age order (65+ first, then 18-24,
    then 45-54) and asserts the *returned* bucket list is nonetheless
    strictly chronological — proving the fix orders by age, not insertion
    order or whatever order Postgres's query planner happens to produce.
    """
    now = datetime.utcnow()
    db_session.add_all([
        make_patient(id="pat_1", date_of_birth=now.replace(year=now.year - 70)),  # 65+
        make_patient(id="pat_2", date_of_birth=now.replace(year=now.year - 20)),  # 18-24
        make_patient(id="pat_3", date_of_birth=now.replace(year=now.year - 50)),  # 45-54
    ])
    await db_session.commit()

    result = await get_patient_demographics(db_session)

    bucket_labels = [b.bucket for b in result.age_buckets]
    assert bucket_labels == ["18-24", "45-54", "65+"]
