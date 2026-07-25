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


@pytest.fixture
async def test_expense(mongomock_db):
    from app.models.expense import Expense
    expense = Expense(
        expense_date=datetime.utcnow(),
        description="Test expense",
        amount=100.0,
        year=2026,
        month=7,
    )
    await expense.insert()
    return expense


class TestListExpenses:
    @pytest.mark.asyncio
    async def test_returns_expenses(
        self, client, mongomock_db, test_expense, auth_headers_admin
    ):
        response = await client.get("/expenses/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["amount"] == 100.0

    @pytest.mark.asyncio
    async def test_owner_cannot_list(self, client, mongomock_db, auth_headers_owner):
        response = await client.get("/expenses/", headers=auth_headers_owner)
        assert response.status_code == 403


class TestGetExpense:
    @pytest.mark.asyncio
    async def test_returns_single(
        self, client, mongomock_db, test_expense, auth_headers_admin
    ):
        expense_id = str(test_expense.id)
        response = await client.get(f"/expenses/{expense_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 100.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/expenses/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestCreateExpense:
    @pytest.mark.asyncio
    async def test_creates_expense(self, client, mongomock_db, auth_headers_admin):
        from app.models.expense import Expense

        response = await client.post(
            "/expenses/",
            data={
                "expense_date": datetime.utcnow().isoformat(),
                "description": "New expense",
                "amount": "250.0",
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 250.0

        expenses = await Expense.find_all().to_list()
        assert len(expenses) == 1

    @pytest.mark.asyncio
    async def test_owner_cannot_create(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/expenses/",
            data={
                "expense_date": datetime.utcnow().isoformat(),
                "description": "Hack",
                "amount": "100.0",
            },
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestUpdateExpense:
    @pytest.mark.asyncio
    async def test_updates_expense(
        self, client, mongomock_db, test_expense, auth_headers_admin
    ):
        expense_id = str(test_expense.id)
        response = await client.put(
            f"/expenses/{expense_id}",
            data={"amount": "300.0"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 300.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/expenses/507f1f77bcf86cd799439999",
            data={"amount": "100.0"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteExpense:
    @pytest.mark.asyncio
    async def test_deletes_expense(
        self, client, mongomock_db, test_expense, auth_headers_admin
    ):
        from app.models.expense import Expense

        expense_id = str(test_expense.id)
        response = await client.delete(f"/expenses/{expense_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Expense.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/expenses/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(
        self, client, mongomock_db, test_expense, auth_headers_owner
    ):
        response = await client.delete(
            f"/expenses/{test_expense.id}", headers=auth_headers_owner
        )
        assert response.status_code == 403
