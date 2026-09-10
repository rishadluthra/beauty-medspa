from app.repositories.analytics import get_appointment_status_breakdown, get_provider_utilization
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_provider_utilization_does_not_double_count_revenue(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(id="prv_1"), make_service(id="svc_1"),
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", provider_id="prv_1", service_id="svc_1"),
        make_appointment_service(appointment_id="apt_2", provider_id="prv_1", service_id="svc_1"),
    ])
    db_session.add(make_payment(id="pay_1", amount=20000, status="paid", provider_id="prv_1", appointment_id="apt_1"))
    await db_session.commit()

    rows = await get_provider_utilization(db_session)

    assert len(rows) == 1
    assert rows[0].appointment_count == 2
    assert rows[0].revenue_cents == 20000


async def test_appointment_status_breakdown_counts_each_status(db_session):
    db_session.add_all([
        make_patient(id="pat_1"),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="cancelled"),
        make_appointment(id="apt_3", patient_id="pat_1", status="cancelled"),
    ])
    await db_session.commit()

    rows = await get_appointment_status_breakdown(db_session)

    assert {r.status: r.count for r in rows} == {"confirmed": 1, "cancelled": 2}
