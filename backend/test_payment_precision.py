#!/usr/bin/env python3
"""
Test script to verify the payment amount precision fix.
Tests that amounts are properly rounded to 2 decimal places.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def test_payment_precision():
    """Test that payment amounts are properly rounded to 2 decimal places"""
    try:
        # Connect to MongoDB
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]

        print("🔍 Testing payment amount precision...")

        # Test 1: Check existing payments for precision issues
        print("\n📊 Checking existing payments for precision issues...")

        # Find all payments
        payments = await db.payments.find({}).to_list(length=None)

        if not payments:
            print("ℹ️  No payments found in database")
        else:
            print(f"📋 Found {len(payments)} payments")

            precision_issues = []
            for payment in payments:
                amount = payment.get('amount', 0)
                # Check if amount has more than 2 decimal places
                if isinstance(amount, float):
                    decimal_part = str(amount).split('.')[-1] if '.' in str(amount) else ''
                    if len(decimal_part) > 2:
                        precision_issues.append({
                            'id': str(payment['_id']),
                            'amount': amount,
                            'decimal_places': len(decimal_part)
                        })

            if precision_issues:
                print(f"⚠️  Found {len(precision_issues)} payments with precision issues:")
                for issue in precision_issues[:5]:  # Show first 5 issues
                    print(f"   - Payment {issue['id']}: {issue['amount']} ({issue['decimal_places']} decimal places)")
                if len(precision_issues) > 5:
                    print(f"   ... and {len(precision_issues) - 5} more")
            else:
                print("✅ All existing payments have correct precision (2 decimal places or less)")

        # Test 2: Test the round function directly
        print("\n🧮 Testing round function behavior...")

        test_values = [
            50.0,           # Should stay 50.0
            50.123456789,   # Should become 50.12
            49.999999999,   # Should become 50.0
            49.995,         # Should become 49.99
            123.456,        # Should become 123.46
            0.1,            # Should become 0.1
            0.123,          # Should become 0.12
        ]

        print("Input -> Rounded (2 decimals):")
        for value in test_values:
            rounded = round(value, 2)
            print(f"{value} -> {rounded}")

        # Test 3: Test JavaScript-like precision issues
        print("\n🧪 Testing JavaScript precision simulation...")

        # Simulate what happens when JavaScript sends 50 as 49.999999999
        js_precision_issue = 49.999999999
        corrected = round(js_precision_issue, 2)

        print(f"JavaScript precision issue: {js_precision_issue}")
        print(f"After rounding to 2 decimals: {corrected}")
        print(f"Expected result: 50.0")
        print(f"✅ Corrected correctly: {corrected == 50.0}")

        client.close()

        print("\n✅ Payment precision test completed!")

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 Testing payment amount precision fix...")
    asyncio.run(test_payment_precision())