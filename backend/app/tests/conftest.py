import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from app.config.settings import Settings
from app.auth.utils import create_access_token


# ---------------------------------------------------------------------------
# Existing sync mock fixtures (kept for backward compatibility)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Mongomock-based fixtures for real Beanie document tests
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def mongomock_db():
    from mongomock_motor import AsyncMongoMockClient
    from beanie import init_beanie

    from app.models.user import User
    from app.models.property import Property
    from app.models.fee import FeeSchedule, Fee
    from app.models.payment import Payment
    from app.models.receipt import Receipt
    from app.models.expense import Expense
    from app.models.miscellaneous_payment import MiscellaneousPayment
    from app.models.treasurer import Treasurer
    from app.models.agreement import Agreement, AgreementInstallment

    import app.config.database as db_module

    client = AsyncMongoMockClient()
    db = client.test_pago_vecinal

    original_client = db_module.client
    original_database = db_module.database
    db_module.client = client
    db_module.database = db

    route_modules = [
        "app.routes.payments",
        "app.routes.fees",
        "app.routes.properties",
        "app.routes.users",
        "app.routes.auth",
        "app.routes.receipts",
        "app.routes.fee_schedules",
        "app.routes.reports",
        "app.routes.miscellaneous_payments",
        "app.routes.expenses",
        "app.routes.dashboard",
        "app.routes.treasurers",
        "app.routes.agreements",
    ]
    for mod_name in route_modules:
        if mod_name in sys.modules:
            mod = sys.modules[mod_name]
            if hasattr(mod, "database"):
                mod.database = db

    await init_beanie(
        database=db,
        document_models=[
            User,
            Property,
            FeeSchedule,
            Fee,
            Payment,
            Receipt,
            Expense,
            MiscellaneousPayment,
            Treasurer,
            Agreement,
            AgreementInstallment,
        ],
    )

    yield db

    db_module.client = original_client
    db_module.database = original_database
    for mod_name in route_modules:
        if mod_name in sys.modules:
            mod = sys.modules[mod_name]
            if hasattr(mod, "database"):
                mod.database = original_database

    await client.drop_database("test_pago_vecinal")
    client.close()


@pytest.fixture
async def test_user(mongomock_db):
    import bcrypt
    from app.models.user import User, UserRole

    hashed = bcrypt.hashpw(b"test-password", bcrypt.gensalt()).decode("utf-8")
    user = User(
        email="test@example.com",
        password_hash=hashed,
        role=UserRole.ADMIN,
        full_name="Test User",
        phone="555-1234",
        is_active=True,
    )
    await user.insert()
    return user


@pytest.fixture
async def test_owner_user(mongomock_db):
    from app.models.user import User, UserRole

    user = User(
        email="owner@example.com",
        password_hash="$2b$12$dummy_hash_for_testing_only",
        role=UserRole.OWNER,
        full_name="Owner User",
        phone="555-5678",
        is_active=True,
    )
    await user.insert()
    return user


@pytest.fixture
async def auth_headers_admin(test_user):
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def auth_headers_owner(test_owner_user):
    token = create_access_token(data={"sub": test_owner_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_property(mongomock_db):
    from app.models.property import Property

    prop = Property(
        row_letter="A",
        number=1,
        villa="Villa 1",
        owner_name="Property Owner",
        owner_phone="555-9101",
    )
    await prop.insert()
    return prop


@pytest.fixture
async def test_fee_schedule(mongomock_db):
    from app.models.fee import FeeSchedule

    fs = FeeSchedule(
        amount=150.00,
        description="Cuota mensual",
        effective_date=datetime.utcnow(),
        due_day=15,
    )
    await fs.insert()
    return fs


@pytest.fixture
async def test_fee(mongomock_db, test_property, test_fee_schedule):
    from app.models.fee import Fee

    fee = Fee(
        property=test_property,
        fee_schedule=test_fee_schedule,
        amount=150.00,
        paid_amount=0.0,
        generated_date=datetime.utcnow(),
        year=2025,
        month=5,
        due_date=datetime.utcnow() + timedelta(days=30),
        status="pending",
    )
    await fee.insert()
    return fee


@pytest.fixture
async def test_payment(mongomock_db, test_user, test_fee):
    from app.models.payment import Payment

    payment = Payment(
        fee=test_fee,
        fee_id=str(test_fee.id),
        user=test_user,
        amount=150.00,
        payment_date=datetime.utcnow(),
        status="pending",
    )
    await payment.insert()
    return payment


@pytest.fixture
async def test_receipt(mongomock_db, test_payment):
    from app.models.receipt import Receipt

    receipt = Receipt(
        correlative_number="CUOT-2025-00001",
        payment=test_payment,
        issue_date=datetime.utcnow(),
        total_amount=150.00,
        property_details={"villa": "Villa 1", "row_letter": "A", "number": 1},
        owner_details={"name": "Test Owner"},
        fee_period="5/2025",
        treasurer_details={"name": "Tesorero Test"},
    )
    await receipt.insert()
    return receipt


@pytest.fixture
async def test_approved_payment(mongomock_db, test_user, test_fee):
    from app.models.payment import Payment, PaymentStatus

    payment = Payment(
        fee=test_fee,
        fee_id=str(test_fee.id),
        user=test_user,
        amount=150.00,
        payment_date=datetime.utcnow(),
        status=PaymentStatus.APPROVED,
    )
    await payment.insert()
    return payment


@pytest.fixture
async def test_other_owner_user(mongomock_db):
    from app.models.user import User, UserRole

    user = User(
        email="other-owner@example.com",
        password_hash="$2b$12$dummy_hash_for_testing_only",
        role=UserRole.OWNER,
        full_name="Other Owner",
        phone="555-0000",
        is_active=True,
    )
    await user.insert()
    return user


@pytest.fixture
async def auth_headers_other_owner(test_other_owner_user):
    token = create_access_token(data={"sub": test_other_owner_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_misc_payment(mongomock_db, test_owner_user):
    from app.models.miscellaneous_payment import (
        MiscellaneousPayment,
        MiscellaneousPaymentStatus,
        MiscellaneousPaymentType,
    )

    payment = MiscellaneousPayment(
        user=test_owner_user,
        payment_type=MiscellaneousPaymentType.OTHER,
        amount=50.0,
        payment_date=datetime.utcnow(),
        description="Pago jardineria",
        status=MiscellaneousPaymentStatus.APPROVED,
    )
    await payment.insert()
    return payment


@pytest.fixture
async def test_misc_receipt(mongomock_db, test_misc_payment):
    from app.models.receipt import Receipt

    receipt = Receipt(
        correlative_number="OTR-2025-00001",
        miscellaneous_payment=test_misc_payment,
        issue_date=datetime.utcnow(),
        total_amount=50.0,
        property_details={
            "villa": "N/A",
            "row_letter": "N/A",
            "number": 0,
            "owner_name": "Owner User",
            "owner_phone": "555-5678",
        },
        owner_details={"name": "Owner User", "phone": "555-5678"},
        fee_period="Pago varios: Pago jardineria",
        notes="Recibo generado automaticamente",
        treasurer_details={
            "name": "Tesorero no configurado",
            "signature": None,
            "villa": None,
        },
    )
    await receipt.insert()
    return receipt


@pytest.fixture
async def test_expense(mongomock_db):
    from app.models.expense import Expense

    expense = Expense(
        expense_date=datetime.utcnow(),
        description="Compra de insumos",
        amount=30.0,
    )
    await expense.insert()
    return expense


@pytest.fixture
async def test_expense_receipt(mongomock_db, test_expense):
    from app.models.receipt import Receipt

    receipt = Receipt(
        correlative_number="GASTO-2025-00001",
        expense=test_expense,
        issue_date=datetime.utcnow(),
        total_amount=30.0,
    )
    await receipt.insert()
    return receipt
