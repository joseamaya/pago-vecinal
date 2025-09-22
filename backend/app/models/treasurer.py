from beanie import Document
from pydantic import BaseModel
from typing import Optional

class Treasurer(Document):
    name: str
    signature: Optional[str] = None

    class Settings:
        name = "treasurers"

class TreasurerCreate(BaseModel):
    name: str
    signature: Optional[str] = None

class TreasurerUpdate(BaseModel):
    name: Optional[str] = None
    signature: Optional[str] = None

class TreasurerResponse(BaseModel):
    id: str
    name: str
    signature: Optional[str] = None