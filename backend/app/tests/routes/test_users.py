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


class TestListUsers:
    @pytest.mark.asyncio
    async def test_admin_can_list(self, client, override_auth_as_admin):
        with patch("app.routes.users.User") as MockUser:
            MockUser.find_all.return_value.to_list = AsyncMock(return_value=[])
            response = await client.get("/users/")
            assert response.status_code == 200
            assert isinstance(response.json(), list)

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


class TestGetUser:
    @pytest.mark.asyncio
    async def test_admin_can_get_any_user(
        self, client, mongomock_db, test_user, auth_headers_admin
    ):
        user_id = str(test_user.id)
        response = await client.get(f"/users/{user_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email

    @pytest.mark.asyncio
    async def test_user_can_get_self(
        self, client, mongomock_db, test_user, auth_headers_admin
    ):
        response = await client.get("/users/me", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/users/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestUpdateUser:
    @pytest.mark.asyncio
    async def test_updates_user(
        self, client, mongomock_db, test_user, auth_headers_admin
    ):
        user_id = str(test_user.id)
        response = await client.put(
            f"/users/{user_id}",
            json={"full_name": "Updated Name"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/users/507f1f77bcf86cd799439999",
            json={"full_name": "Ghost"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestChangePassword:
    @pytest.mark.asyncio
    async def test_changes_password(
        self, client, mongomock_db, auth_headers_admin
    ):
        from app.auth.utils import verify_password
        from app.models.user import User

        response = await client.put(
            "/users/me/password",
            json={"current_password": "test-password", "new_password": "NewPass123!"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        user = await User.find_one(User.email == "test@example.com")
        assert verify_password("NewPass123!", user.password_hash)

    @pytest.mark.asyncio
    async def test_rejects_wrong_current_password(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.put(
            "/users/me/password",
            json={"current_password": "wrong", "new_password": "NewPass123!"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_short_password(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.put(
            "/users/me/password",
            json={"current_password": "test-password", "new_password": "123"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_same_password(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.put(
            "/users/me/password",
            json={"current_password": "test-password", "new_password": "test-password"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400


class TestDeleteUser:
    @pytest.mark.asyncio
    async def test_admin_can_delete(
        self, client, mongomock_db, test_user, auth_headers_admin
    ):
        from app.models.user import User

        user_id = str(test_user.id)
        response = await client.delete(f"/users/{user_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await User.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/users/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(
        self, client, mongomock_db, test_user, auth_headers_owner
    ):
        response = await client.delete(
            f"/users/{test_user.id}", headers=auth_headers_owner
        )
        assert response.status_code == 403
