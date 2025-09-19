from beanie import Document, Link
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum
from .fee import Fee
from .user import User

class PaymentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Payment(Document):
    fee: Link[Fee]
    fee_id: str  # Store the fee id for easy access
    user: Link[User]  # Who made the payment
    amount: float
    payment_date: datetime
    receipt_file: Optional[str] = None  # Path to uploaded receipt image
    generated_receipt_file: Optional[str] = None  # Path to auto-generated PDF receipt
    status: PaymentStatus = PaymentStatus.PENDING
    notes: Optional[str] = None

    class Settings:
        name = "payments"

class PaymentCreate(BaseModel):
    fee_id: str
    amount: float
    notes: Optional[str] = None
    receipt_file: Optional[str] = None

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: str
    fee_id: str
    user_id: str
    amount: float
    payment_date: datetime
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: PaymentStatus
    notes: Optional[str] = None
    property_row_letter: Optional[str] = None
    property_number: Optional[int] = None
    fee_month: Optional[int] = None
    fee_year: Optional[int] = None