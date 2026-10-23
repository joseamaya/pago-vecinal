from beanie import Document, PydanticObjectId
from pymongo import IndexModel, ASCENDING
from typing import List, Optional


class Property(Document):
    row_letter: str
    number: int
    villa: str
    owners: List[PydanticObjectId] = []
    primary_owner: Optional[PydanticObjectId] = None
    owner_name: str
    owner_phone: Optional[str] = None

    class Settings:
        name = "properties"
        indexes = [
            IndexModel([("villa", ASCENDING), ("row_letter", ASCENDING), ("number", ASCENDING)]),
        ]
