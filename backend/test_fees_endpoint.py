#!/usr/bin/env python3
"""
Test script to verify the fees property_id filter functionality.
Tests the database query directly to ensure the filter works correctly.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def test_property_filter():
    """Test the property_id filter directly on the database"""
    try:
        # Connect to MongoDB
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        print("🔍 Testing property_id filter on fees collection...")

        # Get a sample property
        property_doc = await db.properties.find_one({})
        if not property_doc:
            print("❌ ERROR: No properties found in database")
            return

        property_id = str(property_doc['_id'])
        print(f"📋 Using property ID: {property_id}")
        print(f"   Property: {property_doc.get('villa', 'N/A')} {property_doc.get('row_letter', 'N/A')}{property_doc.get('number', 'N/A')}")

        # Test 1: Count all fees
        total_fees = await db.fees.count_documents({})
        print(f"\n📊 Total fees in database: {total_fees}")

        # Test 2: Count pending fees
        pending_fees = await db.fees.count_documents({"status": "pending"})
        print(f"📊 Pending fees in database: {pending_fees}")

        # Test 3: Count fees for this specific property
        property_fees = await db.fees.count_documents({"property.$id": ObjectId(property_id)})
        print(f"📊 Fees for property {property_id}: {property_fees}")

        # Test 4: Count pending fees for this specific property
        property_pending_fees = await db.fees.count_documents({
            "property.$id": ObjectId(property_id),
            "status": "pending"
        })
        print(f"📊 Pending fees for property {property_id}: {property_pending_fees}")

        # Test 5: Get sample fees for this property
        sample_fees = await db.fees.find({"property.$id": ObjectId(property_id)}).limit(3).to_list(length=3)
        if sample_fees:
            print("\n📋 Sample fees for this property:")
            for fee in sample_fees:
                print(f"   - Fee ID: {fee['_id']}")
                print(f"     Period: {fee.get('month', 'N/A')}/{fee.get('year', 'N/A')}")
                print(f"     Amount: {fee.get('amount', 'N/A')}")
                print(f"     Status: {fee.get('status', 'N/A')}")
                print(f"     Property ID in fee: {fee.get('property', {}).get('$id', 'N/A')}")
        else:
            print(f"\n⚠️  No fees found for property {property_id}")

        # Test 6: Verify the filter works correctly
        print("\n🔍 Verifying filter accuracy...")
        # Get all fees and check property IDs
        all_fees_cursor = db.fees.find({"property.$id": ObjectId(property_id)})
        all_property_fees = await all_fees_cursor.to_list(length=None)

        correct_filtering = True
        for fee in all_property_fees:
            fee_property_id = str(fee.get('property', {}).get('$id', ''))
            if fee_property_id != property_id:
                print(f"❌ ERROR: Fee {fee['_id']} has property_id {fee_property_id}, expected {property_id}")
                correct_filtering = False

        if correct_filtering and all_property_fees:
            print(f"✅ SUCCESS: All {len(all_property_fees)} fees correctly belong to property {property_id}")
        elif not all_property_fees:
            print(f"ℹ️  No fees found for property {property_id} (this is normal if no fees exist)")
        else:
            print("❌ ERROR: Some fees don't belong to the correct property")

        client.close()

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

async def test_beanie_query():
    """Test the Beanie query that should work like the endpoint"""
    try:
        from app.models.fee import Fee
        from app.models.user import User, UserRole
        from beanie import init_beanie
        from motor.motor_asyncio import AsyncIOMotorClient
        import os

        # Connect to MongoDB
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        # Initialize Beanie
        await init_beanie(database=db, document_models=[Fee])

        print("\n🔍 Testing Beanie query for property_id filter...")

        # Get a sample property
        property_doc = await db.properties.find_one({})
        if not property_doc:
            print("❌ ERROR: No properties found in database")
            return

        property_id = str(property_doc['_id'])
        print(f"📋 Testing with property ID: {property_id}")

        # Test the Beanie query that should work like the endpoint
        query = Fee.find(Fee.property.id == property_id)
        fees_count = await query.count()
        print(f"📊 Beanie query found {fees_count} fees for property {property_id}")

        # Get a few sample fees
        fees = await query.limit(3).to_list()
        if fees:
            print("📋 Sample fees from Beanie query:")
            for fee in fees:
                print(f"   - Fee ID: {fee.id}")
                print(f"     Period: {fee.month}/{fee.year}")
                print(f"     Status: {fee.status}")
        else:
            print("ℹ️  No fees found with Beanie query")

        client.close()

    except Exception as e:
        print(f"❌ ERROR in Beanie test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 Testing fees property_id filter functionality...")
    asyncio.run(test_property_filter())
    asyncio.run(test_beanie_query())

async def get_test_data():
    """Helper to get actual IDs from database for testing"""
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        import os

        load_dotenv()

        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        # Get a property ID
        property_doc = await db.properties.find_one({})
        if property_doc:
            print(f"📋 Test Property ID: {property_doc['_id']}")
            print(f"   Villa: {property_doc.get('villa', 'N/A')}")
            print(f"   Location: {property_doc.get('row_letter', 'N/A')}{property_doc.get('number', 'N/A')}")

        # Get fee count
        fee_count = await db.fees.count_documents({})
        print(f"📊 Total fees in database: {fee_count}")

        # Get pending fee count
        pending_count = await db.fees.count_documents({"status": "pending"})
        print(f"📊 Pending fees in database: {pending_count}")

        client.close()

    except Exception as e:
        print(f"❌ ERROR getting test data: {str(e)}")

if __name__ == "__main__":
    print("🔍 Testing fees property_id filter functionality...")
    asyncio.run(test_property_filter())
    asyncio.run(test_beanie_query())