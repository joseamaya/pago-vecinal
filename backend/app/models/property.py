from beanie import Document, Link
from typing import Optional
from .user import User

class Property(Document):
    row_letter: str
    number: int
    villa: str
    owner_name: str
    owner_phone: Optional[str] = None
    owner: Optional[Link[User]] = None

    class Settings:
        name = "properties"
