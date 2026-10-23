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


class TestListFees:
    @pytest.mark.asyncio
    async def test_returns_paginated_fees(self, client, override_auth_as_admin, mock_user):
        with patch("app.routes.fees.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
            mock_db.fees = fake_collection

            response = await client.get("/fees/?page=1&limit=20")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert "pagination" in data

    @pytest.mark.asyncio
    async def test_filters_by_year_and_month(self, client, override_auth_as_admin):
        with patch("app.routes.fees.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
            mock_db.fees = fake_collection

            response = await client.get("/fees/?year=2025&month=1")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_filters_by_status(self, client, override_auth_as_admin):
        with patch("app.routes.fees.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
            mock_db.fees = fake_collection

            response = await client.get("/fees/?status=pending")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_and_sort_are_applied_to_pipelines(
        self, client, override_auth_as_admin
    ):
        with patch("app.routes.fees.database") as mock_db:
            fake_collection = MagicMock()
            fake_collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
            mock_db.fees = fake_collection

            response = await client.get(
                "/fees/?search=Villa&sort_by=amount&sort_dir=desc"
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
        response = await client.get("/fees/?sort_by=unknown")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_owner_cannot_generate_fees(self, client, mock_owner_user):
        async def override():
            return mock_owner_user
        app.dependency_overrides[get_current_user] = override

        response = await client.post("/fees/generate", json={"manual": False})
        assert response.status_code == 403

        app.dependency_overrides.clear()


class TestGenerateFees:
    @pytest.mark.asyncio
    async def test_admin_can_generate(
        self, client, override_auth_as_admin, mongomock_db, test_property, test_fee_schedule
    ):
        from app.models.fee import Fee

        response = await client.post("/fees/generate", json={"manual": True})
        assert response.status_code == 200
        data = response.json()
        assert "Generated" in data["message"]

        fees = await Fee.find_all().to_list()
        assert len(fees) == 1
        assert fees[0].amount == 150.00
        fee = fees[0]
        await fee.fetch_link(Fee.property)
        await fee.fetch_link(Fee.fee_schedule)
        assert fee.property.id == test_property.id
        assert fee.fee_schedule.id == test_fee_schedule.id


class TestGetFee:
    @pytest.mark.asyncio
    async def test_returns_single_fee(
        self, client, mongomock_db, test_fee, test_property, test_fee_schedule, auth_headers_admin
    ):
        from beanie.odm.fields import Link

        fee_id = str(test_fee.id)

        async def mock_fetch(self, fetch_links=False):
            if hasattr(self, "document_class") and self.document_class.__name__ == "Property":
                return test_property
            return test_fee_schedule

        with patch.object(Link, "fetch", mock_fetch):
            response = await client.get(f"/fees/{fee_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == fee_id
        assert data["amount"] == 150.0

    @pytest.mark.asyncio
    async def test_get_fee_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/fees/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestCreateFee:
    @pytest.mark.asyncio
    async def test_creates_fee(
        self,
        client,
        mongomock_db,
        test_property,
        test_fee_schedule,
        test_user,
        auth_headers_admin,
    ):
        from app.models.fee import Fee
        from datetime import datetime, timedelta

        due_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/fees/",
            json={
                "property_id": str(test_property.id),
                "fee_schedule_id": str(test_fee_schedule.id),
                "due_date": due_date,
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 150.0

        fees = await Fee.find_all().to_list()
        assert len(fees) >= 1

    @pytest.mark.asyncio
    async def test_owner_can_create_for_own_property(
        self,
        client,
        mongomock_db,
        test_property,
        test_owner_user,
        test_fee_schedule,
        auth_headers_owner,
    ):
        from datetime import datetime, timedelta

        test_property.owner = test_owner_user
        await test_property.save()

        due_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/fees/",
            json={
                "property_id": str(test_property.id),
                "fee_schedule_id": str(test_fee_schedule.id),
                "due_date": due_date,
            },
            headers=auth_headers_owner,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["property_id"] == str(test_property.id)
        assert data["user_id"] == str(test_owner_user.id)

    @pytest.mark.asyncio
    async def test_owner_cannot_create_for_other_property(
        self,
        client,
        mongomock_db,
        test_property,
        test_owner_user,
        test_fee_schedule,
        auth_headers_other_owner,
    ):
        from datetime import datetime, timedelta

        test_property.owner = test_owner_user
        await test_property.save()

        due_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/fees/",
            json={
                "property_id": str(test_property.id),
                "fee_schedule_id": str(test_fee_schedule.id),
                "due_date": due_date,
            },
            headers=auth_headers_other_owner,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_fee_property_not_found(
        self, client, mongomock_db, test_fee_schedule, auth_headers_admin
    ):
        from datetime import datetime, timedelta

        due_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/fees/",
            json={
                "property_id": "507f1f77bcf86cd799439999",
                "fee_schedule_id": str(test_fee_schedule.id),
                "due_date": due_date,
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_fee_schedule_not_found(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        from datetime import datetime, timedelta

        due_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/fees/",
            json={
                "property_id": str(test_property.id),
                "fee_schedule_id": "507f1f77bcf86cd799439999",
                "due_date": due_date,
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestUpdateFee:
    @pytest.mark.asyncio
    async def test_updates_fee_status(
        self, client, mongomock_db, test_fee, test_property, test_fee_schedule, auth_headers_admin
    ):
        from beanie.odm.fields import Link

        fee_id = str(test_fee.id)

        async def mock_fetch(self, fetch_links=False):
            if hasattr(self, "document_class") and self.document_class.__name__ == "Property":
                return test_property
            return test_fee_schedule

        with patch.object(Link, "fetch", mock_fetch):
            response = await client.put(
                f"/fees/{fee_id}",
                json={"status": "cancelled"},
                headers=auth_headers_admin,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_update_fee_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/fees/507f1f77bcf86cd799439999",
            json={"status": "cancelled"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteFee:
    @pytest.mark.asyncio
    async def test_admin_can_delete(
        self, client, mongomock_db, test_fee, auth_headers_admin
    ):
        from app.models.fee import Fee

        fee_id = str(test_fee.id)
        response = await client.delete(f"/fees/{fee_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Fee.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_delete_fee_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/fees/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(self, client, mongomock_db, auth_headers_owner):
        response = await client.delete("/fees/some-fee", headers=auth_headers_owner)
        assert response.status_code == 403
