from beanie import Document, Link
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum
from .user import User

class ExpenseType(str, Enum):
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"
    REPAIRS = "repairs"
    SERVICES = "services"
    UTILITIES = "utilities"
    SUPPLIES = "supplies"
    INSURANCE = "insurance"
    LEGAL = "legal"
    ADMINISTRATIVE = "administrative"
    OTHER = "other"

class ExpenseStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Expense(Document):
    user: Link[User]  # Admin who created the expense
    expense_type: ExpenseType
    amount: float
    expense_date: datetime
    receipt_file: Optional[str] = None  # Path to uploaded receipt image
    generated_receipt_file: Optional[str] = None  # Path to auto-generated PDF receipt
    status: ExpenseStatus = ExpenseStatus.PENDING
    description: str  # Description of the expense
    notes: Optional[str] = None
    beneficiary: str  # Name of the third party receiving the payment
    beneficiary_details: Optional[str] = None  # Additional details about the beneficiary

    class Settings:
        name = "expenses"

class ExpenseCreate(BaseModel):
    expense_type: ExpenseType
    amount: float
    expense_date: datetime
    description: str
    notes: Optional[str] = None
    beneficiary: str
    beneficiary_details: Optional[str] = None
    receipt_file: Optional[str] = None

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    expense_type: Optional[ExpenseType] = None
    description: Optional[str] = None
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: Optional[ExpenseStatus] = None
    notes: Optional[str] = None
    beneficiary: Optional[str] = None
    beneficiary_details: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: str
    user_id: str
    expense_type: ExpenseType
    amount: float
    expense_date: datetime
    receipt_file: Optional[str] = None
    generated_receipt_file: Optional[str] = None
    status: ExpenseStatus
    description: str
    notes: Optional[str] = None
    beneficiary: str
    beneficiary_details: Optional[str] = None
    created_at: datetime