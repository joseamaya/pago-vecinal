import pytest
from pydantic import ValidationError
from datetime import datetime
from app.schemas.fee import FeeCreate, FeeUpdate, FeeResponse
from app.models.fee import FeeStatus


class TestFeeCreate:
    def test_valid_data(self):
        data = FeeCreate(
            property_id="507f1f77bcf86cd799439021",
            fee_schedule_id="507f1f77bcf86cd799439031",
            due_date=datetime(2025, 6, 1)
        )
        assert data.property_id == "507f1f77bcf86cd799439021"

    def test_missing_required_raises_error(self):
        with pytest.raises(ValidationError):
            FeeCreate(property_id="abc", fee_schedule_id="def")


class TestFeeUpdate:
    def test_all_fields_optional(self):
        data = FeeUpdate()
        assert data.amount is None

    def test_partial_update(self):
        data = FeeUpdate(amount=200.0, notes="Updated")
        assert data.amount == 200.0
        assert data.notes == "Updated"
        assert data.status is None


class TestFeeResponse:
    def test_serialization(self):
        resp = FeeResponse(
            id="fee-1",
            property_id="prop-1",
            property_villa="Villa 1",
            property_row_letter="A",
            property_number=1,
            property_owner_name="Owner",
            fee_schedule_id="sched-1",
            amount=150.0,
            paid_amount=50.0,
            remaining_amount=100.0,
            generated_date=datetime(2025, 1, 1),
            year=2025,
            month=1,
            due_date=datetime(2025, 2, 1),
            status=FeeStatus.PENDING,
        )
        resp_dict = resp.model_dump()
        assert resp_dict["id"] == "fee-1"
        assert resp_dict["remaining_amount"] == 100.0
        assert resp_dict["status"] == "pending"
