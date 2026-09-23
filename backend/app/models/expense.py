from beanie import Document
from datetime import datetime
from typing import Optional

class Expense(Document):
    expense_date: datetime
    description: str
    amount: float
    year: Optional[int] = None
    month: Optional[int] = None

    class Settings:
        name = "expenses"
