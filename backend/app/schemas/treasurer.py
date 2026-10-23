from pydantic import BaseModel, field_validator
from typing import Optional

from ..utils.names import normalize_person_name


class TreasurerCreate(BaseModel):
    villa: str
    name: str
    signature: Optional[str] = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        return normalize_person_name(value)


class TreasurerUpdate(BaseModel):
    villa: Optional[str] = None
    name: Optional[str] = None
    signature: Optional[str] = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        return normalize_person_name(value)


class TreasurerResponse(BaseModel):
    id: str
    villa: str
    name: str
    signature: Optional[str] = None
