"""HTTP-level test for the /api/patients endpoint.

Unlike test_patients_repository.py (which calls the repository function
directly), this goes through the actual FastAPI route and ASGI stack via
httpx's ASGITransport, confirming the router wiring, request handling,
and JSON serialization all work end-to-end.
"""

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_patient


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
