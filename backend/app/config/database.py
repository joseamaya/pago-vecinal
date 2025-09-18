import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pago_vecinal")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]

async def init_db():
    # Import all models here to register them with Beanie
    from ..models.user import User
    from ..models.property import Property
    from ..models.fee import FeeSchedule, Fee
    from ..models.payment import Payment
    from ..models.receipt import Receipt

    await init_beanie(
        database=database,
        document_models=[User, Property, FeeSchedule, Fee, Payment, Receipt]
    )