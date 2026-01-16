from beanie import Document
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class Expense(Document):
    expense_date: datetime  # Date of the expense
    description: str  # Concept/description of the expense
    amount: float
    year: Optional[int] = None  # Year of the expense (optional, calculated from expense_date if not provided)
    month: Optional[int] = None  # Month of the expense (optional, calculated from expense_date if not provided)

    class Settings:
        name = "expenses"

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