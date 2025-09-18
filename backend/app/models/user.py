from beanie import Document
from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    OWNER = "owner"

class User(Document):
    email: EmailStr
    password_hash: str
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    is_active: bool = True

    class Settings:
        name = "users"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    full_name: str
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    is_active: bool