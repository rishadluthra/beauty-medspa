"""Repository-level tests for the self-serve "Build Custom Analytics" feature."""

from datetime import datetime

from app.repositories.custom_reports import (
    count_custom_reports,
    create_custom_report,
    delete_custom_report,
    get_custom_report_data,
    list_custom_reports,
)
from app.schemas.custom_reports import Dimension, Metric, TimeGrain
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_get_custom_report_data_revenue_by_provider_by_month(db_session):
    """Revenue-by-provider-by-month sums only paid payments, grouped per (period, provider)."""
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_1", first_name="Ada", last_name="Lin"),
        make_provider(id="prv_2", first_name="Bo", last_name="Shaw"),
        make_service(),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),
        make_appointment(id="apt_3", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        # Two paid January payments to prv_1 -> should sum to 300 in one bucket.
        make_payment(id="pay_1", appointment_id="apt_1", provider_id="prv_1", amount=10000, status="paid", date=datetime(2025, 1, 5)),
        make_payment(id="pay_2", appointment_id="apt_1", provider_id="prv_1", amount=20000, status="paid", date=datetime(2025, 1, 20)),
        # A pending payment must not count toward revenue.
        make_payment(id="pay_3", appointment_id="apt_2", provider_id="prv_1", amount=99999, status="pending", date=datetime(2025, 1, 10)),
        # A different provider, different month.
        make_payment(id="pay_4", appointment_id="apt_3", provider_id="prv_2", amount=5000, status="paid", date=datetime(2025, 2, 1)),
    ])
    await db_session.commit()

    data = await get_custom_report_data(db_session, Metric.revenue_cents, Dimension.provider, TimeGrain.month)

    by_key = {(p.period, p.dimension_value): p.value for p in data}
    assert by_key[("2025-01", "Ada Lin")] == 30000
    assert by_key[("2025-02", "Bo Shaw")] == 5000
    assert ("2025-01", "Bo Shaw") not in by_key


async def test_get_custom_report_data_appointment_count_by_source_by_quarter(db_session):
    """Appointment count by marketing source, bucketed by quarter, sourced from AppointmentService."""
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="google"),
        make_provider(), make_service(),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_2"),
    ])
    await db_session.flush()
    db_session.add_all([
        # Two service-slots in Q1 for the instagram patient.
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 1, 10, 9, 0), end=datetime(2025, 1, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 2, 15, 9, 0), end=datetime(2025, 2, 15, 9, 30)),
        # One service-slot in Q2 for the google patient.
        make_appointment_service(appointment_id="apt_2", start=datetime(2025, 4, 1, 9, 0), end=datetime(2025, 4, 1, 9, 30)),
    ])
    await db_session.commit()

    data = await get_custom_report_data(db_session, Metric.appointment_count, Dimension.source, TimeGrain.quarter)

    by_key = {(p.period, p.dimension_value): p.value for p in data}
    assert by_key[("2025-Q1", "instagram")] == 2
    assert by_key[("2025-Q2", "google")] == 1


async def test_get_custom_report_data_unique_patient_count_by_service(db_session):
    """Unique-patient count by service counts distinct patients, not distinct visits."""
    db_session.add_all([
        make_patient(id="pat_1"), make_patient(id="pat_2"),
        make_provider(), make_service(id="svc_1", name="Facial"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),  # same patient, second visit
        make_appointment(id="apt_3", patient_id="pat_2"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", service_id="svc_1", start=datetime(2025, 3, 1, 9, 0), end=datetime(2025, 3, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_2", service_id="svc_1", start=datetime(2025, 3, 15, 9, 0), end=datetime(2025, 3, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_3", service_id="svc_1", start=datetime(2025, 3, 20, 9, 0), end=datetime(2025, 3, 20, 9, 30)),
    ])
    await db_session.commit()

    data = await get_custom_report_data(db_session, Metric.unique_patient_count, Dimension.service, TimeGrain.month)

    assert len(data) == 1
    assert data[0].period == "2025-03"
    assert data[0].dimension_value == "Facial"
    assert data[0].value == 2  # pat_1 counted once despite 2 visits


async def test_create_list_and_delete_custom_report_roundtrip(db_session):
    """A created report is listed with its data, and can be deleted."""
    db_session.add_all([make_patient(id="pat_1"), make_provider(id="prv_1"), make_service()])
    await db_session.flush()
    db_session.add(make_appointment(id="apt_1", patient_id="pat_1"))
    await db_session.flush()
    db_session.add(make_payment(id="pay_1", appointment_id="apt_1", provider_id="prv_1", amount=15000, status="paid", date=datetime(2025, 6, 1)))
    await db_session.commit()

    created = await create_custom_report(
        db_session, title="Revenue by provider", metric=Metric.revenue_cents,
        dimension=Dimension.provider, time_grain=TimeGrain.month,
    )
    assert created.id.startswith("rpt_")
    assert await count_custom_reports(db_session) == 1

    listed = await list_custom_reports(db_session)
    assert [r.id for r in listed] == [created.id]

    deleted = await delete_custom_report(db_session, created.id)
    assert deleted is True
    assert await count_custom_reports(db_session) == 0

    assert await delete_custom_report(db_session, "rpt_does_not_exist") is False
