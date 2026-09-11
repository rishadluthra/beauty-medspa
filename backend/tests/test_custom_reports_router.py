"""HTTP-level tests for /api/custom-reports (the self-serve "Build Custom
Analytics" feature's only non-GET routes in the whole API)."""

from datetime import datetime

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from app.repositories.custom_reports import MAX_SAVED_REPORTS
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_create_list_and_delete_custom_report_via_http(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([make_patient(id="pat_1"), make_provider(id="prv_1"), make_service()])
    await db_session.flush()
    db_session.add(make_appointment(id="apt_1", patient_id="pat_1"))
    await db_session.flush()
    db_session.add(make_payment(id="pay_1", appointment_id="apt_1", provider_id="prv_1", amount=25000, status="paid", date=datetime(2025, 5, 1)))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_response = await client.post(
            "/api/custom-reports",
            json={"title": "Revenue by provider", "metric": "revenue_cents", "dimension": "provider", "time_grain": "month"},
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["title"] == "Revenue by provider"
        assert created["data"] == [{"period": "2025-05", "dimension_value": "Dr Smith", "value": 25000}]

        list_response = await client.get("/api/custom-reports")
        assert list_response.status_code == 200
        assert [r["id"] for r in list_response.json()] == [created["id"]]

        delete_response = await client.delete(f"/api/custom-reports/{created['id']}")
        assert delete_response.status_code == 204

        list_after_delete = await client.get("/api/custom-reports")
        assert list_after_delete.json() == []

    app.dependency_overrides.clear()


async def test_create_custom_report_accepts_demographic_dimensions_via_http(db_session):
    """The gender/age_bucket dimensions (added for demographics-over-time reports) parse correctly off the wire."""
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add_all([make_patient(id="pat_1", gender="female"), make_provider(id="prv_1"), make_service()])
    await db_session.flush()
    db_session.add(make_appointment(id="apt_1", patient_id="pat_1"))
    await db_session.flush()
    db_session.add(make_payment(id="pay_1", patient_id="pat_1", appointment_id="apt_1", provider_id="prv_1", amount=9000, status="paid", date=datetime(2025, 9, 1)))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/custom-reports",
            json={"title": "Revenue by gender", "metric": "revenue_cents", "dimension": "gender", "time_grain": "month"},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["dimension"] == "gender"
    assert body["data"] == [{"period": "2025-09", "dimension_value": "female", "value": 9000}]

    app.dependency_overrides.clear()


async def test_create_custom_report_rejects_invalid_metric(db_session):
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/custom-reports",
            json={"title": "Bad report", "metric": "not_a_real_metric", "dimension": "provider", "time_grain": "month"},
        )
    assert response.status_code == 422

    app.dependency_overrides.clear()


async def test_delete_unknown_custom_report_404s(db_session):
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete("/api/custom-reports/rpt_does_not_exist")
    assert response.status_code == 404

    app.dependency_overrides.clear()


async def test_create_custom_report_enforces_soft_cap(db_session):
    """The MAX_SAVED_REPORTS-th create succeeds; the next one 400s."""
    app.dependency_overrides[get_db] = lambda: db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for i in range(MAX_SAVED_REPORTS):
            response = await client.post(
                "/api/custom-reports",
                json={"title": f"Report {i}", "metric": "appointment_count", "dimension": "provider", "time_grain": "month"},
            )
            assert response.status_code == 201

        over_cap_response = await client.post(
            "/api/custom-reports",
            json={"title": "One too many", "metric": "appointment_count", "dimension": "provider", "time_grain": "month"},
        )
        assert over_cap_response.status_code == 400

    app.dependency_overrides.clear()
