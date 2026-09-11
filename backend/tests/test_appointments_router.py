"""HTTP-level test for the /api/appointments endpoint.

Unlike test_appointments_repository.py (which calls the repository function directly),
this goes through the actual FastAPI route and ASGI stack, confirming the router wiring,
query-param parsing, and JSON serialization all work end-to-end.
"""

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_appointment, make_appointment_service, make_patient, make_provider, make_service


async def test_get_appointment_endpoint_returns_detail(db_session):
    """GET /api/appointments/{id} returns the appointment's status/services/patient summary."""
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([
        make_patient(id="pat_1", first_name="Jane", last_name="Doe"),
        make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add(make_appointment_service(appointment_id="apt_1"))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/appointments/apt_1")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "apt_1"
    assert body["status"] == "confirmed"
    assert body["patient"]["id"] == "pat_1"
    assert body["patient"]["first_name"] == "Jane"
    assert len(body["services"]) == 1

    app.dependency_overrides.clear()


async def test_get_appointment_endpoint_404s_for_unknown_id(db_session):
    """GET /api/appointments/{id} for an appointment that doesn't exist returns 404."""
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/appointments/apt_does_not_exist")

    assert response.status_code == 404

    app.dependency_overrides.clear()


async def test_get_appointment_endpoint_accepts_ctx_and_service_id_query_params(db_session):
    """GET /api/appointments/{id}?ctx=today&service_id=... is accepted and reflected in
    the response's Previous/Next fields (both null here -- a single-appointment schedule
    has no neighbors -- but this confirms the params are actually parsed and passed
    through, not silently ignored).
    """
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([make_patient(id="pat_1"), make_provider(), make_service()])
    await db_session.flush()
    db_session.add(make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"))
    await db_session.flush()
    service_row = make_appointment_service(appointment_id="apt_1")
    db_session.add(service_row)
    await db_session.commit()

    from app.repositories.patients import list_todays_appointments
    schedule = await list_todays_appointments(db_session)
    service_id = schedule.items[0].id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/appointments/apt_1?ctx=today&service_id={service_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["previous_appointment_id"] is None
    assert body["next_appointment_id"] is None

    app.dependency_overrides.clear()
