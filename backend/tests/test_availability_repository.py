"""Tests for the walk-in availability checker's data-access layer."""

from datetime import datetime

from app.repositories.availability import check_availability, get_default_availability_check_time
from app.repositories.patients import get_reference_now
from tests.factories import make_appointment, make_appointment_service, make_patient, make_provider, make_service


async def test_check_availability_returns_none_for_unknown_service(db_session):
    result = await check_availability(db_session, "svc_does_not_exist", datetime(2026, 1, 1, 10, 0))
    assert result is None


async def test_check_availability_flags_overlapping_bookings_and_leaves_others_free(db_session):
    """Covers the core interval-overlap contract with one seeded scenario:

    - prv_busy has a booking that overlaps the requested [10:00, 10:30) window entirely
      -> unavailable, busy_until is that booking's end time.
    - prv_adjacent has a booking ending exactly at 10:00 (touching, not overlapping)
      -> available. Back-to-back bookings must not be flagged as conflicts.
    - prv_free has no bookings at all that day -> available.
    - A cancelled booking that would otherwise overlap (prv_cancelled) does not count.
    """
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_busy", first_name="Busy", last_name="Provider"),
        make_provider(id="prv_adjacent", first_name="Adjacent", last_name="Provider"),
        make_provider(id="prv_free", first_name="Free", last_name="Provider"),
        make_provider(id="prv_cancelled", first_name="Cancelled", last_name="Provider"),
        make_service(id="svc_1", name="Botox Injection", duration=30),
        make_appointment(id="apt_busy", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_adjacent", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_cancelled", patient_id="pat_1", status="cancelled"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_busy", provider_id="prv_busy",
            start=datetime(2026, 1, 1, 9, 45), end=datetime(2026, 1, 1, 10, 15),
        ),
        make_appointment_service(
            appointment_id="apt_adjacent", provider_id="prv_adjacent",
            start=datetime(2026, 1, 1, 9, 30), end=datetime(2026, 1, 1, 10, 0),
        ),
        make_appointment_service(
            appointment_id="apt_cancelled", provider_id="prv_cancelled",
            start=datetime(2026, 1, 1, 9, 45), end=datetime(2026, 1, 1, 10, 15),
        ),
    ])
    await db_session.commit()

    result = await check_availability(db_session, "svc_1", datetime(2026, 1, 1, 10, 0))

    assert result.service_name == "Botox Injection"
    assert result.service_duration_minutes == 30
    by_id = {p.provider_id: p for p in result.providers}
    assert by_id["prv_busy"].available is False
    assert by_id["prv_busy"].busy_until == datetime(2026, 1, 1, 10, 15)
    assert by_id["prv_adjacent"].available is True
    assert by_id["prv_adjacent"].busy_until is None
    assert by_id["prv_free"].available is True
    assert by_id["prv_cancelled"].available is True  # cancelled booking doesn't block


async def test_check_availability_sorts_available_providers_first(db_session):
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_a", first_name="A", last_name="A"),
        make_provider(id="prv_b", first_name="B", last_name="B"),
        make_service(id="svc_1", duration=30),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_1", provider_id="prv_a",
            start=datetime(2026, 1, 1, 9, 45), end=datetime(2026, 1, 1, 10, 15),
        ),
    ])
    await db_session.commit()

    result = await check_availability(db_session, "svc_1", datetime(2026, 1, 1, 10, 0))

    assert [p.provider_id for p in result.providers] == ["prv_b", "prv_a"]  # available (B) before busy (A)


async def test_get_default_availability_check_time_uses_the_reference_days_date(db_session):
    """The default check time's DATE must be the dataset's reference day (not the real
    current date, which would fall outside this frozen dataset's booked schedule) -- see
    `get_default_availability_check_time`.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 12, 10, 9, 0), end=datetime(2025, 12, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_2", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),  # sets reference month to Dec 2025
    ])
    await db_session.commit()

    reference_now = await get_reference_now(db_session)
    result = await get_default_availability_check_time(db_session)

    assert result.date() == reference_now.date()
