import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.payment_service import (
    update_fee_status_based_on_payments,
    create_receipt_on_approval,
    approve_payment,
    bulk_approve_payments,
)
from app.models.payment import PaymentStatus
from app.models.fee import FeeStatus


class TestUpdateFeeStatus:
    @pytest.mark.asyncio
    async def test_completed_when_total_paid_exceeds_amount(self):
        fee = MagicMock()
        fee.id = "fee-1"
        fee.amount = 100.0
        fee.paid_amount = 0.0
        fee.status = FeeStatus.PENDING
        fee.save = AsyncMock()

        payment1 = MagicMock()
        payment1.status = PaymentStatus.APPROVED
        payment1.amount = 60.0
        payment2 = MagicMock()
        payment2.status = PaymentStatus.APPROVED
        payment2.amount = 50.0

        with patch("app.services.payment_service.Payment") as MockPayment:
            MockPayment.find.return_value.to_list = AsyncMock(return_value=[payment1, payment2])
            await update_fee_status_based_on_payments(fee)

            assert fee.paid_amount == 110.0
            assert fee.status == FeeStatus.COMPLETED
            fee.save.assert_called_once()

    @pytest.mark.asyncio
    async def test_partially_paid_when_some_amount(self):
        fee = MagicMock()
        fee.id = "fee-1"
        fee.amount = 100.0
        fee.paid_amount = 0.0
        fee.status = FeeStatus.PENDING
        fee.save = AsyncMock()

        payment = MagicMock()
        payment.status = PaymentStatus.APPROVED
        payment.amount = 40.0

        with patch("app.services.payment_service.Payment") as MockPayment:
            MockPayment.find.return_value.to_list = AsyncMock(return_value=[payment])
            await update_fee_status_based_on_payments(fee)

            assert fee.paid_amount == 40.0
            assert fee.status == FeeStatus.PARTIALLY_PAID

    @pytest.mark.asyncio
    async def test_pending_when_no_payments(self):
        fee = MagicMock()
        fee.id = "fee-1"
        fee.amount = 100.0
        fee.paid_amount = 10.0
        fee.status = FeeStatus.PARTIALLY_PAID
        fee.save = AsyncMock()

        with patch("app.services.payment_service.Payment") as MockPayment:
            MockPayment.find.return_value.to_list = AsyncMock(return_value=[])
            await update_fee_status_based_on_payments(fee)

            assert fee.paid_amount == 0.0
            assert fee.status == FeeStatus.PENDING


    @pytest.mark.asyncio
    async def test_preserves_agreement_status(self):
        fee = MagicMock()
        fee.id = "fee-1"
        fee.amount = 100.0
        fee.paid_amount = 30.0
        fee.status = FeeStatus.AGREEMENT
        fee.save = AsyncMock()

        with patch("app.services.payment_service.Payment") as MockPayment:
            MockPayment.find.return_value.to_list = AsyncMock(return_value=[])
            await update_fee_status_based_on_payments(fee)

            assert fee.status == FeeStatus.AGREEMENT
            assert fee.paid_amount == 30.0
            fee.save.assert_not_called()
            MockPayment.find.assert_not_called()


class TestCreateReceiptOnApproval:
    @pytest.mark.asyncio
    async def test_calls_create_receipt_and_logs(self, mock_payment):
        with patch("app.services.payment_service.create_receipt_for_payment", new_callable=AsyncMock) as mock_create:
            await create_receipt_on_approval(mock_payment)
            mock_create.assert_called_once_with(mock_payment)

    @pytest.mark.asyncio
    async def test_handles_exception_gracefully(self, mock_payment):
        with patch("app.services.payment_service.create_receipt_for_payment", side_effect=Exception("PDF failed")):
            await create_receipt_on_approval(mock_payment)


class TestApprovePayment:
    @pytest.mark.asyncio
    async def test_sets_status_and_triggers_receipt(self):
        payment = MagicMock()
        payment.status = PaymentStatus.PENDING
        payment.save = AsyncMock()
        payment.fetch_link = AsyncMock()
        payment.fee = MagicMock()

        with patch("app.services.payment_service.create_receipt_for_payment", new_callable=AsyncMock):
            with patch("app.services.payment_service.update_fee_status_based_on_payments", new_callable=AsyncMock):
                with patch("app.services.payment_service.Payment") as MockPayment:
                    MockPayment.fee = "fee_link"
                    await approve_payment(payment)
                    assert payment.status == PaymentStatus.APPROVED
                    payment.save.assert_called_once()


class TestBulkApprovePayments:
    @pytest.mark.asyncio
    async def test_approves_multiple_payments(self, mock_payment):
        payment_ids = ["pay-1", "pay-2", "pay-3"]

        with patch("app.services.payment_service.Payment") as MockPayment:
            pay = MagicMock()
            pay.status = PaymentStatus.PENDING
            pay.save = AsyncMock()
            pay.fetch_link = AsyncMock()

            MockPayment.get = AsyncMock(return_value=pay)

            with patch("app.services.payment_service.approve_payment", new_callable=AsyncMock) as mock_approve:
                result = await bulk_approve_payments(payment_ids)
                assert result["approved_count"] == 3
                assert len(result["errors"]) == 0
                assert mock_approve.call_count == 3

    @pytest.mark.asyncio
    async def test_skips_already_approved(self):
        payment_ids = ["pay-1"]

        with patch("app.services.payment_service.Payment") as MockPayment:
            pay = MagicMock()
            pay.status = PaymentStatus.APPROVED
            MockPayment.get = AsyncMock(return_value=pay)

            with patch("app.services.payment_service.approve_payment", new_callable=AsyncMock) as mock_approve:
                result = await bulk_approve_payments(payment_ids)
                assert result["approved_count"] == 1
                mock_approve.assert_not_called()

    @pytest.mark.asyncio
    async def test_handles_errors_per_payment(self):
        payment_ids = ["pay-1", "pay-2"]

        with patch("app.services.payment_service.Payment") as MockPayment:
            MockPayment.get = AsyncMock(side_effect=Exception("DB error"))

            result = await bulk_approve_payments(payment_ids)
            assert result["approved_count"] == 0
            assert len(result["errors"]) == 2
            assert all(e["error"] == "DB error" for e in result["errors"])
