from beanie import Document, Link
from pymongo import IndexModel, ASCENDING
from datetime import datetime
from typing import Optional
from enum import Enum
from .property import Property
from .user import User

class FeeSchedule(Document):
    amount: float
    description: str
    effective_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True
    due_day: int = 1

    class Settings:
        name = "fee_schedules"

class FeeStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIALLY_PAID = "partially_paid"
    AGREEMENT = "agreement"

class Fee(Document):
    property: Link[Property]
    fee_schedule: Link[FeeSchedule]
    user: Optional[Link[User]] = None
    amount: float
    paid_amount: float = 0.0
    generated_date: datetime
    year: int
    month: int
    due_date: datetime
    status: FeeStatus = FeeStatus.PENDING
    reference: Optional[str] = None
    notes: Optional[str] = None

    class Settings:
        name = "fees"
        indexes = [
            IndexModel([("year", ASCENDING), ("month", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]
