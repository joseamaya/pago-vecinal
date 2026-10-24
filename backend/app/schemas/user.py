from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from ..models.user import UserRole
from ..utils.names import normalize_person_name


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    full_name: str
    phone: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        return normalize_person_name(value)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        return normalize_person_name(value)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    is_active: bool
