from beanie import Document, Link
from pydantic import BaseModel
from typing import Optional
from .user import User

class Property(Document):
    row_letter: str
    number: int
    villa: str
    owner_name: str
    owner_phone: Optional[str] = None
    owner: Optional[Link[User]] = None  # Link to User if registered

    class Settings:
        name = "properties"

class PropertyCreate(BaseModel):
    row_letter: str
    number: int
    villa: str
    owner_name: str
    owner_phone: Optional[str] = None

class PropertyUpdate(BaseModel):
    row_letter: Optional[str] = None
    number: Optional[int] = None
    villa: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None

class PropertyResponse(BaseModel):
    id: str
    row_letter: str
    number: int
    villa: str
    owner_name: str
    owner_phone: Optional[str] = None
    owner_id: Optional[str] = None