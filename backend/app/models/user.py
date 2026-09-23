from beanie import Document
from pydantic import EmailStr
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