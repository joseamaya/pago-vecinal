import pytest
from pydantic import ValidationError
from datetime import datetime
from app.schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse
from app.models.payment import PaymentStatus


class TestPaymentCreate:
    def test_valid_data(self):
        data = PaymentCreate(fee_id="fee-1", amount=150.0)
        assert data.fee_id == "fee-1"
        assert data.amount == 150.0

    def test_missing_fee_id_raises_error(self):
        with pytest.raises(ValidationError):
            PaymentCreate(amount=150.0)

    def test_notes_optional(self):
        data = PaymentCreate(fee_id="fee-1", amount=150.0)
        assert data.notes is None


class TestPaymentUpdate:
    def test_all_fields_optional(self):
        data = PaymentUpdate()
        assert data.amount is None
        assert data.status is None
        assert data.notes is None


class TestPaymentResponse:
    def test_optional_fields_accept_none(self):
        resp = PaymentResponse(
            id="pay-1",
            fee_id="fee-1",
            user_id="user-1",
            amount=150.0,
            payment_date=datetime(2025, 1, 15),
            status=PaymentStatus.APPROVED,
            receipt_correlative_number=None,
            receipt_issue_date=None,
        )
        assert resp.receipt_correlative_number is None
        assert resp.receipt_issue_date is None

    def test_optional_fields_with_values(self):
        now = datetime.utcnow()
        resp = PaymentResponse(
            id="pay-1",
            fee_id="fee-1",
            user_id="user-1",
            amount=150.0,
            payment_date=now,
            status=PaymentStatus.APPROVED,
            property_row_letter="A",
            property_number=1,
            fee_month=5,
            fee_year=2025,
            receipt_correlative_number="CUOT-2025-00001",
            receipt_issue_date=now,
        )
        assert resp.property_row_letter == "A"
        assert resp.status == PaymentStatus.APPROVED
