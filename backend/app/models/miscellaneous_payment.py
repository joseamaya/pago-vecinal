from beanie import Document, Link
from pymongo import IndexModel, ASCENDING
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
    property: Optional[Link[Property]] = None
    user: Link[User]
    payment_type: MiscellaneousPaymentType
    amount: float
    payment_date: datetime
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: MiscellaneousPaymentStatus = MiscellaneousPaymentStatus.PENDING
    description: str
    notes: Optional[str] = None
    property_details: Optional[dict] = None
    owner_details: Optional[dict] = None

    class Settings:
        name = "miscellaneous_payments"
        indexes = [
            IndexModel([("status", ASCENDING)]),
        ]
