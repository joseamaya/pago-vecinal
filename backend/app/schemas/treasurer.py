from pydantic import BaseModel
from typing import Optional


class TreasurerCreate(BaseModel):
    villa: str
    name: str
    signature: Optional[str] = None


class TreasurerUpdate(BaseModel):
    villa: Optional[str] = None
    name: Optional[str] = None
    signature: Optional[str] = None


class TreasurerResponse(BaseModel):
    id: str
    villa: str
    name: str
    signature: Optional[str] = None
