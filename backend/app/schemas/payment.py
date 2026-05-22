from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.payment import PaymentStatus


class PaymentCreate(BaseModel):
    fee_id: str
    amount: float
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    fee_id: str
    user_id: str
    amount: float
    payment_date: datetime
    status: PaymentStatus
    notes: Optional[str] = None
    property_row_letter: Optional[str] = None
    property_number: Optional[int] = None
    fee_month: Optional[int] = None
    fee_year: Optional[int] = None
    receipt_correlative_number: Optional[str] = None
    receipt_issue_date: Optional[datetime] = None
