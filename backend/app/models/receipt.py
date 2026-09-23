from beanie import Document, Link
from datetime import datetime
from typing import Optional, Union
from .payment import Payment
from .miscellaneous_payment import MiscellaneousPayment
from .expense import Expense

class Receipt(Document):
    correlative_number: str
    payment: Optional[Link[Payment]] = None
    miscellaneous_payment: Optional[Link[MiscellaneousPayment]] = None
    expense: Optional[Link[Expense]] = None
    issue_date: datetime
    total_amount: float
    property_details: Optional[dict] = None
    owner_details: Optional[dict] = None
    fee_period: Optional[str] = None
    notes: Optional[str] = None
    treasurer_details: Optional[dict] = None
    generated_receipt_file: Optional[str] = None

    class Settings:
        name = "receipts"
