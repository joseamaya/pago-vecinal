#!/usr/bin/env python3
"""
Test script to verify the initial admin creation functionality.
Run this after starting the application to see if the admin was created.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def test_admin_creation():
    """Test if the initial admin was created successfully"""
    try:
        # Connect to MongoDB
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        # Check if admin exists
        admin_collection = db.users
        admin = await admin_collection.find_one({"role": "admin"})

        if admin:
            print("✅ SUCCESS: Initial admin user found!")
            print(f"   ID: {admin['_id']}")
            print(f"   Email: {admin['email']}")
            print(f"   Name: {admin['full_name']}")
            print(f"   Role: {admin['role']}")
            print(f"   Active: {admin['is_active']}")
        else:
            print("❌ ERROR: No admin user found in database")
            print("   Check your environment variables and application logs")

        # Show total users count
        users_count = await admin_collection.count_documents({})
        print(f"\n📊 Total users in database: {users_count}")

        client.close()

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

if __name__ == "__main__":
    print("🔍 Testing initial admin creation...")
    asyncio.run(test_admin_creation())