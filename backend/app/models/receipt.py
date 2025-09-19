from beanie import Document, Link
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Union
from .payment import Payment
from .miscellaneous_payment import MiscellaneousPayment
from .expense import Expense

class Receipt(Document):
    correlative_number: str  # Format: REC-YYYY-XXXXX
    payment: Optional[Link[Payment]] = None
    miscellaneous_payment: Optional[Link[MiscellaneousPayment]] = None
    expense: Optional[Link[Expense]] = None
    issue_date: datetime
    total_amount: float
    property_details: Optional[dict] = None  # Store property info at time of receipt generation (None for admin expenses)
    owner_details: Optional[dict] = None     # Store owner info at time of receipt generation (None for admin expenses)
    fee_period: Optional[str] = None  # e.g., "Enero 2024" or "Pago varios: description" or "Gasto administrativo: description"
    notes: Optional[str] = None

    class Settings:
        name = "receipts"

class ReceiptCreate(BaseModel):
    payment_id: str
    fee_period: Optional[str] = None
    notes: Optional[str] = None

class ReceiptResponse(BaseModel):
    id: str
    correlative_number: str
    payment_id: Optional[str] = None
    miscellaneous_payment_id: Optional[str] = None
    expense_id: Optional[str] = None
    issue_date: datetime
    total_amount: float
    property_details: Optional[dict] = None
    owner_details: Optional[dict] = None
    fee_period: Optional[str] = None
    notes: Optional[str] = None