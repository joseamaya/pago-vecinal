import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_valid_credentials(self, client):
        with patch("app.routes.auth.authenticate_user", new_callable=AsyncMock) as mock_auth:
            mock_user = MagicMock()
            mock_user.email = "admin@test.com"
            mock_auth.return_value = mock_user

            response = await client.post("/auth/login", data={"username": "admin@test.com", "password": "test"})
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        with patch("app.routes.auth.authenticate_user", new_callable=AsyncMock, return_value=None):
            response = await client.post("/auth/login", data={"username": "admin@test.com", "password": "wrong"})
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_sends_form_data(self, client):
        with patch("app.routes.auth.authenticate_user", new_callable=AsyncMock) as mock_auth:
            mock_user = MagicMock()
            mock_user.email = "admin@test.com"
            mock_auth.return_value = mock_user

            await client.post("/auth/login", data={"username": "admin@test.com", "password": "pass"})
            mock_auth.assert_called_once_with("admin@test.com", "pass")


class TestLoginRateLimit:
    @pytest.mark.asyncio
    async def test_blocks_after_limit(self, client):
        with patch("app.routes.auth.authenticate_user", new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = None
            for _ in range(5):
                response = await client.post(
                    "/auth/login", data={"username": "x@y.com", "password": "bad"}
                )
                assert response.status_code == 401
            response = await client.post(
                "/auth/login", data={"username": "x@y.com", "password": "bad"}
            )
        assert response.status_code == 429


class TestRequestAudit:
    @pytest.mark.asyncio
    async def test_login_request_is_audited(self, client, mongomock_db):
        from app.models.audit_log import AuditLog

        await client.post("/auth/login", data={"username": "nobody@test.com", "password": "wrong"})

        logs = await AuditLog.find_all().to_list()
        assert any(log.path == "/auth/login" and log.method == "POST" for log in logs)

    @pytest.mark.asyncio
    async def test_get_request_is_not_audited(self, client, mongomock_db):
        from app.models.audit_log import AuditLog

        await client.get("/")

        logs = await AuditLog.find_all().to_list()
        assert all(log.method != "GET" for log in logs)
