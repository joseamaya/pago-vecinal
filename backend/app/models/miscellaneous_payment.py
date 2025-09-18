from beanie import Document, Link
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum
from .user import User
from .property import Property

class MiscellaneousPaymentType(str, Enum):
    MAINTENANCE = "maintenance"
    REPAIRS = "repairs"
    SERVICES = "services"
    PENALTIES = "penalties"
    OTHER = "other"

class MiscellaneousPaymentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class MiscellaneousPayment(Document):
    property: Optional[Link[Property]] = None  # Optional link to property
    user: Link[User]  # Who created the payment
    payment_type: MiscellaneousPaymentType
    amount: float
    payment_date: datetime
    receipt_file: Optional[str] = None  # Path to uploaded receipt image
    generated_receipt_file: Optional[str] = None  # Path to auto-generated PDF receipt
    status: MiscellaneousPaymentStatus = MiscellaneousPaymentStatus.PENDING
    description: str  # Description of what the payment is for
    notes: Optional[str] = None
    property_details: Optional[dict] = None  # Snapshot of property details for receipt
    owner_details: Optional[dict] = None  # Snapshot of owner details for receipt

    class Settings:
        name = "miscellaneous_payments"

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