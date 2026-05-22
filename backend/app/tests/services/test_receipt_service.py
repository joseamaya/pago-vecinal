import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
from app.services.receipt_service import generate_correlative_number, create_receipt_for_payment


class TestGenerateCorrelativeNumber:
    @pytest.mark.asyncio
    async def test_first_receipt_returns_00001(self):
        with patch("app.services.receipt_service.Receipt") as MockR:
            MockR.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)
            result = await generate_correlative_number(2025, "REC")
            assert result == "REC-2025-00001"

    @pytest.mark.asyncio
    async def test_increments_last_number(self):
        last = MagicMock()
        last.correlative_number = "REC-2025-00005"
        with patch("app.services.receipt_service.Receipt") as MockR:
            MockR.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=last)
            result = await generate_correlative_number(2025, "REC")
            assert result == "REC-2025-00006"

    @pytest.mark.asyncio
    async def test_custom_prefix_cuot(self):
        with patch("app.services.receipt_service.Receipt") as MockR:
            MockR.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)
            result = await generate_correlative_number(2025, "CUOT")
            assert result.startswith("CUOT-2025-")

    @pytest.mark.asyncio
    async def test_different_year_starts_at_1(self):
        with patch("app.services.receipt_service.Receipt") as MockR:
            MockR.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)
            result = await generate_correlative_number(2024, "CUOT")
            assert result == "CUOT-2024-00001"


def _make_payment():
    p = MagicMock()
    p.id = "pay-1"
    p.fee_id = "fee-1"
    p.payment_date = MagicMock()
    p.payment_date.year = 2025
    p.amount = 150.0
    p.notes = None
    p.fetch_link = AsyncMock()
    prop = MagicMock()
    prop.villa = "Villa 1"
    prop.row_letter = "A"
    prop.number = 1
    prop.owner_name = "Test Owner"
    prop.owner_phone = "555-0000"
    fee = MagicMock()
    fee.month = 5
    fee.year = 2025
    fee.property = prop
    fee.fetch_link = AsyncMock()
    p.fee = fee
    p.user = MagicMock()
    p.user.id = "user-1"
    return p


def _make_receipt_inst():
    class ReceiptInstance:
        pass

    inst = ReceiptInstance()
    inst.insert = AsyncMock()
    inst.save = AsyncMock()
    inst.payment = MagicMock()
    inst.payment.payment_date = MagicMock()
    inst.payment.fee_id = "fee-1"
    inst.correlative_number = "CUOT-2025-00001"
    inst.issue_date = MagicMock()
    inst.total_amount = 150.0
    inst.property_details = {}
    inst.owner_details = {}
    inst.fee_period = None
    inst.notes = None
    inst.treasurer_details = {}
    inst.generated_receipt_file = None
    return inst


class TestCreateReceiptForPayment:
    @pytest.mark.asyncio
    async def test_creates_receipt_with_pdf_upload(self):
        payment = _make_payment()
        inst = _make_receipt_inst()

        with patch("app.services.receipt_service.Receipt") as MockReceipt:
            MockReceipt.return_value = inst
            MockReceipt.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)

            with patch("app.services.receipt_service.Treasurer") as MockT:
                MockT.find_one = AsyncMock(return_value=None)

                with patch("app.services.receipt_service.generate_receipt_pdf", return_value=MagicMock()):
                    with patch("app.services.receipt_service.upload_receipt_pdf", return_value="https://cloud.test/file.pdf"):
                        with patch("app.services.receipt_service.Payment") as MockPayment:
                            MockPayment.fee = "fee_link"
                            receipt = await create_receipt_for_payment(payment)

                            inst.insert.assert_called_once()
                            assert receipt.generated_receipt_file == "https://cloud.test/file.pdf"
                            inst.save.assert_called_once()

    @pytest.mark.asyncio
    async def test_defaults_when_no_fee(self):
        payment = _make_payment()
        payment.fee = None
        inst = _make_receipt_inst()

        with patch("app.services.receipt_service.Receipt") as MockReceipt:
            MockReceipt.return_value = inst
            MockReceipt.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)

            with patch("app.services.receipt_service.Treasurer") as MockT:
                MockT.find_one = AsyncMock(return_value=None)

                with patch("app.services.receipt_service.generate_receipt_pdf", return_value=MagicMock()):
                    with patch("app.services.receipt_service.upload_receipt_pdf", return_value=""):
                        with patch("app.services.receipt_service.Payment") as MockPayment:
                            MockPayment.fee = "fee_link"
                            receipt = await create_receipt_for_payment(payment)
                            inst.insert.assert_called_once()
                            inst.save.assert_called_once()

    @pytest.mark.asyncio
    async def test_custom_fee_period_and_notes(self):
        payment = _make_payment()
        inst = _make_receipt_inst()

        with patch("app.services.receipt_service.Receipt") as MockReceipt:
            MockReceipt.return_value = inst
            MockReceipt.find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=None)

            with patch("app.services.receipt_service.Treasurer") as MockT:
                MockT.find_one = AsyncMock(return_value=None)

                with patch("app.services.receipt_service.generate_receipt_pdf", return_value=MagicMock()):
                    with patch("app.services.receipt_service.upload_receipt_pdf", return_value=""):
                        with patch("app.services.receipt_service.Payment") as MockPayment:
                            MockPayment.fee = "fee_link"
                            receipt = await create_receipt_for_payment(payment, fee_period="Custom", notes="Custom n")
                            inst.insert.assert_called_once()
                            inst.save.assert_called_once()
