from beanie import Document, Link
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Union
from .payment import Payment
from .miscellaneous_payment import MiscellaneousPayment

class Receipt(Document):
    correlative_number: str  # Format: REC-YYYY-XXXXX
    payment: Optional[Link[Payment]] = None
    miscellaneous_payment: Optional[Link[MiscellaneousPayment]] = None
    issue_date: datetime
    total_amount: float
    property_details: dict  # Store property info at time of receipt generation
    owner_details: dict     # Store owner info at time of receipt generation
    fee_period: Optional[str] = None  # e.g., "Enero 2024" or "Pago varios: description"
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
    issue_date: datetime
    total_amount: float
    property_details: dict
    owner_details: dict
    fee_period: Optional[str] = None
    notes: Optional[str] = None