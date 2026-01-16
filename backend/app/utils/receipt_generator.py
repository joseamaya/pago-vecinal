from datetime import datetime
import os
import cloudinary
import cloudinary.uploader
from ..models.receipt import Receipt
from ..models.payment import Payment
from ..models.treasurer import Treasurer
from ..config.database import database
from ..utils.pdf_generator import generate_receipt_pdf

async def generate_automatic_receipt(payment: Payment) -> str:
    """
    Generate a receipt automatically when payment is approved
    Returns the Cloudinary URL of the generated PDF
    """
    print(f"Starting receipt generation for payment {payment.id}")

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    print(f"Payment fee: {payment.fee}")
    print(f"Payment user: {payment.user}")

    # Fetch property and fee_schedule from fee
    if payment.fee:
        await payment.fee.fetch_link('property')
        await payment.fee.fetch_link('fee_schedule')
        print(f"Fee property: {payment.fee.property}")
        print(f"Fee property type: {type(payment.fee.property)}")
        print(f"Fee schedule: {payment.fee.fee_schedule}")
        if hasattr(payment.fee.property, 'id'):
            print(f"Property ID: {payment.fee.property.id}")
    else:
        raise Exception("Payment has no associated fee")

    # Use centralized receipt creation function
    from ..routes.receipts import create_receipt_for_payment
    receipt = await create_receipt_for_payment(payment)
    return receipt.generated_receipt_file if receipt else None