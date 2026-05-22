from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.fee import FeeStatus


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
