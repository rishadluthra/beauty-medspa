"""HTTP-level tests for GET /api/services and GET /api/availability."""

from datetime import datetime

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_appointment, make_appointment_service, make_patient, make_provider, make_service


async def test_get_services_endpoint_returns_sorted_list(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([
        make_service(id="svc_2", name="Microneedling", duration=45),
        make_service(id="svc_1", name="Botox Injection", duration=30),
    ])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/services")

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["svc_1", "svc_2"]  # sorted by name

    app.dependency_overrides.clear()


async def test_get_availability_endpoint_with_explicit_at_and_conflict(db_session):
    """GET /api/availability with an explicit `at` correctly flags a conflicting provider
    and reports when they free up, confirming the router forwards `at` and `service_id`
    to the repository layer rather than ignoring them.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_busy", first_name="Busy", last_name="Provider"),
        make_provider(id="prv_free", first_name="Free", last_name="Provider"),
        make_service(id="svc_1", name="Botox Injection", duration=30),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_1", provider_id="prv_busy",
            start=datetime(2026, 1, 1, 9, 45), end=datetime(2026, 1, 1, 10, 15),
        ),
    ])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/availability", params={"service_id": "svc_1", "at": "2026-01-01T10:00:00"},
        )

    assert response.status_code == 200
    body = response.json()
    by_id = {p["provider_id"]: p for p in body["providers"]}
    assert by_id["prv_busy"]["available"] is False
    assert by_id["prv_busy"]["busy_until"] == "2026-01-01T10:15:00"
    assert by_id["prv_free"]["available"] is True

    app.dependency_overrides.clear()


async def test_get_availability_endpoint_404s_for_unknown_service(db_session):
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/availability", params={"service_id": "svc_does_not_exist"})

    assert response.status_code == 404

    app.dependency_overrides.clear()


async def test_get_availability_endpoint_requires_service_id(db_session):
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/availability")

    assert response.status_code == 422

    app.dependency_overrides.clear()
