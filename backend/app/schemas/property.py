from pydantic import BaseModel
from typing import List, Optional

from .owner import OwnerSummary


class PropertyCreate(BaseModel):
    row_letter: str
    number: int
    villa: str
    owner_ids: List[str] = []
    primary_owner_id: Optional[str] = None


class PropertyUpdate(BaseModel):
    row_letter: Optional[str] = None
    number: Optional[int] = None
    villa: Optional[str] = None
    owner_ids: Optional[List[str]] = None
    primary_owner_id: Optional[str] = None


class PropertyResponse(BaseModel):
    id: str
    row_letter: str
    number: int
    villa: str
    owner_name: str
    owner_phone: Optional[str] = None
    primary_owner_id: Optional[str] = None
    owners: List[OwnerSummary] = []
