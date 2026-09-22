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

    @pytest.mark.asyncio
    async def test_owner_query_targets_payment_and_misc_links(self, mongomock_db):
        from types import SimpleNamespace
        from beanie import PydanticObjectId
        from app.models.user import UserRole
        from app.models.payment import Payment
        from app.models.miscellaneous_payment import MiscellaneousPayment
        from app.routes.receipts import _owner_receipts_query

        user = SimpleNamespace(role=UserRole.OWNER, id=PydanticObjectId())
        pay_id = PydanticObjectId()
        misc_id = PydanticObjectId()

        pay_query = MagicMock()
        pay_query.to_list = AsyncMock(return_value=[SimpleNamespace(id=pay_id)])
        misc_query = MagicMock()
        misc_query.to_list = AsyncMock(return_value=[SimpleNamespace(id=misc_id)])

        with patch.object(Payment, "find", return_value=pay_query), patch.object(
            MiscellaneousPayment, "find", return_value=misc_query
        ):
            query = await _owner_receipts_query(user)

        assert query.get_filter_query() == {
            "$or": [
                {"payment.$id": {"$in": [pay_id]}},
                {"miscellaneous_payment.$id": {"$in": [misc_id]}},
            ]
        }


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


class TestMiscellaneousReceipt:
    """Receipts created for miscellaneous payments have no `payment` link."""

    @pytest.mark.asyncio
    async def test_get_returns_misc_payment_id(
        self, client, mongomock_db, test_misc_receipt, test_misc_payment, auth_headers_admin
    ):
        response = await client.get(
            f"/receipts/{test_misc_receipt.id}", headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payment_id"] is None
        assert data["miscellaneous_payment_id"] == str(test_misc_payment.id)

    @pytest.mark.asyncio
    async def test_owner_can_get_own_misc_receipt(
        self, client, mongomock_db, test_misc_receipt, auth_headers_owner
    ):
        response = await client.get(
            f"/receipts/{test_misc_receipt.id}", headers=auth_headers_owner
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_other_owner_forbidden(
        self, client, mongomock_db, test_misc_receipt, auth_headers_other_owner
    ):
        response = await client.get(
            f"/receipts/{test_misc_receipt.id}", headers=auth_headers_other_owner
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_without_payment_link(
        self, client, mongomock_db, test_misc_receipt, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.receipts.generate_receipt_pdf", return_value=BytesIO(b"%PDF-1.4 mock")
        ):
            with patch(
                "app.routes.receipts.upload_receipt_pdf",
                return_value="https://cloud.test/recibo.pdf",
            ):
                response = await client.put(
                    f"/receipts/{test_misc_receipt.id}",
                    json={"notes": "Actualizado"},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        assert response.json()["notes"] == "Actualizado"

    @pytest.mark.asyncio
    async def test_regenerate_without_payment_link(
        self, client, mongomock_db, test_misc_receipt, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.receipts.generate_receipt_pdf", return_value=BytesIO(b"%PDF-1.4 mock")
        ):
            with patch(
                "app.routes.receipts.upload_receipt_pdf",
                return_value="https://cloud.test/recibo.pdf",
            ):
                response = await client.post(
                    f"/receipts/{test_misc_receipt.id}/regenerate-pdf",
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_download_without_payment_link(
        self, client, mongomock_db, test_misc_receipt, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.receipts.generate_receipt_pdf",
            return_value=BytesIO(b"%PDF-1.4 mock pdf content"),
        ):
            response = await client.get(
                f"/receipts/{test_misc_receipt.id}/download", headers=auth_headers_admin
            )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

    @pytest.mark.asyncio
    async def test_regenerate_all_includes_misc_receipts(
        self, client, mongomock_db, test_misc_receipt, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.receipts.generate_receipt_pdf", return_value=BytesIO(b"%PDF-1.4 mock")
        ):
            with patch(
                "app.routes.receipts.upload_receipt_pdf",
                return_value="https://cloud.test/recibo.pdf",
            ):
                response = await client.post(
                    "/receipts/regenerate-all-pdfs", headers=auth_headers_admin
                )
        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 1
        assert data["errors"] == []

    @pytest.mark.asyncio
    async def test_delete_forbidden_for_other_owner(
        self, client, mongomock_db, test_misc_receipt, auth_headers_other_owner
    ):
        response = await client.delete(
            f"/receipts/{test_misc_receipt.id}", headers=auth_headers_other_owner
        )
        assert response.status_code == 403


class TestExpenseReceipt:
    """Receipts for expenses have no owner and are admin-only."""

    @pytest.mark.asyncio
    async def test_admin_can_get(self, client, mongomock_db, test_expense_receipt, auth_headers_admin):
        response = await client.get(
            f"/receipts/{test_expense_receipt.id}", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.json()["expense_id"] is not None

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, test_expense_receipt, auth_headers_owner):
        response = await client.get(
            f"/receipts/{test_expense_receipt.id}", headers=auth_headers_owner
        )
        assert response.status_code == 403
