import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta
from app.main import app


EXCEL_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_CT = "application/pdf"


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


@pytest.fixture
async def report_data(mongomock_db, test_property, test_fee_schedule, test_user):
    from app.models.fee import Fee
    from app.models.payment import Payment
    from app.models.expense import Expense

    fee = Fee(
        property=test_property,
        fee_schedule=test_fee_schedule,
        amount=150.0,
        paid_amount=150.0,
        generated_date=datetime.utcnow(),
        year=2025,
        month=7,
        due_date=datetime.utcnow() - timedelta(days=30),
        status="completed",
    )
    await fee.insert()
    payment = Payment(
        fee=fee,
        fee_id=str(fee.id),
        user=test_user,
        amount=150.0,
        payment_date=datetime.utcnow(),
        status="approved",
    )
    await payment.insert()
    expense = Expense(
        expense_date=datetime.utcnow(),
        description="Luz",
        amount=200.0,
        year=2025,
        month=7,
    )
    await expense.insert()
    return {"property": test_property, "fee": fee, "payment": payment, "expense": expense}


@pytest.fixture
def patch_payment_fetch_link(test_fee, test_property):
    from app.models.payment import Payment

    async def fake_fetch_link(self, link_field):
        self.fee = test_fee
        self.fee.property = test_property

    with patch.object(Payment, "fetch_link", fake_fetch_link):
        yield


class TestPaymentHistory:
    @pytest.mark.asyncio
    async def test_all_properties_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/payment-history", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert "historial_pagos_todas.xlsx" in response.headers["content-disposition"]
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_single_property_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            f"/reports/payment-history?property_id={report_data['property'].id}",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_single_property_pdf(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            f"/reports/payment-history?property_id={report_data['property'].id}&format=pdf",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == PDF_CT
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/reports/payment-history?property_id=507f1f77bcf86cd799439999",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_period(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/reports/payment-history?start_year=2026&start_month=1&end_year=2025&end_month=7",
            headers=auth_headers_admin,
        )
        assert response.status_code == 400


class TestOutstandingFees:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/outstanding-fees?format=excel", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_pdf(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/outstanding-fees", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == PDF_CT
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        response = await client.get("/reports/outstanding-fees", headers=auth_headers_owner)
        assert response.status_code == 403


class TestMonthlyPaymentSummary:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/monthly-summary/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_invalid_period(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/reports/monthly-summary/2026/1/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestPaymentsSummary:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/payments-summary/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestFeeContributionSummary:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/fee-contribution-summary/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestFeePaymentMatrix:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/fee-payment-matrix/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestPaidFeesSummary:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/paid-fees-summary/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestMonthlyFees:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/monthly-fees/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestAnnualPropertyStatement:
    @pytest.mark.asyncio
    async def test_all_properties_excel_admin(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/annual-statement/2025", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_single_property_pdf(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            f"/reports/annual-statement/2025?property_id={report_data['property'].id}",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == PDF_CT
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/reports/annual-statement/2025?property_id=507f1f77bcf86cd799439999",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_forbidden_all_properties(self, client, mongomock_db, auth_headers_owner):
        response = await client.get("/reports/annual-statement/2025", headers=auth_headers_owner)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_owner_can_download_own_statement(
        self, client, mongomock_db, test_owner, test_fee_schedule, auth_headers_owner
    ):
        from app.models.property import Property

        prop = Property(
            row_letter="Z",
            number=9,
            villa="Villa Z",
            owner_name=test_owner.full_name,
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        )
        await prop.insert()

        response = await client.get(
            f"/reports/annual-statement/2025?property_id={prop.id}",
            headers=auth_headers_owner,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == PDF_CT


class TestAllPayments:
    @pytest.mark.asyncio
    async def test_excel(
        self, client, mongomock_db, report_data, auth_headers_admin, patch_payment_fetch_link
    ):
        response = await client.get("/reports/all-payments", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestExpensesReport:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/expenses", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestFilteredFees:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/filtered-fees?year=2025&month=7&status=completed",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestTrafficLight:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get("/reports/traffic-light", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"


class TestExpensesByPeriod:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/expenses/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"

    @pytest.mark.asyncio
    async def test_invalid_period(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/reports/expenses/2025/13/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestDetailedExpenses:
    @pytest.mark.asyncio
    async def test_excel(self, client, mongomock_db, report_data, auth_headers_admin):
        response = await client.get(
            "/reports/detailed-expenses/2025/7/2025/7", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == EXCEL_CT
        assert response.content[:2] == b"PK"