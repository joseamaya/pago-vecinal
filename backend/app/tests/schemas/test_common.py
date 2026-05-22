import pytest
from pydantic import ValidationError
from app.schemas.common import PaginatedResponse, BulkApproveRequest, PropertyBulkImportResponse, ExpenseBulkImportResponse
from app.schemas.fee import FeeCreate, FeeResponse, FeeUpdate
from app.models.fee import FeeStatus


class TestPaginatedResponse:
    def test_serializes_correctly(self):
        response = PaginatedResponse[int](
            data=[1, 2, 3],
            pagination={"page": 1, "limit": 20, "total": 100, "total_pages": 5}
        )
        assert response.data == [1, 2, 3]
        assert response.pagination["total"] == 100

    def test_works_with_empty_data(self):
        response = PaginatedResponse[str](data=[], pagination={"page": 1, "limit": 20, "total": 0, "total_pages": 0})
        assert response.data == []


class TestBulkApproveRequest:
    def test_valid_request(self):
        req = BulkApproveRequest(payment_ids=["id1", "id2", "id3"])
        assert len(req.payment_ids) == 3

    def test_empty_list(self):
        req = BulkApproveRequest(payment_ids=[])
        assert req.payment_ids == []


class TestPropertyBulkImportResponse:
    def test_valid_response(self):
        resp = PropertyBulkImportResponse(imported=10, updated=5, errors=[])
        assert resp.imported == 10
        assert resp.updated == 5

    def test_with_errors(self):
        resp = PropertyBulkImportResponse(imported=8, updated=0, errors=["Row 1: invalid data"])
        assert len(resp.errors) == 1


class TestExpenseBulkImportResponse:
    def test_valid_response(self):
        resp = ExpenseBulkImportResponse(successful_imports=5, failed_imports=2, errors=[{"row": 3, "error": "bad format"}])
        assert resp.successful_imports == 5
        assert resp.failed_imports == 2
        assert len(resp.errors) == 1
