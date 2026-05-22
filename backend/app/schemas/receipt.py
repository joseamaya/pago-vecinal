from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ReceiptCreate(BaseModel):
    payment_id: str
    fee_period: Optional[str] = None
    notes: Optional[str] = None


class ReceiptUpdate(BaseModel):
    fee_period: Optional[str] = None
    notes: Optional[str] = None


class ReceiptResponse(BaseModel):
    id: str
    correlative_number: str
    payment_id: Optional[str] = None
    miscellaneous_payment_id: Optional[str] = None
    expense_id: Optional[str] = None
    issue_date: datetime
    total_amount: float
    property_details: Optional[dict] = None
    owner_details: Optional[dict] = None
    fee_period: Optional[str] = None
    notes: Optional[str] = None
    treasurer_details: Optional[dict] = None
    generated_receipt_file: Optional[str] = None
