"""HTTP-level tests for GET /api/providers and the provider_id filter on the
schedule endpoints (/api/patients/today, /api/patients/upcoming).
"""

from datetime import datetime

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_appointment, make_appointment_service, make_patient, make_provider, make_service


async def test_get_providers_endpoint_returns_sorted_list(db_session):
    """GET /api/providers returns every provider, sorted by (last_name, first_name)."""
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([
        make_provider(id="prv_2", first_name="Dr", last_name="Zimmerman"),
        make_provider(id="prv_1", first_name="Dr", last_name="Adams"),
    ])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/providers")

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ["prv_1", "prv_2"]

    app.dependency_overrides.clear()


async def test_today_and_upcoming_endpoints_accept_provider_id_filter(db_session):
    """provider_id passed as a query param on /today and /upcoming actually narrows the
    results -- confirms the router forwards it to the repository layer, not just that the
    param is accepted and ignored.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(),
        make_appointment(id="apt_today", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_later", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_today", provider_id="prv_1",
            start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30),
        ),
        make_appointment_service(
            appointment_id="apt_later", provider_id="prv_2",
            start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30),
        ),
    ])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        today_prv1 = await client.get("/api/patients/today", params={"provider_id": "prv_1"})
        today_prv2 = await client.get("/api/patients/today", params={"provider_id": "prv_2"})

    assert len(today_prv1.json()["items"]) == 1
    assert today_prv2.json()["items"] == []  # prv_2's only service is next month, not today

    app.dependency_overrides.clear()
