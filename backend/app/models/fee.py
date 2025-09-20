from beanie import Document, Link
from pydantic import BaseModel
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
    due_day: int = 1  # Day of month when fees are due (1-31)

    class Settings:
        name = "fee_schedules"

class FeeScheduleCreate(BaseModel):
    amount: float
    description: str
    effective_date: datetime
    end_date: Optional[datetime] = None
    due_day: int = 1

class FeeScheduleUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    due_day: Optional[int] = None

class FeeScheduleResponse(BaseModel):
    id: str
    amount: float
    description: str
    effective_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool
    due_day: int

class FeeStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AGREEMENT = "agreement"
    PARTIALLY_PAID = "partially_paid"

class Fee(Document):
    property: Link[Property]
    fee_schedule: Link[FeeSchedule]
    user: Optional[Link[User]] = None  # Who generated the fee
    amount: float  # Derived from fee_schedule
    paid_amount: float = 0.0  # Total amount already paid
    generated_date: datetime
    year: int  # Year when fee was generated
    month: int  # Month when fee was generated
    due_date: datetime
    status: FeeStatus = FeeStatus.PENDING
    reference: Optional[str] = None  # Fee reference number
    notes: Optional[str] = None

    class Settings:
        name = "fees"

class FeeCreate(BaseModel):
    property_id: str
    fee_schedule_id: str
    due_date: datetime
    reference: Optional[str] = None
    notes: Optional[str] = None

class FeeUpdate(BaseModel):
    amount: Optional[float] = None
    paid_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[FeeStatus] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None

class FeeResponse(BaseModel):
    id: str
    property_id: str
    property_villa: str
    property_row_letter: str
    property_number: int
    property_owner_name: str
    fee_schedule_id: str
    user_id: Optional[str] = None
    amount: float
    paid_amount: float
    remaining_amount: float
    generated_date: datetime
    year: int
    month: int
    due_date: datetime
    status: FeeStatus
    reference: Optional[str] = None
    notes: Optional[str] = None