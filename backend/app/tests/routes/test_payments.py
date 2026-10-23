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


    @pytest.mark.asyncio
    async def test_owner_listing_filters_by_user_dbref(
        self, client, mongomock_db, auth_headers_owner, test_owner_user
    ):
        with patch("app.routes.payments.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(side_effect=[[], []])
            mock_db.payments = fake_collection

            with patch("app.routes.payments.Receipt") as MockReceipt:
                MockReceipt.find_one = AsyncMock(return_value=None)
                response = await client.get("/payments/?page=1&limit=20", headers=auth_headers_owner)

        assert response.status_code == 200
        count_pipeline = fake_collection.aggregate.call_args_list[0].args[0]
        assert count_pipeline[0]["$match"]["$or"] == [{"user.$id": test_owner_user.id}]

    @pytest.mark.asyncio
    async def test_search_and_sort_are_applied_to_pipelines(
        self, client, override_auth_as_admin
    ):
        with patch("app.routes.payments.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
            mock_db.payments = fake_collection

            response = await client.get(
                "/payments/?search=Villa&sort_by=amount&sort_dir=desc"
            )
            assert response.status_code == 200

        count_pipeline = fake_collection.aggregate.call_args_list[0].args[0]
        data_pipeline = fake_collection.aggregate.call_args_list[1].args[0]

        count_search = next(
            stage["$match"]
            for stage in count_pipeline
            if "$match" in stage and "$or" in stage["$match"]
        )
        assert any("property_data.owner_name" in clause for clause in count_search["$or"])

        data_search = next(
            stage["$match"]
            for stage in data_pipeline
            if "$match" in stage and "$or" in stage["$match"]
        )
        assert any("property_data.villa" in clause for clause in data_search["$or"])

        sort_stage = next(stage["$sort"] for stage in data_pipeline if "$sort" in stage)
        assert sort_stage["amount"] == -1

    @pytest.mark.asyncio
    async def test_invalid_sort_is_rejected(self, client, override_auth_as_admin):
        response = await client.get("/payments/?sort_by=unknown")
        assert response.status_code == 422


class TestCreatePayment:
    @pytest.mark.asyncio
    async def test_creates_payment(
        self, client, mongomock_db, test_fee, auth_headers_admin
    ):
        from app.models.payment import Payment

        response = await client.post(
            "/payments/",
            data={"fee_id": str(test_fee.id), "amount": "150.00"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 150.0
        assert data["fee_id"] == str(test_fee.id)

        payments = await Payment.find_all().to_list()
        assert len(payments) == 1

    @pytest.mark.asyncio
    async def test_create_payment_fee_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/payments/",
            data={"fee_id": "507f1f77bcf86cd799439999", "amount": "150.00"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_approved_payment_updates_fee(
        self, client, mongomock_db, test_fee, auth_headers_admin
    ):
        from app.models.fee import Fee, FeeStatus

        response = await client.post(
            "/payments/",
            data={"fee_id": str(test_fee.id), "amount": "150.00", "status": "approved"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200

        fee = await Fee.get(test_fee.id)
        assert fee.paid_amount == 150.0
        assert fee.status == FeeStatus.COMPLETED


class TestDeletePayment:
    @pytest.mark.asyncio
    async def test_admin_can_delete(
        self, client, mongomock_db, test_fee, test_approved_payment, auth_headers_admin
    ):
        from app.models.fee import Fee, FeeStatus
        from app.models.payment import Payment, PaymentStatus
        from unittest.mock import patch, AsyncMock

        test_fee.paid_amount = 150.00
        test_fee.status = FeeStatus.COMPLETED
        await test_fee.save()

        payment_id = str(test_approved_payment.id)

        async def mock_fetch_link(self, field):
            if field is Payment.fee or field == "fee":
                self.fee = test_fee

        with patch.object(Payment, "fetch_link", mock_fetch_link):
            response = await client.delete(f"/payments/{payment_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Payment.find_all().to_list()
        assert len(remaining) == 0

        fee = await Fee.get(test_fee.id)
        assert fee.paid_amount == 0.0
        assert fee.status == FeeStatus.PENDING

    @pytest.mark.asyncio
    async def test_delete_payment_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/payments/507f1f77bcf86cd799439999",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(self, client, mongomock_db, auth_headers_owner):
        response = await client.delete("/payments/pay-1", headers=auth_headers_owner)
        assert response.status_code == 403


class TestGetPayment:
    @pytest.mark.asyncio
    async def test_returns_single_payment(
        self, client, mongomock_db, test_payment, test_fee, auth_headers_admin
    ):
        from beanie.odm.fields import Link

        payment_id = str(test_payment.id)

        async def mock_link_fetch(self, fetch_links=False):
            return test_fee

        with patch.object(Link, "fetch", mock_link_fetch):
            response = await client.get(f"/payments/{payment_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == payment_id
        assert data["amount"] == 150.0

    @pytest.mark.asyncio
    async def test_get_payment_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/payments/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestUpdatePayment:
    @pytest.mark.asyncio
    async def test_updates_payment_amount(
        self, client, mongomock_db, test_payment, test_fee, auth_headers_admin
    ):
        from beanie.odm.fields import Link

        payment_id = str(test_payment.id)

        async def mock_link_fetch(self, fetch_links=False):
            return test_fee

        with patch.object(Link, "fetch", mock_link_fetch):
            response = await client.put(
                f"/payments/{payment_id}",
                data={"amount": "200.00"},
                headers=auth_headers_admin,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 200.0

    @pytest.mark.asyncio
    async def test_update_payment_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/payments/507f1f77bcf86cd799439999",
            data={"amount": "200.00"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestBulkApprove:
    @pytest.mark.asyncio
    async def test_approves_payments(
        self, client, mongomock_db, test_payment, test_fee, auth_headers_admin
    ):
        from app.models.payment import Payment
        from unittest.mock import patch

        payment_id = str(test_payment.id)

        async def mock_fetch_link(self, field):
            if field is Payment.fee or field == "fee":
                self.fee = test_fee

        with patch.object(Payment, "fetch_link", mock_fetch_link):
            response = await client.post(
                "/payments/bulk-approve",
                json={"payment_ids": [payment_id]},
                headers=auth_headers_admin,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["approved_count"] == 1

    @pytest.mark.asyncio
    async def test_bulk_approve_empty_list(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/payments/bulk-approve",
            json={"payment_ids": []},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400
