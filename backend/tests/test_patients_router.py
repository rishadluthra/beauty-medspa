from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_patient


async def test_get_patients_endpoint_returns_list(db_session):
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

    app.dependency_overrides.clear()
