from beanie import Document, Link
from pymongo import IndexModel, ASCENDING
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
    fee_id: str
    user: Link[User]
    amount: float
    payment_date: datetime
    status: PaymentStatus = PaymentStatus.PENDING
    notes: Optional[str] = None

    class Settings:
        name = "payments"
        indexes = [
            IndexModel([("fee_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]
