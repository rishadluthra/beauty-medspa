"""Smoke test for the API's liveness/health endpoint."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_check_returns_ok():
    """/api/health responds 200 with a simple ok payload -- used by deploy/uptime checks."""
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
