import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from app.config.settings import Settings
from app.auth.utils import create_access_token


@pytest.fixture
def settings_override(monkeypatch):
    monkeypatch.setenv("MONGODB_URL", "mongodb://test:27017")
    monkeypatch.setenv("DATABASE_NAME", "pago_vecinal_test")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-testing-only")
    monkeypatch.setenv("ALGORITHM", "HS256")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1")
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "test-cloud")
    monkeypatch.setenv("CLOUDINARY_API_KEY", "test-api-key")
    monkeypatch.setenv("CLOUDINARY_API_SECRET", "test-api-secret")
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "admin@test.com")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "TestPass123")
    monkeypatch.setenv("INITIAL_ADMIN_NAME", "TestAdmin")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    return Settings()


@pytest.fixture
def mock_user():
    import bcrypt
    hashed = bcrypt.hashpw(b"test-password", bcrypt.gensalt()).decode("utf-8")

    class MockUser:
        id = "507f1f77bcf86cd799439011"
        email = "test@example.com"
        password_hash = hashed
        role = "admin"
        full_name = "Test User"
        phone = "555-1234"
        is_active = True

    return MockUser()


@pytest.fixture
def mock_owner_user():
    class MockUser:
        id = "507f1f77bcf86cd799439012"
        email = "owner@example.com"
        password_hash = "$2b$12$zyxwvutsrqponmlkjihgfedcba"
        role = "owner"
        full_name = "Owner User"
        phone = "555-5678"
        is_active = True

    return MockUser()


@pytest.fixture
def auth_headers(mock_user):
    token = create_access_token(data={"sub": mock_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def owner_auth_headers(mock_owner_user):
    token = create_access_token(data={"sub": mock_owner_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_property():
    class MockProperty:
        id = "507f1f77bcf86cd799439021"
        row_letter = "A"
        number = 1
        villa = "Villa 1"
        owner_name = "Property Owner"
        owner_phone = "555-9101"

    return MockProperty()


@pytest.fixture
def mock_fee_schedule():
    class MockFeeSchedule:
        id = "507f1f77bcf86cd799439031"
        amount = 150.00
        description = "Cuota mensual"
        due_day = 15

    return MockFeeSchedule()


@pytest.fixture
def mock_fee(mock_property, mock_fee_schedule):
    class MockFee:
        id = "507f1f77bcf86cd799439041"
        property = mock_property
        fee_schedule = mock_fee_schedule
        user = None
        amount = 150.00
        paid_amount = 0.0
        generated_date = datetime.utcnow()
        year = 2025
        month = 5
        due_date = datetime.utcnow() + timedelta(days=30)
        status = "pending"
        reference = None
        notes = None
        fee_schedule_id = mock_fee_schedule.id
        property_id = mock_property.id

        async def fetch_link(self, rel):
            pass

    return MockFee()


@pytest.fixture
def mock_payment(mock_user, mock_fee):
    class MockPayment:
        id = "507f1f77bcf86cd799439051"
        fee = mock_fee
        fee_id = mock_fee.id
        user = mock_user
        amount = 150.00
        payment_date = datetime.utcnow()
        status = "pending"
        notes = None

        async def fetch_link(self, rel):
            pass

        async def save(self):
            pass

    return MockPayment()


@pytest.fixture
def mock_receipt(mock_payment):
    class MockReceipt:
        id = "507f1f77bcf86cd799439061"
        correlative_number = "CUOT-2025-00001"
        payment = mock_payment
        issue_date = datetime.utcnow()
        total_amount = 150.00
        property_details = {"villa": "Villa 1", "row_letter": "A", "number": 1}
        owner_details = {"name": "Test Owner"}
        fee_period = "5/2025"
        notes = None
        treasurer_details = {"name": "Tesorero Test"}
        generated_receipt_file = None
        miscellaneous_payment = None
        expense = None

    return MockReceipt()
