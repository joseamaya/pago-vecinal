from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.miscellaneous_payment import MiscellaneousPaymentType, MiscellaneousPaymentStatus


class MiscellaneousPaymentCreate(BaseModel):
    property_id: Optional[str] = None
    payment_type: MiscellaneousPaymentType
    amount: float
    payment_date: datetime
    description: str
    notes: Optional[str] = None
    receipt_file: Optional[str] = None


class MiscellaneousPaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_type: Optional[MiscellaneousPaymentType] = None
    description: Optional[str] = None
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: Optional[MiscellaneousPaymentStatus] = None
    notes: Optional[str] = None


class MiscellaneousPaymentResponse(BaseModel):
    id: str
    property_id: Optional[str] = None
    property_villa: Optional[str] = None
    property_row_letter: Optional[str] = None
    property_number: Optional[int] = None
    property_owner_name: Optional[str] = None
    user_id: str
    payment_type: MiscellaneousPaymentType
    amount: float
    payment_date: datetime
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: MiscellaneousPaymentStatus
    description: str
    notes: Optional[str] = None
    created_at: datetime
