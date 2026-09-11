"""HTTP-level tests for /api/graph-order and /api/custom-views."""

from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from app.repositories.custom_views import DEFAULT_CHART_REFS, MAX_CUSTOM_VIEWS


async def test_get_graph_order_returns_default_chart_keys_when_unset(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/graph-order")
    assert response.status_code == 200
    assert response.json()["chart_refs"] == DEFAULT_CHART_REFS
    app.dependency_overrides.clear()


async def test_put_graph_order_replaces_it(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    reordered = list(reversed(DEFAULT_CHART_REFS))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/api/graph-order", json={"chart_refs": reordered})
        assert response.status_code == 200
        assert response.json()["chart_refs"] == reordered

        get_response = await client.get("/api/graph-order")
        assert get_response.json()["chart_refs"] == reordered
    app.dependency_overrides.clear()


async def test_create_a_report_via_http_then_see_it_prepended_in_graph_order(db_session):
    """Confirms the two features are actually wired together over the real HTTP stack, not just at the repository layer."""
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_response = await client.post(
            "/api/custom-reports",
            json={"title": "New report", "metric": "revenue_cents", "dimension": "provider", "time_grain": "month"},
        )
        report_id = create_response.json()["id"]

        order_response = await client.get("/api/graph-order")
        assert order_response.json()["chart_refs"][0] == f"custom:{report_id}"

        await client.delete(f"/api/custom-reports/{report_id}")
        order_after_delete = await client.get("/api/graph-order")
        assert f"custom:{report_id}" not in order_after_delete.json()["chart_refs"]
    app.dependency_overrides.clear()


async def test_create_list_update_and_delete_custom_view_via_http(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_response = await client.post(
            "/api/custom-views",
            json={"name": "Marketing Dashboard", "chart_refs": ["default:revenue_over_time", "default:patients_by_source"]},
        )
        assert create_response.status_code == 201
        view = create_response.json()
        assert view["name"] == "Marketing Dashboard"

        list_response = await client.get("/api/custom-views")
        assert [v["id"] for v in list_response.json()] == [view["id"]]

        update_response = await client.put(f"/api/custom-views/{view['id']}", json={"chart_refs": ["default:revenue_over_time"]})
        assert update_response.status_code == 200
        assert update_response.json()["chart_refs"] == ["default:revenue_over_time"]

        delete_response = await client.delete(f"/api/custom-views/{view['id']}")
        assert delete_response.status_code == 204

        list_after_delete = await client.get("/api/custom-views")
        assert list_after_delete.json() == []
    app.dependency_overrides.clear()


async def test_update_unknown_custom_view_404s(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/api/custom-views/view_does_not_exist", json={"chart_refs": ["default:revenue_over_time"]})
    assert response.status_code == 404
    app.dependency_overrides.clear()


async def test_delete_unknown_custom_view_404s(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete("/api/custom-views/view_does_not_exist")
    assert response.status_code == 404
    app.dependency_overrides.clear()


async def test_create_custom_view_enforces_soft_cap(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for i in range(MAX_CUSTOM_VIEWS):
            response = await client.post("/api/custom-views", json={"name": f"View {i}", "chart_refs": ["default:revenue_over_time"]})
            assert response.status_code == 201

        over_cap_response = await client.post("/api/custom-views", json={"name": "One too many", "chart_refs": ["default:revenue_over_time"]})
        assert over_cap_response.status_code == 400
    app.dependency_overrides.clear()
