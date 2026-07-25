import pytest
from unittest.mock import patch, AsyncMock
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


class TestListFeeSchedules:
    @pytest.mark.asyncio
    async def test_returns_schedules(
        self, client, mongomock_db, test_fee_schedule, auth_headers_admin
    ):
        response = await client.get("/fee-schedules/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["amount"] == 150.0

    @pytest.mark.asyncio
    async def test_owner_cannot_list(self, client, mongomock_db, auth_headers_owner):
        response = await client.get("/fee-schedules/", headers=auth_headers_owner)
        assert response.status_code == 403


class TestGetFeeSchedule:
    @pytest.mark.asyncio
    async def test_returns_single(
        self, client, mongomock_db, test_fee_schedule, auth_headers_admin
    ):
        schedule_id = str(test_fee_schedule.id)
        response = await client.get(f"/fee-schedules/{schedule_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 150.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/fee-schedules/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestCreateFeeSchedule:
    @pytest.mark.asyncio
    async def test_creates_schedule(self, client, mongomock_db, auth_headers_admin):
        from app.models.fee import FeeSchedule

        response = await client.post(
            "/fee-schedules/",
            json={
                "amount": 200.0,
                "description": "Cuota extra",
                "effective_date": datetime.utcnow().isoformat(),
                "due_day": 10,
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 200.0

        schedules = await FeeSchedule.find_all().to_list()
        assert len(schedules) == 1

    @pytest.mark.asyncio
    async def test_owner_cannot_create(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/fee-schedules/",
            json={
                "amount": 100.0,
                "description": "Test",
                "effective_date": datetime.utcnow().isoformat(),
            },
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestUpdateFeeSchedule:
    @pytest.mark.asyncio
    async def test_updates_schedule(
        self, client, mongomock_db, test_fee_schedule, auth_headers_admin
    ):
        schedule_id = str(test_fee_schedule.id)
        response = await client.put(
            f"/fee-schedules/{schedule_id}",
            json={"amount": 180.0},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 180.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/fee-schedules/507f1f77bcf86cd799439999",
            json={"amount": 100.0},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteFeeSchedule:
    @pytest.mark.asyncio
    async def test_deletes_schedule(
        self, client, mongomock_db, test_fee_schedule, auth_headers_admin
    ):
        from app.models.fee import FeeSchedule

        schedule_id = str(test_fee_schedule.id)
        response = await client.delete(f"/fee-schedules/{schedule_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await FeeSchedule.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/fee-schedules/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(
        self, client, mongomock_db, test_fee_schedule, auth_headers_owner
    ):
        response = await client.delete(
            f"/fee-schedules/{test_fee_schedule.id}", headers=auth_headers_owner
        )
        assert response.status_code == 403
