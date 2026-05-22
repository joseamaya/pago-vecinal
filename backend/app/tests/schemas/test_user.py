import pytest
from pydantic import ValidationError
from datetime import datetime
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.models.user import UserRole


class TestUserCreate:
    def test_valid_data(self):
        data = UserCreate(
            email="test@example.com",
            password="StrongPass123!",
            role=UserRole.ADMIN,
            full_name="Test User"
        )
        assert data.email == "test@example.com"

    def test_invalid_email_raises_error(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="pass", role=UserRole.OWNER, full_name="Test")

    def test_invalid_role_raises_error(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@test.com", password="pass", role="invalid", full_name="Test")

    def test_phone_is_optional(self):
        data = UserCreate(email="a@b.com", password="pass", role=UserRole.OWNER, full_name="T")
        assert data.phone is None


class TestUserUpdate:
    def test_all_fields_optional(self):
        data = UserUpdate()
        assert data.full_name is None
        assert data.phone is None
        assert data.is_active is None


class TestUserResponse:
    def test_serialization(self):
        resp = UserResponse(
            id="user-1",
            email="test@test.com",
            role=UserRole.ADMIN,
            full_name="Admin",
            phone=None,
            is_active=True
        )
        assert resp.model_dump()["role"] == "admin"
