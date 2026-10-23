from beanie import Document, Link
from pydantic import EmailStr
from typing import Optional

from .user import User


class Owner(Document):
    full_name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    user: Optional[Link[User]] = None
    is_active: bool = True

    class Settings:
        name = "owners"
