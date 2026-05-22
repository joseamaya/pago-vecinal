from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ExpenseCreate(BaseModel):
    expense_date: datetime
    description: str
    amount: float
    year: Optional[int] = None
    month: Optional[int] = None


class ExpenseUpdate(BaseModel):
    expense_date: Optional[datetime] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    year: Optional[int] = None
    month: Optional[int] = None


class ExpenseResponse(BaseModel):
    id: str
    expense_date: datetime
    description: str
    amount: float
    year: Optional[int] = None
    month: Optional[int] = None
    created_at: datetime
