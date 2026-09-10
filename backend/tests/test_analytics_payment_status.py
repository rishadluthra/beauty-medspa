"""Tests for the analytics repository's payment-status breakdown view."""

from app.repositories.analytics import get_payment_status_breakdown
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_payment_status_breakdown_counts_each_status(db_session):
    """Payments are grouped and counted by their own status (paid/pending/failed),
    which is tracked independently of appointment status.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", status="paid"),
        make_payment(id="pay_2", status="pending"),
        make_payment(id="pay_3", status="pending"),
        make_payment(id="pay_4", status="failed"),
    ])
    await db_session.commit()

    rows = await get_payment_status_breakdown(db_session)

    assert {r.status: r.count for r in rows} == {"paid": 1, "pending": 2, "failed": 1}
