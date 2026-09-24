import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from .settings import settings

from ..models.expense import Expense
from ..models.miscellaneous_payment import MiscellaneousPayment
from ..models.treasurer import Treasurer
from ..models.user import User
from ..models.property import Property
from ..models.fee import FeeSchedule, Fee
from ..models.payment import Payment
from ..models.receipt import Receipt
from ..models.agreement import Agreement, AgreementInstallment
from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)

MONGODB_URL = settings.MONGODB_URL
DATABASE_NAME = settings.DATABASE_NAME

logger.info("Connecting to MongoDB at %s", MONGODB_URL.split("@")[-1] if "@" in MONGODB_URL else MONGODB_URL)

client = AsyncIOMotorClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    socketTimeoutMS=45000,
    maxPoolSize=10,
    retryWrites=True,
    retryReads=True
)
database = client[DATABASE_NAME]

async def test_connection():
    try:
        await client.admin.command('ping')
        logger.info("MongoDB connection successful")
        return True
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e)
        return False

async def init_db():
    logger.info("Initializing database connection...")

    if not await test_connection():
        raise Exception("Failed to connect to MongoDB")

    try:
        await init_beanie(
            database=database,
            document_models=[User, Property, FeeSchedule, Fee, Payment, Receipt, Agreement, AgreementInstallment, MiscellaneousPayment, Expense, Treasurer, AuditLog]
        )
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Database initialization failed: %s", e)
        raise