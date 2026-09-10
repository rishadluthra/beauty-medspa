"""Tests for the analytics repository's patient-acquisition-source and top-services views."""

from app.repositories.analytics import get_patients_by_source, get_top_services
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_patients_by_source_counts_per_source(db_session):
    """Patients are grouped and counted by their acquisition `source` (marketing channel)."""
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="instagram"),
        make_patient(id="pat_3", source="google"),
    ])
    await db_session.commit()

    rows = await get_patients_by_source(db_session)

    assert {r.source: r.patient_count for r in rows} == {"instagram": 2, "google": 1}


async def test_top_services_does_not_double_count_revenue_across_multiple_bookings(db_session):
    """Regression test: revenue per service must not multiply when a service is booked
    across multiple appointment_services rows for the same appointment.

    Setup: one service ("Facial") is booked twice (on two separate
    appointments, apt_1 and apt_2), but there's only a single paid
    payment of $150 (on apt_1). A naive implementation that joins
    services -> appointment_services -> payments and sums payment amounts
    per joined row would double-count revenue (fan-out: 2 booking rows x
    1 payment row = 2 summed rows -> $300 instead of $150), since SQL
    joins duplicate the "one" side of a one-to-many relationship for each
    match on the "many" side. This is called out in the design doc as the
    highest-risk correctness area for the analytics queries -- the fix is
    to aggregate revenue from payments separately (e.g. via a subquery/
    pre-aggregation) rather than summing across a joined, fanned-out
    result set. Here booking_count (2) and revenue_cents (15000, not
    30000) must both be correct simultaneously.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(id="svc_1", name="Facial"),
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", service_id="svc_1"),
        make_appointment_service(appointment_id="apt_2", service_id="svc_1"),
    ])
    db_session.add(make_payment(id="pay_1", amount=15000, status="paid", appointment_id="apt_1", service_id="svc_1"))
    await db_session.commit()

    rows = await get_top_services(db_session)

    assert len(rows) == 1
    assert rows[0].booking_count == 2
    assert rows[0].revenue_cents == 15000
