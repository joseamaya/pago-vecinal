import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta
from app.main import app



@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


class TestGetDashboardStats:
    @pytest.mark.asyncio
    async def test_admin_gets_global_counts(
        self, client, mongomock_db, auth_headers_admin
    ):
        from app.models.property import Property
        from app.models.fee import Fee, FeeSchedule
        from app.models.payment import Payment
        from app.models.expense import Expense
        from app.models.user import User

        admin = await User.find_one(User.email == "test@example.com")
        prop = Property(
            row_letter="A", number=1, villa="Villa 1",
            owner_name="Owner", owner=admin,
        )
        await prop.insert()
        fs = FeeSchedule(
            amount=100.0, description="Cuota",
            effective_date=datetime.utcnow(), due_day=15,
        )
        await fs.insert()
        fee = Fee(
            property=prop, fee_schedule=fs, amount=100.0,
            generated_date=datetime.utcnow(), year=2025, month=7,
            due_date=datetime.utcnow() + timedelta(days=30),
        )
        await fee.insert()
        pay = Payment(
            fee=fee, fee_id=str(fee.id), user=admin, amount=100.0,
            payment_date=datetime.utcnow(),
        )
        await pay.insert()
        exp = Expense(
            expense_date=datetime.utcnow(), description="Test",
            amount=200.0, year=2025, month=7,
        )
        await exp.insert()

        response = await client.get("/dashboard/stats", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["properties"] == 1
        assert data["fees"] == 1
        assert data["payments"] == 1
        assert data["expenses"] == 1

    @pytest.mark.asyncio
    async def test_owner_returns_structure(
        self, client, mongomock_db, auth_headers_owner
    ):
        response = await client.get("/dashboard/stats", headers=auth_headers_owner)
        assert response.status_code == 200
        data = response.json()
        assert "properties" in data
        assert "fees" in data
        assert "payments" in data
        assert "total_debt" in data
        assert "pending_fees" in data


class TestGetOwnerDebtSummary:
    @pytest.mark.asyncio
    async def test_owner_returns_structure(
        self, client, mongomock_db, auth_headers_owner
    ):
        response = await client.get(
            "/dashboard/owner/debt-summary", headers=auth_headers_owner
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_debt" in data
        assert "properties" in data
        assert isinstance(data["properties"], list)

    @pytest.mark.asyncio
    async def test_admin_gets_403(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/dashboard/owner/debt-summary", headers=auth_headers_admin
        )
        assert response.status_code == 403


class TestGetOwnerPropertyReport:
    @pytest.mark.asyncio
    async def test_owner_returns_structure(
        self, client, mongomock_db, auth_headers_owner
    ):
        response = await client.get(
            "/dashboard/owner/property-report", headers=auth_headers_owner
        )
        assert response.status_code == 200
        data = response.json()
        assert "properties" in data
        assert isinstance(data["properties"], list)

    @pytest.mark.asyncio
    async def test_admin_gets_403(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/dashboard/owner/property-report", headers=auth_headers_admin
        )
        assert response.status_code == 403


class TestGetOwnerExpensesReport:
    @pytest.mark.asyncio
    async def test_owner_gets_expenses_grouped_by_type(
        self, client, mongomock_db, auth_headers_owner
    ):
        from app.models.expense import Expense

        for desc, amt in [("Luz", 500.0), ("Agua", 300.0), ("Mantenimiento", 200.0)]:
            exp = Expense(
                expense_date=datetime.utcnow(), description=desc,
                amount=amt, year=2025, month=7,
            )
            await exp.insert()

        response = await client.get(
            "/dashboard/owner/expenses-report", headers=auth_headers_owner
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_expenses"] == 1000.0
        assert len(data["expense_types"]) == 3

    @pytest.mark.asyncio
    async def test_admin_gets_403(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/dashboard/owner/expenses-report", headers=auth_headers_admin
        )
        assert response.status_code == 403
