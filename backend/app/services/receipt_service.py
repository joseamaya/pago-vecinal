import logging
from datetime import datetime
from typing import Optional
from ..models.receipt import Receipt
from ..models.payment import Payment
from ..models.fee import Fee
from ..models.treasurer import Treasurer
from ..utils.pdf_generator import generate_receipt_pdf
from .cloudinary_service import upload_receipt_pdf

logger = logging.getLogger(__name__)


async def generate_correlative_number(year, prefix="REC"):
    last_receipt = await Receipt.find(
        {"correlative_number": {"$regex": f"^{prefix}-{year}"}}
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

    return f"{prefix}-{year}-{new_number:05d}"


async def create_receipt_for_payment(payment, fee_period=None, notes=None):
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    correlative_number = await generate_correlative_number(payment.payment_date.year, "CUOT")

    if payment.fee and payment.fee.property:
        await payment.fee.fetch_link('property')
        property_details = {
            "villa": payment.fee.property.villa,
            "row_letter": payment.fee.property.row_letter,
            "number": payment.fee.property.number,
            "owner_name": payment.fee.property.owner_name,
            "owner_phone": payment.fee.property.owner_phone
        }
        owner_details = {
            "name": payment.fee.property.owner_name,
            "phone": payment.fee.property.owner_phone
        }
    else:
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

    villa = property_details.get('villa')
    treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa and villa != "N/A" else None
    treasurer_details = {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None,
        "villa": treasurer.villa if treasurer else None
    }

    receipt = Receipt(
        correlative_number=correlative_number,
        payment=payment,
        issue_date=datetime.utcnow(),
        total_amount=payment.amount,
        property_details=property_details,
        owner_details=owner_details,
        fee_period=fee_period or f"{payment.fee.month}/{payment.fee.year}" if payment.fee else None,
        notes=notes or payment.notes,
        treasurer_details=treasurer_details
    )

    await receipt.insert()

    pdf_data = {
        "correlative_number": receipt.correlative_number,
        "issue_date": receipt.issue_date,
        "payment_date": receipt.payment.payment_date,
        "total_amount": receipt.total_amount,
        "property_details": receipt.property_details,
        "reference": receipt.payment.fee_id,
        "fee_period": receipt.fee_period,
        "notes": receipt.notes,
        "treasurer_details": treasurer_details
    }

    pdf_buffer = generate_receipt_pdf(pdf_data)
    cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)

    receipt.generated_receipt_file = cloudinary_url
    await receipt.save()

    logger.info("Receipt created for payment %s: %s", payment.id, correlative_number)
    return receipt
