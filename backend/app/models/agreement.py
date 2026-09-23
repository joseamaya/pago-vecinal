from beanie import Document, Link
from pymongo import IndexModel, ASCENDING
from datetime import datetime
from typing import List, Optional
from enum import Enum
from .property import Property
from .fee import Fee
from .user import User

class AgreementStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DEFAULTED = "defaulted"

class AgreementInstallmentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class AgreementInstallment(Document):
    agreement: Link["Agreement"]
    installment_number: int
    amount: float
    due_date: datetime
    paid_date: Optional[datetime] = None
    status: AgreementInstallmentStatus = AgreementInstallmentStatus.PENDING
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

    class Settings:
        name = "agreement_installments"
        indexes = [
            IndexModel([("status", ASCENDING)]),
        ]

class Agreement(Document):
    property: Link[Property]
    fees: List[Link[Fee]]
    user: Link[User]
    total_debt: float
    monthly_amount: float
    installments_count: int
    start_date: datetime
    end_date: datetime
    status: AgreementStatus = AgreementStatus.ACTIVE
    agreement_number: str
    pdf_file: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "agreements"
        indexes = [
            IndexModel([("agreement_number", ASCENDING)]),
        ]
