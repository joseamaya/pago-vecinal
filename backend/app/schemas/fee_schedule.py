from pydantic import BaseModel
from datetime import datetime
from typing import Optional


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
