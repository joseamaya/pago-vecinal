from beanie import Document, Link
from pydantic import BaseModel
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

class AgreementInstallmentCreate(BaseModel):
    installment_number: int
    amount: float
    due_date: datetime
    notes: Optional[str] = None

class AgreementInstallmentUpdate(BaseModel):
    paid_date: Optional[datetime] = None
    status: Optional[AgreementInstallmentStatus] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class AgreementInstallmentResponse(BaseModel):
    id: str
    agreement_id: str
    installment_number: int
    amount: float
    due_date: datetime
    paid_date: Optional[datetime] = None
    status: AgreementInstallmentStatus
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class Agreement(Document):
    property: Link[Property]
    fees: List[Link[Fee]]  # Fees covered by this agreement
    user: Link[User]  # Who created the agreement
    total_debt: float
    monthly_amount: float
    installments_count: int
    start_date: datetime
    end_date: datetime
    status: AgreementStatus = AgreementStatus.ACTIVE
    agreement_number: str  # Unique agreement reference
    pdf_file: Optional[str] = None  # Path to generated PDF
    notes: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "agreements"

class AgreementCreate(BaseModel):
    property_id: str
    fee_ids: List[str]  # List of fee IDs to include in agreement
    monthly_amount: float
    installments_count: int
    start_date: datetime
    notes: Optional[str] = None

class AgreementUpdate(BaseModel):
    monthly_amount: Optional[float] = None
    installments_count: Optional[int] = None
    start_date: Optional[datetime] = None
    status: Optional[AgreementStatus] = None
    notes: Optional[str] = None

class AgreementResponse(BaseModel):
    id: str
    property_id: str
    property_villa: str
    property_row_letter: str
    property_number: int
    property_owner_name: str
    fee_ids: List[str]
    user_id: str
    total_debt: float
    monthly_amount: float
    installments_count: int
    start_date: datetime
    end_date: datetime
    status: AgreementStatus
    agreement_number: str
    pdf_file: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    installments: List[AgreementInstallmentResponse] = []