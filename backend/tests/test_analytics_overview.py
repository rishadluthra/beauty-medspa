"""Tests for the analytics repository's top-level overview stats and revenue trend.

Covers app.repositories.analytics.get_overview_stats (the summary tiles
on the Analytics Dashboard: totals, average transaction, cancellation
rate) and get_revenue_over_time (the revenue-by-month series).
"""

from datetime import datetime

from app.repositories.analytics import get_overview_stats, get_revenue_over_time
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_overview_counts_only_paid_revenue_and_computes_cancellation_rate(db_session):
    """Revenue/avg-transaction figures include only "paid" payments, and cancellation
    rate is (cancelled appointments / total appointments) -- here 1 of 2 cancelled = 0.5.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="cancelled"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", amount=10000, status="paid", appointment_id="apt_1"),
        make_payment(id="pay_2", amount=5000, status="failed", appointment_id="apt_1"),
    ])
    await db_session.commit()

    stats = await get_overview_stats(db_session)

    assert stats.total_patients == 1
    assert stats.total_appointments == 2
    assert stats.total_revenue_cents == 10000
    assert stats.avg_transaction_cents == 10000
    assert stats.cancellation_rate == 0.5


async def test_revenue_over_time_groups_paid_payments_by_month(db_session):
    """Paid payments are bucketed and summed by calendar month (YYYY-MM), across month boundaries."""
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", amount=10000, status="paid", date=datetime(2026, 1, 15)),
        make_payment(id="pay_2", amount=20000, status="paid", date=datetime(2026, 1, 20)),
        make_payment(id="pay_3", amount=5000, status="paid", date=datetime(2026, 2, 1)),
    ])
    await db_session.commit()

    points = await get_revenue_over_time(db_session)

    assert {p.period: p.revenue_cents for p in points} == {"2026-01": 30000, "2026-02": 5000}
