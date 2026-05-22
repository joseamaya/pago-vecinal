import pytest
from unittest.mock import patch, AsyncMock, MagicMock
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


class TestListUsers:
    @pytest.mark.asyncio
    async def test_admin_can_list(self, client, override_auth_as_admin):
        with patch("app.routes.users.User") as MockUser:
            MockUser.find_all.return_value.to_list = AsyncMock(return_value=[])

            response = await client.get("/users/")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_gets_403(self, client, mock_owner_user):
        async def override():
            return mock_owner_user
        app.dependency_overrides[get_current_user] = override

        response = await client.get("/users/")
        assert response.status_code == 403

        app.dependency_overrides.clear()


class TestGetMe:
    @pytest.mark.asyncio
    async def test_returns_current_user(self, client, override_auth_as_admin, mock_user):
        response = await client.get("/users/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == mock_user.email

    @pytest.mark.asyncio
    async def test_returns_401_without_auth(self, client):
        response = await client.get("/users/me")
        assert response.status_code == 401
