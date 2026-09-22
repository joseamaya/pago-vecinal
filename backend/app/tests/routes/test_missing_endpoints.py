import io
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


def make_excel(headers, rows):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture
async def test_misc_payment(mongomock_db, test_owner_user):
    from app.models.miscellaneous_payment import (
        MiscellaneousPayment,
        MiscellaneousPaymentType,
        MiscellaneousPaymentStatus,
    )

    payment = MiscellaneousPayment(
        user=test_owner_user,
        payment_type=MiscellaneousPaymentType.OTHER,
        amount=50.0,
        payment_date=datetime.utcnow(),
        description="Pago jardineria",
        status=MiscellaneousPaymentStatus.PENDING,
    )
    await payment.insert()
    return payment


@pytest.fixture
async def test_approved_misc_payment(mongomock_db, test_owner_user):
    from app.models.miscellaneous_payment import (
        MiscellaneousPayment,
        MiscellaneousPaymentType,
        MiscellaneousPaymentStatus,
    )

    payment = MiscellaneousPayment(
        user=test_owner_user,
        payment_type=MiscellaneousPaymentType.OTHER,
        amount=50.0,
        payment_date=datetime.utcnow(),
        description="Pago jardineria",
        status=MiscellaneousPaymentStatus.APPROVED,
    )
    await payment.insert()
    return payment


@pytest.fixture
def resolve_links(test_fee, test_property, test_user):
    from app.models.payment import Payment
    from app.models.fee import Fee

    async def fake_payment_fetch_link(self, link_field, fetch_links=False):
        name = str(link_field)
        if name == "fee":
            self.fee = test_fee
        elif name == "user":
            self.user = test_user

    async def fake_fee_fetch_link(self, link_field, fetch_links=False):
        name = str(link_field)
        if name == "property":
            self.property = test_property

    with patch.object(Payment, "fetch_link", fake_payment_fetch_link), patch.object(
        Fee, "fetch_link", fake_fee_fetch_link
    ):
        yield


class TestBulkImportProperties:
    @pytest.mark.asyncio
    async def test_imports_new_properties(self, client, mongomock_db, auth_headers_admin):
        from app.models.property import Property

        content = make_excel(
            ["Villa", "Fila", "Numero", "Propietario", "Telefono"],
            [
                ["Villa 1", "A", 1, "Juan", "555-111"],
                ["Villa 2", "B", 2, "Maria", "555-222"],
            ],
        )
        response = await client.post(
            "/properties/bulk-import",
            files={"file": ("props.xlsx", content, XLSX_CT)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 2
        assert data["updated"] == 0
        assert data["errors"] == []
        assert await Property.find_all().count() == 2

    @pytest.mark.asyncio
    async def test_updates_existing_property(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        content = make_excel(
            ["Villa", "Fila", "Numero", "Propietario", "Telefono"],
            [["Villa 1", "A", 1, "Nuevo Dueño", "555-999"]],
        )
        response = await client.post(
            "/properties/bulk-import",
            files={"file": ("props.xlsx", content, XLSX_CT)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 0
        assert data["updated"] == 1

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        content = make_excel(["Villa", "Fila", "Numero", "Propietario"], [["V", "A", 1, "X"]])
        response = await client.post(
            "/properties/bulk-import",
            files={"file": ("props.xlsx", content, XLSX_CT)},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_file_extension(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/properties/bulk-import",
            files={"file": ("props.csv", b"data", "text/csv")},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400


class TestDownloadGeneratedReceipt:
    @pytest.mark.asyncio
    async def test_returns_pdf(
        self, client, mongomock_db, test_payment, test_receipt, auth_headers_admin, resolve_links
    ):
        from app.models.receipt import Receipt
        from io import BytesIO
        from unittest.mock import MagicMock

        payment_link = MagicMock()
        payment_link.fetch = AsyncMock(return_value=test_payment)
        test_receipt.payment = payment_link

        with patch.object(Receipt, "find_one", new_callable=AsyncMock, return_value=test_receipt):
            with patch(
                "app.routes.payments.generate_receipt_pdf",
                return_value=BytesIO(b"%PDF-1.4 mock"),
            ):
                response = await client.get(
                    f"/payments/{test_payment.id}/download-receipt", headers=auth_headers_admin
                )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_payment_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/payments/507f1f77bcf86cd799439999/download-receipt",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_no_receipt(
        self, client, mongomock_db, test_payment, auth_headers_admin, resolve_links
    ):
        from app.models.receipt import Receipt

        with patch.object(Receipt, "find_one", new_callable=AsyncMock, return_value=None):
            response = await client.get(
                f"/payments/{test_payment.id}/download-receipt", headers=auth_headers_admin
            )
        assert response.status_code == 404


class TestBulkImportPayments:
    @pytest.mark.asyncio
    async def test_imports_payment(
        self, client, mongomock_db, test_property, test_fee, auth_headers_admin
    ):
        from app.models.fee import Fee

        content = make_excel(
            ["Villa", "Fila", "Número", "Año", "Mes", "Monto", "Fecha de Pago", "Notas"],
            [
                [
                    "Villa 1", "A", 1, 2025, 5, 150.0,
                    datetime(2025, 5, 20), "Pago cuota",
                ]
            ],
        )

        with patch(
            "app.routes.payments.Fee.find_one", new_callable=AsyncMock, return_value=test_fee
        ):
            with patch(
                "app.routes.payments.create_receipt_on_approval", new_callable=AsyncMock
            ):
                with patch(
                    "app.routes.payments.update_fee_status_based_on_payments",
                    new_callable=AsyncMock,
                ):
                    response = await client.post(
                        "/payments/bulk-import",
                        files={"file": ("pagos.xlsx", content, XLSX_CT)},
                        headers=auth_headers_admin,
                    )
        assert response.status_code == 200
        data = response.json()
        assert data["successful_imports"] == 1
        assert data["failed_imports"] == 0

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        content = make_excel(["Villa", "Fila", "Número", "Año", "Mes", "Monto", "Fecha de Pago"], [])
        response = await client.post(
            "/payments/bulk-import",
            files={"file": ("pagos.xlsx", content, XLSX_CT)},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_extension(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/payments/bulk-import",
            files={"file": ("pagos.csv", b"data", "text/csv")},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400


class TestUpdateReceipt:
    @pytest.mark.asyncio
    async def test_updates_receipt(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin
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
                    f"/receipts/{test_receipt.id}",
                    json={"fee_period": "6/2025", "notes": "Actualizado"},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Actualizado"

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/receipts/507f1f77bcf86cd799439999",
            json={"notes": "x"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestRegenerateReceiptPdf:
    @pytest.mark.asyncio
    async def test_regenerates(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin, resolve_links
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
                    f"/receipts/{test_receipt.id}/regenerate-pdf", headers=auth_headers_admin
                )
        assert response.status_code == 200
        assert "regenerated" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/receipts/507f1f77bcf86cd799439999/regenerate-pdf", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestRegenerateAllReceiptPdfs:
    @pytest.mark.asyncio
    async def test_regenerates_all(
        self, client, mongomock_db, test_receipt, test_payment, auth_headers_admin, resolve_links
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

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        response = await client.post("/receipts/regenerate-all-pdfs", headers=auth_headers_owner)
        assert response.status_code == 403


class TestUpdateMiscellaneousPayment:
    @pytest.mark.asyncio
    async def test_updates_fields(
        self, client, mongomock_db, test_misc_payment, auth_headers_admin
    ):
        response = await client.put(
            f"/miscellaneous-payments/{test_misc_payment.id}",
            data={"amount": "75.0", "description": "Nuevo gasto"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 75.0
        assert data["description"] == "Nuevo gasto"

    @pytest.mark.asyncio
    async def test_approves_and_creates_receipt(
        self, client, mongomock_db, test_misc_payment, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.miscellaneous_payments.generate_receipt_pdf",
            return_value=BytesIO(b"%PDF-1.4 mock"),
        ):
            with patch(
                "app.routes.miscellaneous_payments.upload_receipt_pdf",
                return_value="https://cloud.test/recibo.pdf",
            ):
                response = await client.put(
                    f"/miscellaneous-payments/{test_misc_payment.id}",
                    data={"status": "approved"},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/miscellaneous-payments/507f1f77bcf86cd799439999",
            data={"amount": "10.0"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDownloadMiscellaneousReceipt:
    @pytest.mark.asyncio
    async def test_returns_pdf_for_approved(
        self, client, mongomock_db, test_approved_misc_payment, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.miscellaneous_payments.generate_receipt_pdf",
            return_value=BytesIO(b"%PDF-1.4 mock"),
        ):
            response = await client.get(
                f"/miscellaneous-payments/{test_approved_misc_payment.id}/download-receipt",
                headers=auth_headers_admin,
            )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_payment_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/miscellaneous-payments/507f1f77bcf86cd799439999/download-receipt",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_non_approved_rejected(
        self, client, mongomock_db, test_misc_payment, auth_headers_admin
    ):
        response = await client.get(
            f"/miscellaneous-payments/{test_misc_payment.id}/download-receipt",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestBulkApproveMiscellaneousPayments:
    @pytest.mark.asyncio
    async def test_approves_payment(
        self, client, mongomock_db, test_misc_payment, auth_headers_admin
    ):
        from io import BytesIO

        with patch(
            "app.routes.miscellaneous_payments.generate_receipt_pdf",
            return_value=BytesIO(b"%PDF-1.4 mock"),
        ):
            with patch(
                "app.routes.miscellaneous_payments.upload_receipt_pdf",
                return_value="https://cloud.test/recibo.pdf",
            ):
                response = await client.post(
                    "/miscellaneous-payments/bulk-approve",
                    json={"payment_ids": [str(test_misc_payment.id)]},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        data = response.json()
        assert data["approved_count"] == 1

    @pytest.mark.asyncio
    async def test_empty_list_400(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/miscellaneous-payments/bulk-approve",
            json={"payment_ids": []},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/miscellaneous-payments/bulk-approve",
            json={"payment_ids": ["x"]},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestBulkImportExpenses:
    @pytest.mark.asyncio
    async def test_imports_expenses(self, client, mongomock_db, auth_headers_admin):
        from app.models.expense import Expense

        content = make_excel(
            ["Fecha de Gasto", "Descripción", "Monto", "Año", "Mes"],
            [
                [datetime(2025, 7, 10), "Luz", 200.0, 2025, 7],
                [datetime(2025, 7, 12), "Agua", 100.0, 2025, 7],
            ],
        )
        response = await client.post(
            "/expenses/bulk-import",
            files={"file": ("gastos.xlsx", content, XLSX_CT)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["successful_imports"] == 2
        assert data["failed_imports"] == 0
        assert await Expense.find_all().count() == 2

    @pytest.mark.asyncio
    async def test_owner_forbidden(self, client, mongomock_db, auth_headers_owner):
        content = make_excel(["Fecha de Gasto", "Descripción", "Monto", "Año", "Mes"], [])
        response = await client.post(
            "/expenses/bulk-import",
            files={"file": ("gastos.xlsx", content, XLSX_CT)},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_extension(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/expenses/bulk-import",
            files={"file": ("gastos.csv", b"data", "text/csv")},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400


class TestUploadSignature:
    @pytest.mark.asyncio
    async def test_uploads_signature(
        self, client, mongomock_db, auth_headers_admin, tmp_path, monkeypatch
    ):
        monkeypatch.chdir(tmp_path)
        response = await client.post(
            "/treasurers/upload-signature",
            files={"file": ("firma.png", b"\x89PNG\r\n\x1a\n", "image/png")},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["file_path"].endswith("firma.png")

    @pytest.mark.asyncio
    async def test_owner_forbidden(
        self, client, mongomock_db, auth_headers_owner, tmp_path, monkeypatch
    ):
        monkeypatch.chdir(tmp_path)
        response = await client.post(
            "/treasurers/upload-signature",
            files={"file": ("firma.png", b"data", "image/png")},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_content_type(
        self, client, mongomock_db, auth_headers_admin, tmp_path, monkeypatch
    ):
        monkeypatch.chdir(tmp_path)
        response = await client.post(
            "/treasurers/upload-signature",
            files={"file": ("firma.txt", b"data", "text/plain")},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400
