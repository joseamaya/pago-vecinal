from pydantic import BaseModel
from typing import TypeVar, Generic, List

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    pagination: dict


class BulkApproveRequest(BaseModel):
    payment_ids: List[str]


class PropertyBulkImportResponse(BaseModel):
    imported: int
    updated: int
    errors: List[str]


class ExpenseBulkImportResponse(BaseModel):
    successful_imports: int
    failed_imports: int
    errors: List[dict]
