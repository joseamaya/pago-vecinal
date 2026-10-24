from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

from ..utils.names import normalize_person_name


class OwnerCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    user_id: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        return normalize_person_name(value)


class OwnerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    user_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value):
        return normalize_person_name(value)


class OwnerSummary(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None


class OwnerResponse(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    user_id: Optional[str] = None
    is_active: bool
