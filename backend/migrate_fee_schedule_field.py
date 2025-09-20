#!/usr/bin/env python3
"""
Migration script to rename 'generation_day' field to 'due_day' in fee_schedules collection.
This script should be run once after deploying the field rename changes.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def migrate_fee_schedule_field():
    """Migrate generation_day to due_day in fee_schedules collection"""
    try:
        # Connect to MongoDB
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        print("🔄 Starting migration: renaming 'generation_day' to 'due_day' in fee_schedules...")

        # Update all documents in fee_schedules collection
        result = await db.fee_schedules.update_many(
            {"generation_day": {"$exists": True}},
            {"$rename": {"generation_day": "due_day"}}
        )

        print(f"✅ Migration completed: {result.modified_count} documents updated")

        # Verify the migration
        count_with_old_field = await db.fee_schedules.count_documents({"generation_day": {"$exists": True}})
        count_with_new_field = await db.fee_schedules.count_documents({"due_day": {"$exists": True}})

        print(f"📊 Verification:")
        print(f"   - Documents with old field (generation_day): {count_with_old_field}")
        print(f"   - Documents with new field (due_day): {count_with_new_field}")

        if count_with_old_field == 0 and count_with_new_field > 0:
            print("✅ Migration successful!")
        else:
            print("⚠️  Migration may not be complete. Please check manually.")

        client.close()

    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(migrate_fee_schedule_field())