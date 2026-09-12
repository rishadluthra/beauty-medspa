"""HTTP-level test for the /api/patients endpoint.

Unlike test_patients_repository.py (which calls the repository function
directly), this goes through the actual FastAPI route and ASGI stack via
httpx's ASGITransport, confirming the router wiring, request handling,
and JSON serialization all work end-to-end.
"""

from datetime import datetime

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_appointment, make_appointment_service, make_patient, make_provider, make_service


async def test_get_patients_endpoint_returns_list(db_session):
    """GET /api/patients returns a paginated list body containing the seeded patient.

    The app's real `get_db` dependency is overridden with the test's
    `db_session` fixture so the request hits the isolated test database
    instead of a real connection pool/production DB.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add(make_patient(id="pat_1"))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == "pat_1"

    # Reset overrides so this test's DB override doesn't leak into other tests
    # sharing the same `app` instance.
    app.dependency_overrides.clear()


async def test_get_patient_endpoint_returns_detail(db_session):
    """GET /api/patients/{id} returns the patient's profile plus their (empty) appointment history."""
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add(make_patient(id="pat_1"))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/pat_1")

    assert response.status_code == 200
    body = response.json()
    assert body["patient"]["id"] == "pat_1"
    assert body["appointments"] == []

    app.dependency_overrides.clear()


async def test_get_patient_endpoint_404s_for_unknown_id(db_session):
    """GET /api/patients/{id} for a patient that doesn't exist returns 404, not 200 with empty/null data."""
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/pat_does_not_exist")

    assert response.status_code == 404

    app.dependency_overrides.clear()


async def test_get_upcoming_appointments_endpoint_is_reachable(db_session):
    """GET /api/patients/upcoming must resolve to its own handler, not fall through to
    /api/patients/{patient_id} with patient_id="upcoming" -- this only works because the
    static route is registered before the dynamic one in the router.
    """
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/upcoming")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert "reference_date" in body

    app.dependency_overrides.clear()


async def test_get_todays_appointments_endpoint_is_reachable(db_session):
    """GET /api/patients/today must resolve to its own handler, not fall through to
    /api/patients/{patient_id} with patient_id="today" -- same routing-order requirement
    as /api/patients/upcoming.
    """
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/today")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert "reference_date" in body

    app.dependency_overrides.clear()


async def test_get_todays_appointments_endpoint_accepts_service_id_and_sort_params(db_session):
    """GET /api/patients/today?service_id=...&sort=... is accepted (not a 422) and the
    params are genuinely parsed through to the repository -- confirms the router wiring
    for both new query params, not just that the route still resolves.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([make_patient(id="pat_1"), make_provider(), make_service(id="svc_1")])
    await db_session.flush()
    db_session.add(make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"))
    await db_session.flush()
    db_session.add(make_appointment_service(appointment_id="apt_1", service_id="svc_1", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        matching = await client.get("/api/patients/today?service_id=svc_1&sort=patient_name")
        non_matching = await client.get("/api/patients/today?service_id=svc_does_not_exist")

    assert matching.status_code == 200
    assert matching.json()["total"] == 1
    assert non_matching.status_code == 200
    assert non_matching.json()["total"] == 0

    app.dependency_overrides.clear()


async def test_get_rebooking_opportunities_endpoint_is_reachable(db_session):
    """GET /api/patients/rebooking-opportunities must resolve to its own handler, not fall through
    to /api/patients/{patient_id} with patient_id="rebooking-opportunities".
    """
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/rebooking-opportunities")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert "reference_date" in body

    app.dependency_overrides.clear()


async def test_get_calendar_endpoint_is_reachable_and_accepts_month_param(db_session):
    """GET /api/patients/calendar must resolve to its own handler (not fall through to
    /api/patients/{patient_id}), and an explicit ?month=YYYY-MM must be honored rather
    than ignored in favor of the default reference month.
    """
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients/calendar", params={"month": "2025-06"})

    assert response.status_code == 200
    body = response.json()
    assert body["month"] == "2025-06"
    assert len(body["days"]) == 30  # June has 30 days

    app.dependency_overrides.clear()


async def test_get_day_schedule_endpoint_requires_date_param(db_session):
    """GET /api/patients/day must resolve to its own handler and requires a `date` query param."""
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        missing_date = await client.get("/api/patients/day")
        with_date = await client.get("/api/patients/day", params={"date": "2026-01-15"})

    assert missing_date.status_code == 422  # date is required, not optional
    assert with_date.status_code == 200
    assert with_date.json()["reference_date"] == "2026-01-15"

    app.dependency_overrides.clear()
