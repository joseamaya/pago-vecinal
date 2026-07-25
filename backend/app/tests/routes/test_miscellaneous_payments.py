import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime
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
async def test_misc_payment(mongomock_db, test_user):
    from app.models.miscellaneous_payment import MiscellaneousPayment, MiscellaneousPaymentType
    payment = MiscellaneousPayment(
        user=test_user,
        payment_type=MiscellaneousPaymentType.MAINTENANCE,
        amount=200.0,
        payment_date=datetime.utcnow(),
        description="Test misc payment",
        status="pending",
    )
    await payment.insert()
    return payment


class TestListMiscellaneousPayments:
    @pytest.mark.asyncio
    async def test_returns_all(
        self, client, mongomock_db, test_misc_payment, test_user, auth_headers_admin
    ):
        from app.models.miscellaneous_payment import MiscellaneousPayment

        async def mock_fetch_link(self, field):
            if field is MiscellaneousPayment.user or field == "user":
                self.user = test_user

        with patch.object(MiscellaneousPayment, "fetch_link", mock_fetch_link):
            response = await client.get("/miscellaneous-payments/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["amount"] == 200.0


class TestGetMiscellaneousPayment:
    @pytest.mark.asyncio
    async def test_returns_single(
        self, client, mongomock_db, test_misc_payment, test_user, auth_headers_admin
    ):
        from app.models.miscellaneous_payment import MiscellaneousPayment

        payment_id = str(test_misc_payment.id)

        async def mock_fetch_link(self, field):
            if field is MiscellaneousPayment.user or field == "user":
                self.user = test_user

        with patch.object(MiscellaneousPayment, "fetch_link", mock_fetch_link):
            response = await client.get(f"/miscellaneous-payments/{payment_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 200.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/miscellaneous-payments/507f1f77bcf86cd799439999",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestCreateMiscellaneousPayment:
    @pytest.mark.asyncio
    async def test_creates_payment(self, client, mongomock_db, test_user, auth_headers_admin):
        from app.models.miscellaneous_payment import MiscellaneousPayment

        response = await client.post(
            "/miscellaneous-payments/",
            data={
                "payment_type": "other",
                "amount": "300.0",
                "payment_date": datetime.utcnow().isoformat(),
                "description": "New misc payment",
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 300.0
        assert data["description"] == "New misc payment"

        payments = await MiscellaneousPayment.find_all().to_list()
        assert len(payments) == 1

    @pytest.mark.asyncio
    async def test_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/miscellaneous-payments/",
            data={
                "property_id": "507f1f77bcf86cd799439999",
                "payment_type": "other",
                "amount": "100.0",
                "payment_date": datetime.utcnow().isoformat(),
                "description": "Test",
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteMiscellaneousPayment:
    @pytest.mark.asyncio
    async def test_admin_can_delete(
        self, client, mongomock_db, test_misc_payment, auth_headers_admin
    ):
        from app.models.miscellaneous_payment import MiscellaneousPayment

        payment_id = str(test_misc_payment.id)
        response = await client.delete(f"/miscellaneous-payments/{payment_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await MiscellaneousPayment.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/miscellaneous-payments/507f1f77bcf86cd799439999",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(
        self, client, mongomock_db, test_misc_payment, auth_headers_owner
    ):
        response = await client.delete(
            f"/miscellaneous-payments/{test_misc_payment.id}",
            headers=auth_headers_owner,
        )
        assert response.status_code == 403
