"""Tests for the patients repository's data-access/query layer.

These exercise `list_patients` directly against the DB (bypassing the
HTTP layer -- see test_patients_router.py for that), covering the
aggregation logic (spend totals, appointment counts) and filtering.
"""

from datetime import date, datetime

from app.repositories.patients import PatientFilters, list_patients
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_list_patients_returns_paid_total_and_appointment_count(db_session):
    """A patient's total_spent_cents only sums "paid" payments, ignoring failed/pending ones.

    Patient has one appointment and two payments (one paid, one failed);
    the failed payment must be excluded from total_spent_cents while the
    appointment is still counted once.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", patient_id="pat_1", amount=10000, status="paid"),
        make_payment(id="pay_2", patient_id="pat_1", amount=5000, status="failed"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters())

    assert result.total == 1
    item = result.items[0]
    assert item.appointment_count == 1
    assert item.total_spent_cents == 10000


async def test_list_patients_filters_by_source(db_session):
    """PatientFilters(source=...) restricts results to patients from that marketing channel only."""
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="google"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(source="instagram"))

    assert result.total == 1
    assert result.items[0].id == "pat_1"


async def test_list_patients_filters_by_created_date_range(db_session):
    """created_from/created_to bound Patient.created_date, and created_to is inclusive of its whole day.

    Three patients created on Jan 5, Jan 15 (at 23:30, near end of day), and
    Jan 25. Filtering created_from=Jan 10 to created_to=Jan 15 must include
    the Jan 15 23:30 patient (proving created_to isn't just midnight) while
    excluding Jan 5 and Jan 25.
    """
    db_session.add_all([
        make_patient(id="pat_1", created_date=datetime(2026, 1, 5, 9, 0)),
        make_patient(id="pat_2", created_date=datetime(2026, 1, 15, 23, 30)),
        make_patient(id="pat_3", created_date=datetime(2026, 1, 25, 9, 0)),
    ])
    await db_session.commit()

    result = await list_patients(
        db_session, PatientFilters(created_from=datetime(2026, 1, 10).date(), created_to=datetime(2026, 1, 15).date()),
    )

    assert result.total == 1
    assert result.items[0].id == "pat_2"


async def test_list_patients_filters_by_age_range_inclusive_at_both_boundaries(db_session):
    """age_min/age_max bound age-as-of-today (derived from date_of_birth), inclusive on both ends.

    Four patients who turn exactly 19, 20, 30, and 31 today (i.e. born
    exactly that many years ago). Filtering age_min=20, age_max=30 must
    include the patients turning exactly 20 and exactly 30 today (proving
    both boundaries are inclusive, not just the range's interior) while
    excluding the ones turning 19 (too young) and 31 (too old).
    """
    today = date.today()

    def dob_n_years_ago(years: int) -> datetime:
        d = today.replace(year=today.year - years)
        return datetime(d.year, d.month, d.day)

    db_session.add_all([
        make_patient(id="pat_19", date_of_birth=dob_n_years_ago(19)),
        make_patient(id="pat_20", date_of_birth=dob_n_years_ago(20)),
        make_patient(id="pat_30", date_of_birth=dob_n_years_ago(30)),
        make_patient(id="pat_31", date_of_birth=dob_n_years_ago(31)),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(age_min=20, age_max=30))

    assert {item.id for item in result.items} == {"pat_20", "pat_30"}
