import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies.auth import get_current_user


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


@pytest.fixture
def override_auth_as_admin(mock_user):
    async def override():
        return mock_user
    app.dependency_overrides[get_current_user] = override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def test_treasurer(mongomock_db):
    from app.models.treasurer import Treasurer
    treasurer = Treasurer(villa="Villa 1", name="Tesorero Test")
    await treasurer.insert()
    return treasurer


class TestListTreasurers:
    @pytest.mark.asyncio
    async def test_returns_treasurers(
        self, client, mongomock_db, test_treasurer, auth_headers_admin
    ):
        response = await client.get("/treasurers/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Tesorero Test"

    @pytest.mark.asyncio
    async def test_owner_cannot_list(self, client, mongomock_db, auth_headers_owner):
        response = await client.get("/treasurers/", headers=auth_headers_owner)
        assert response.status_code == 403


class TestGetTreasurer:
    @pytest.mark.asyncio
    async def test_returns_by_villa(
        self, client, mongomock_db, test_treasurer, auth_headers_admin
    ):
        response = await client.get("/treasurers/Villa 1", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["villa"] == "Villa 1"

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get("/treasurers/NonExistent", headers=auth_headers_admin)
        assert response.status_code == 404


class TestCreateTreasurer:
    @pytest.mark.asyncio
    async def test_creates_treasurer(self, client, mongomock_db, auth_headers_admin):
        from app.models.treasurer import Treasurer

        response = await client.post(
            "/treasurers/",
            json={"villa": "Villa 2", "name": "New Treasurer"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["villa"] == "Villa 2"

        treasurers = await Treasurer.find_all().to_list()
        assert len(treasurers) == 1

    @pytest.mark.asyncio
    async def test_duplicate_villa_fails(
        self, client, mongomock_db, test_treasurer, auth_headers_admin
    ):
        response = await client.post(
            "/treasurers/",
            json={"villa": "Villa 1", "name": "Duplicate"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_owner_cannot_create(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/treasurers/",
            json={"villa": "Villa 3", "name": "Hack"},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestUpdateTreasurer:
    @pytest.mark.asyncio
    async def test_updates_treasurer(
        self, client, mongomock_db, test_treasurer, auth_headers_admin
    ):
        response = await client.put(
            "/treasurers/Villa 1",
            json={"name": "Updated Name"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/treasurers/NonExistent",
            json={"name": "Ghost"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteTreasurer:
    @pytest.mark.asyncio
    async def test_deletes_treasurer(
        self, client, mongomock_db, test_treasurer, auth_headers_admin
    ):
        from app.models.treasurer import Treasurer

        response = await client.delete("/treasurers/Villa 1", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Treasurer.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete("/treasurers/NonExistent", headers=auth_headers_admin)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(
        self, client, mongomock_db, test_treasurer, auth_headers_owner
    ):
        response = await client.delete("/treasurers/Villa 1", headers=auth_headers_owner)
        assert response.status_code == 403
