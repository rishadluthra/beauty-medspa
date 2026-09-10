from datetime import datetime

from app.repositories.analytics import get_patient_demographics
from tests.factories import make_patient


async def test_demographics_buckets_by_gender_and_age(db_session):
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
