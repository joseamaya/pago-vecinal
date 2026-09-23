from beanie import Document, Link
from pymongo import IndexModel, ASCENDING
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
        indexes = [
            IndexModel([("villa", ASCENDING), ("row_letter", ASCENDING), ("number", ASCENDING)]),
        ]
