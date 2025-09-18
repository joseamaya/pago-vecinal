from datetime import datetime
import os
from ..models.receipt import Receipt
from ..models.payment import Payment
from ..config.database import database

async def generate_automatic_receipt(payment: Payment) -> str:
    """
    Generate a receipt automatically when payment is approved
    Returns the file path of the generated PDF
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

    # Generate correlative number
    current_year = datetime.utcnow().year
    last_receipt = await Receipt.find(
        {"correlative_number": {"$regex": f"^REC-{current_year}"}}
    ).sort([("correlative_number", -1)]).first_or_none()

    if last_receipt:
        parts = last_receipt.correlative_number.split("-")
        if len(parts) == 3:
            last_number = int(parts[2])
            new_number = last_number + 1
        else:
            new_number = 1
    else:
        new_number = 1

    correlative_number = f"REC-{current_year}-{new_number:05d}"

    # Create property and owner details snapshot
    if not payment.fee.property:
        # If no property linked, create default details
        print("Warning: Fee has no associated property, using default details")
        property_details = {
            "villa": "N/A",
            "row_letter": "N/A",
            "number": 0,
            "owner_name": "Propietario no registrado",
            "owner_phone": "N/A"
        }
        owner_details = {
            "name": "Propietario no registrado",
            "phone": "N/A"
        }
    else:
        print(f"Creating property details for property: {payment.fee.property}")
        property_details = {
            "villa": getattr(payment.fee.property, 'villa', 'N/A'),
            "row_letter": getattr(payment.fee.property, 'row_letter', 'N/A'),
            "number": getattr(payment.fee.property, 'number', 0),
            "owner_name": getattr(payment.fee.property, 'owner_name', 'Propietario no registrado'),
            "owner_phone": getattr(payment.fee.property, 'owner_phone', 'N/A') or "N/A"
        }

        owner_details = {
            "name": getattr(payment.fee.property, 'owner_name', 'Propietario no registrado'),
            "phone": getattr(payment.fee.property, 'owner_phone', 'N/A') or "N/A"
        }

    print(f"Property details: {property_details}")

    # Create receipt record
    receipt = Receipt(
        correlative_number=correlative_number,
        payment=payment,
        issue_date=datetime.utcnow(),
        total_amount=payment.amount,
        property_details=property_details,
        owner_details=owner_details,
        fee_period=f"Cuota {payment.fee.reference or 'N/A'}",
        notes=f"Recibo generado automáticamente al aprobar el pago"
    )

    await receipt.insert()

    print(f"Receipt created in database with ID: {receipt.id}")
    # Skip PDF generation for now
    return None