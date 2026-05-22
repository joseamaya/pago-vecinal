from pydantic import BaseModel
from typing import Optional


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
