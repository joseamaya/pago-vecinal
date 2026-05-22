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


class TestListPayments:
    @pytest.mark.asyncio
    async def test_returns_paginated_payments(self, client, override_auth_as_admin):
        with patch("app.routes.payments.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(side_effect=[[], []])
            mock_db.payments = fake_collection

            with patch("app.routes.payments.Receipt") as MockReceipt:
                MockReceipt.find_one = AsyncMock(return_value=None)

                response = await client.get("/payments/?page=1&limit=20")
                assert response.status_code == 200
                data = response.json()
                assert "data" in data
                assert "pagination" in data


class TestCreatePayment:
    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires full Beanie model initialization for class-level field access")
    async def test_creates_payment(self, client, override_auth_as_admin, mock_fee, mock_user):
        ...


class TestDeletePayment:
    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires full Beanie model initialization for class-level field access")
    async def test_admin_can_delete(self, client, override_auth_as_admin, mock_fee):
        ...

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(self, client, mock_owner_user):
        async def override():
            return mock_owner_user
        app.dependency_overrides[get_current_user] = override

        response = await client.delete("/payments/pay-1")
        assert response.status_code == 403

        app.dependency_overrides.clear()
