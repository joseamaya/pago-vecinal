from beanie import Document, Indexed
from pydantic import EmailStr
from typing import Annotated, Optional
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    OWNER = "owner"

class User(Document):
    email: Annotated[EmailStr, Indexed()]
    password_hash: str
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    is_active: bool = True

    class Settings:
        name = "users"