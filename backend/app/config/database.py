import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

from ..models.expense import Expense
from ..models.miscellaneous_payment import MiscellaneousPayment
from ..models.user import User
from ..models.property import Property
from ..models.fee import FeeSchedule, Fee
from ..models.payment import Payment
from ..models.receipt import Receipt
from ..models.agreement import Agreement, AgreementInstallment

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pago_vecinal")

print(f"🔌 Connecting to MongoDB: {MONGODB_URL.replace('mongodb+srv://', 'mongodb+srv://[HIDDEN]@')}")

# Connection settings for better reliability
client = AsyncIOMotorClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,  # 5 seconds timeout
    connectTimeoutMS=10000,         # 10 seconds connect timeout
    socketTimeoutMS=45000,          # 45 seconds socket timeout
    maxPoolSize=10,                 # Connection pool size
    retryWrites=True,
    retryReads=True
)
database = client[DATABASE_NAME]

async def test_connection():
    """Test MongoDB connection before initializing Beanie"""
    try:
        # Ping the database to test connection
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

async def init_db():
    """Initialize database connection and Beanie ODM"""
    print("🔄 Initializing database connection...")

    # Test connection first
    if not await test_connection():
        raise Exception("Failed to connect to MongoDB")

    try:
        await init_beanie(
            database=database,
            document_models=[User, Property, FeeSchedule, Fee, Payment, Receipt, Agreement, AgreementInstallment, MiscellaneousPayment, Expense]
        )
        print("✅ Database initialized successfully!")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise