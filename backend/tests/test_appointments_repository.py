"""Tests for the appointments repository's data-access/query layer.

Exercises `get_appointment_detail` directly against the DB (bypassing the HTTP layer --
see test_appointments_router.py for that): the appointment's own detail, its Previous/
Next within a schedule window, and the highlighted-service-row behavior.
"""

from datetime import datetime

from app.repositories.appointments import ScheduleContext, get_appointment_detail
from app.repositories.patients import list_todays_appointments
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_get_appointment_detail_returns_none_for_unknown_id(db_session):
    result = await get_appointment_detail(db_session, "apt_does_not_exist", None, ScheduleContext())
    assert result is None


async def test_get_appointment_detail_includes_patient_summary_services_and_payment(db_session):
    """Covers the basic shape: status, its one service (with provider/time/price),
    payment, and a compact patient summary -- not the patient's full profile/history.
    """
    db_session.add_all([
        make_patient(id="pat_1", first_name="Jane", last_name="Doe", phone="555-0100", email="jane@example.com"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_service(id="svc_1", name="Botox Injection", price=30000),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_1", service_id="svc_1", provider_id="prv_1",
            start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30),
        ),
        make_payment(id="pay_1", patient_id="pat_1", appointment_id="apt_1", amount=30000, status="paid"),
    ])
    await db_session.commit()

    result = await get_appointment_detail(db_session, "apt_1", None, ScheduleContext())

    assert result.id == "apt_1"
    assert result.status == "confirmed"
    assert result.appointment_date == datetime(2026, 1, 1, 9, 0)
    assert result.patient.id == "pat_1"
    assert result.patient.first_name == "Jane"
    assert result.patient.phone == "555-0100"
    assert len(result.services) == 1
    assert result.services[0].service_name == "Botox Injection"
    assert result.services[0].provider_name == "Dr Smith"
    assert result.payment.amount_cents == 30000
    assert result.payment.status == "paid"


async def test_get_appointment_detail_with_no_payment_reports_none(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="pending"),
    ])
    await db_session.flush()
    db_session.add(make_appointment_service(appointment_id="apt_1"))
    await db_session.commit()

    result = await get_appointment_detail(db_session, "apt_1", None, ScheduleContext())
    assert result.payment is None


async def test_get_appointment_detail_highlights_the_clicked_service_among_several(db_session):
    """When an appointment bundles multiple services (e.g. consultation, then an X-ray,
    at different times/providers), `highlighted_service_start` must match whichever
    specific row `service_id` points to -- not just the first or last one -- so the
    frontend can bold the row the agent actually clicked, not an arbitrary one.
    """
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_1", first_name="Ann", last_name="Early"),
        make_provider(id="prv_2", first_name="Bob", last_name="Late"),
        make_service(id="svc_1", name="Consultation"),
        make_service(id="svc_2", name="X-Ray"),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_1", service_id="svc_1", provider_id="prv_1",
            start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30),
        ),
        make_appointment_service(
            appointment_id="apt_1", service_id="svc_2", provider_id="prv_2",
            start=datetime(2026, 1, 1, 10, 0), end=datetime(2026, 1, 1, 10, 30),
        ),
    ])
    await db_session.commit()

    schedule = await list_todays_appointments(db_session)
    xray_service_id = next(item.id for item in schedule.items if item.service_name == "X-Ray")

    result = await get_appointment_detail(db_session, "apt_1", xray_service_id, ScheduleContext())
    assert len(result.services) == 2
    assert result.highlighted_service_start == datetime(2026, 1, 1, 10, 0)  # the X-Ray row, not the Consultation one


async def test_get_appointment_detail_previous_next_walk_todays_schedule_order_and_advance_on_second_hop(db_session):
    """Previous/Next walk the same chronological schedule order `list_todays_appointments`
    displays. Includes the exact "second hop" regression check this feature's own
    ancestor (Patient Detail's old ctx=today ranking) needed and didn't have: simulating
    a real click-through must advance to a genuinely different appointment each time,
    not get stuck re-ranking against a stale anchor.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_patient(id="pat_c", first_name="Carol", last_name="Carter"),
        make_provider(), make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_c", patient_id="pat_c", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_a_later", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_c", start=datetime(2026, 1, 1, 14, 0), end=datetime(2026, 1, 1, 14, 30)),
    ])
    await db_session.commit()

    schedule = await list_todays_appointments(db_session)
    a_service_id = next(item.id for item in schedule.items if item.patient_id == "pat_a")
    b_service_id = next(item.id for item in schedule.items if item.patient_id == "pat_b")

    detail_a = await get_appointment_detail(db_session, "apt_a", a_service_id, ScheduleContext())
    assert detail_a.previous_appointment_id is None
    assert detail_a.next_appointment_id == "apt_b"
    assert detail_a.next_service_id == b_service_id

    # First hop: land on apt_b using apt_a's own next_service_id (not the original
    # a_service_id) -- this is exactly what the frontend's real click-through does.
    detail_b = await get_appointment_detail(db_session, "apt_b", detail_a.next_service_id, ScheduleContext())
    assert detail_b.previous_appointment_id == "apt_a"
    assert detail_b.next_appointment_id == "apt_c"

    # Second hop, using detail_b's OWN next_service_id: must advance to a genuinely
    # different appointment (apt_c), not loop back to apt_a or re-show apt_b.
    detail_c = await get_appointment_detail(db_session, "apt_c", detail_b.next_service_id, ScheduleContext())
    assert detail_c.previous_appointment_id == "apt_b"
    assert detail_c.next_appointment_id is None


async def test_get_appointment_detail_provider_filter_narrows_the_schedule_window(db_session):
    """`ScheduleContext(provider_id=...)` narrows Previous/Next the same way
    `list_todays_appointments(provider_id=...)` narrows the displayed schedule.
    """
    db_session.add_all([
        make_patient(id="pat_a"), make_patient(id="pat_b"), make_patient(id="pat_c"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_c", patient_id="pat_c", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", provider_id="prv_1", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_a_later", provider_id="prv_1", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b", provider_id="prv_2", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_c", provider_id="prv_1", start=datetime(2026, 1, 1, 14, 0), end=datetime(2026, 1, 1, 14, 30)),
    ])
    await db_session.commit()

    prv1_schedule = await list_todays_appointments(db_session, provider_id="prv_1")
    a_service_id = next(item.id for item in prv1_schedule.items if item.patient_id == "pat_a")

    result = await get_appointment_detail(
        db_session, "apt_a", a_service_id, ScheduleContext(provider_id="prv_1"),
    )
    assert result.previous_appointment_id is None
    assert result.next_appointment_id == "apt_c"  # pat_b's Dr Jones slot is filtered out


async def test_get_appointment_detail_service_filter_narrows_the_schedule_window(db_session):
    """`ScheduleContext(filter_service_id=...)` narrows Previous/Next the same way
    `list_todays_appointments(service_id=...)` narrows the displayed schedule -- mirrors
    the analogous provider_id test above.
    """
    db_session.add_all([
        make_patient(id="pat_a"), make_patient(id="pat_b"), make_patient(id="pat_c"),
        make_provider(),
        make_service(id="svc_1", name="Consultation"),
        make_service(id="svc_2", name="Facial"),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_c", patient_id="pat_c", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", service_id="svc_1", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_a_later", service_id="svc_1", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b", service_id="svc_2", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_c", service_id="svc_1", start=datetime(2026, 1, 1, 14, 0), end=datetime(2026, 1, 1, 14, 30)),
    ])
    await db_session.commit()

    consultation_schedule = await list_todays_appointments(db_session, service_id="svc_1")
    a_service_id = next(item.id for item in consultation_schedule.items if item.patient_id == "pat_a")

    result = await get_appointment_detail(
        db_session, "apt_a", a_service_id, ScheduleContext(filter_service_id="svc_1"),
    )
    assert result.previous_appointment_id is None
    assert result.next_appointment_id == "apt_c"  # pat_b's Facial slot is filtered out


async def test_get_appointment_detail_sort_changes_previous_next_order(db_session):
    """`ScheduleContext(sort=...)` walks Previous/Next in whatever order that sort picks
    (see `_schedule_sort_expressions`) -- not always chronological.
    """
    db_session.add_all([
        make_patient(id="pat_z", first_name="Zed", last_name="Zeta"),
        make_patient(id="pat_a", first_name="Amy", last_name="Alpha"),
        make_patient(id="pat_m", first_name="Mia", last_name="Mid"),
        make_provider(), make_service(),
        make_appointment(id="apt_z", patient_id="pat_z", status="confirmed"),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_m", patient_id="pat_m", status="confirmed"),
        make_appointment(id="apt_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_z", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_a", start=datetime(2026, 1, 1, 10, 0), end=datetime(2026, 1, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_m", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_later", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
    ])
    await db_session.commit()

    by_patient_name = await list_todays_appointments(db_session, sort="patient_name")
    m_service_id = next(item.id for item in by_patient_name.items if item.patient_id == "pat_m")

    # Chronologically apt_m (11:00) sits between apt_a (10:00) and nothing after it, but
    # sorted by patient_name (Alpha, Mid, Zeta) its neighbors are pat_a before and pat_z after.
    result = await get_appointment_detail(
        db_session, "apt_m", m_service_id, ScheduleContext(sort="patient_name"),
    )
    assert result.previous_appointment_id == "apt_a"
    assert result.next_appointment_id == "apt_z"

    # sort_dir="desc" reverses the same sort key's order (Zeta, Mid, Alpha) -- proves
    # direction, not just the sort key itself, is honored in Previous/Next too.
    desc_result = await get_appointment_detail(
        db_session, "apt_m", m_service_id, ScheduleContext(sort="patient_name", sort_dir="desc"),
    )
    assert desc_result.previous_appointment_id == "apt_z"
    assert desc_result.next_appointment_id == "apt_a"


async def test_get_appointment_detail_day_context_targets_the_given_date_not_the_reference_day(db_session):
    """`ScheduleContext(kind="day", target_date=...)` scopes Previous/Next to that
    specific calendar day's schedule, not the dataset's reference "today".
    """
    db_session.add_all([
        make_patient(id="pat_target"), make_patient(id="pat_other_day"),
        make_provider(), make_service(),
        make_appointment(id="apt_target", patient_id="pat_target", status="confirmed"),
        make_appointment(id="apt_other_day", patient_id="pat_other_day", status="confirmed"),
        make_appointment(id="apt_later", patient_id="pat_other_day", status="confirmed"),  # sets the latest data month
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_target", start=datetime(2026, 1, 15, 9, 0), end=datetime(2026, 1, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_other_day", start=datetime(2026, 1, 16, 9, 0), end=datetime(2026, 1, 16, 9, 30)),
        make_appointment_service(appointment_id="apt_later", start=datetime(2026, 3, 1, 10, 0), end=datetime(2026, 3, 1, 10, 30)),
    ])
    await db_session.commit()

    from app.repositories.patients import list_schedule_for_date
    day_schedule = await list_schedule_for_date(db_session, datetime(2026, 1, 15).date())
    service_id = day_schedule.items[0].id

    result = await get_appointment_detail(
        db_session, "apt_target", service_id, ScheduleContext(kind="day", target_date=datetime(2026, 1, 15).date()),
    )
    assert result.previous_appointment_id is None
    assert result.next_appointment_id is None  # apt_other_day is on a different day, out of this window
