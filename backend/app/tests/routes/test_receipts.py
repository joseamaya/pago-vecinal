import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
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


class TestListReceipts:
    @pytest.mark.asyncio
    async def test_returns_paginated_receipts(self, client, override_auth_as_admin):
        with patch("app.routes.receipts.Receipt") as MockReceipt:
            MockReceipt.find_all.return_value.sort.return_value.skip.return_value.limit.return_value.to_list = AsyncMock(return_value=[])
            MockReceipt.find_all.return_value.count = AsyncMock(return_value=0)

            response = await client.get("/receipts/?page=1&limit=20")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert "pagination" in data


class TestGetReceipt:
    @pytest.mark.asyncio
    async def test_returns_single_receipt(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin
    ):
        from beanie.odm.fields import Link

        receipt_id = str(test_receipt.id)

        async def mock_link_fetch(self, fetch_links=False):
            return test_payment

        with patch.object(Link, "fetch", mock_link_fetch):
            response = await client.get(f"/receipts/{receipt_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["correlative_number"] == "CUOT-2025-00001"
        assert data["total_amount"] == 150.0
        assert data["payment_id"] == str(test_payment.id)

    @pytest.mark.asyncio
    async def test_not_found_returns_404(self, client, override_auth_as_admin):
        with patch("app.routes.receipts.Receipt") as MockReceipt:
            MockReceipt.get = AsyncMock(return_value=None)

            response = await client.get("/receipts/nonexistent")
            assert response.status_code == 404


class TestDownloadReceipt:
    @pytest.mark.asyncio
    async def test_returns_pdf_stream(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin
    ):
        from io import BytesIO
        from beanie.odm.fields import Link

        async def mock_link_fetch(self, fetch_links=False):
            return test_payment

        with patch("app.routes.receipts.generate_receipt_pdf") as mock_generate:
            mock_pdf = BytesIO(b"%PDF-1.4 mock pdf content")
            mock_generate.return_value = mock_pdf

            with patch.object(Link, "fetch", mock_link_fetch):
                receipt_id = str(test_receipt.id)
                response = await client.get(
                    f"/receipts/{receipt_id}/download", headers=auth_headers_admin
                )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"


class TestCreateReceipt:
    @pytest.mark.asyncio
    async def test_creates_receipt(
        self, client, mongomock_db, test_approved_payment, test_fee, test_user, auth_headers_admin
    ):
        from app.models.payment import Payment
        from app.models.receipt import Receipt

        async def mock_fetch_link(self, field):
            if field is Payment.fee or field == "fee":
                self.fee = test_fee

        with patch.object(Payment, "fetch_link", mock_fetch_link):
            with patch("app.routes.receipts.create_receipt_for_payment", new_callable=AsyncMock) as mock_create:
                mock_create.return_value = Receipt(
                    correlative_number="CUOT-2025-NEW",
                    payment=test_approved_payment,
                    issue_date=datetime.utcnow(),
                    total_amount=150.0,
                )
                response = await client.post(
                    "/receipts/",
                    json={"payment_id": str(test_approved_payment.id)},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        data = response.json()
        assert data["total_amount"] == 150.0

    @pytest.mark.asyncio
    async def test_create_unapproved_payment_fails(
        self, client, mongomock_db, test_payment, test_fee, auth_headers_admin
    ):
        from app.models.payment import Payment

        async def mock_fetch_link(self, field):
            if field is Payment.fee or field == "fee":
                self.fee = test_fee

        with patch.object(Payment, "fetch_link", mock_fetch_link):
            response = await client.post(
                "/receipts/",
                json={"payment_id": str(test_payment.id)},
                headers=auth_headers_admin,
            )
        assert response.status_code == 400


class TestDeleteReceipt:
    @pytest.mark.asyncio
    async def test_deletes_receipt(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin
    ):
        from beanie.odm.fields import Link
        from app.models.receipt import Receipt

        receipt_id = str(test_receipt.id)

        async def mock_link_fetch(self, fetch_links=False):
            return test_payment

        with patch.object(Link, "fetch", mock_link_fetch):
            response = await client.delete(f"/receipts/{receipt_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Receipt.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_delete_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/receipts/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404
