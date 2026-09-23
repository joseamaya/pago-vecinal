import logging
from datetime import datetime

from ..models.receipt import Receipt
from ..models.treasurer import Treasurer
from ..schemas.miscellaneous_payment import MiscellaneousPaymentResponse
from ..utils.pdf_generator import generate_receipt_pdf
from .receipt_service import generate_correlative_number
from .cloudinary_service import upload_receipt_pdf

logger = logging.getLogger(__name__)

DEFAULT_PROPERTY_DETAILS = {
    "villa": "N/A",
    "row_letter": "N/A",
    "number": 0,
    "owner_name": "Propietario no registrado",
    "owner_phone": "N/A",
}

DEFAULT_OWNER_DETAILS = {
    "name": "Propietario no registrado",
    "phone": "N/A",
}


def build_miscellaneous_payment_response(payment) -> MiscellaneousPaymentResponse:
    return MiscellaneousPaymentResponse(
        id=str(payment.id),
        property_id=str(payment.property.id) if payment.property else None,
        property_villa=getattr(payment.property, 'villa', None) if payment.property else None,
        property_row_letter=getattr(payment.property, 'row_letter', None) if payment.property else None,
        property_number=getattr(payment.property, 'number', None) if payment.property else None,
        property_owner_name=getattr(payment.property, 'owner_name', None) if payment.property else None,
        user_id=str(payment.user.id),
        payment_type=payment.payment_type,
        amount=payment.amount,
        payment_date=payment.payment_date,
        receipt_file=payment.receipt_file,
        generated_receipt_file=payment.generated_receipt_file,
        status=payment.status,
        description=payment.description,
        notes=payment.notes,
        created_at=payment.id.generation_time if hasattr(payment.id, 'generation_time') else datetime.utcnow(),
    )


async def resolve_treasurer_details(property_details):
    villa = property_details.get('villa') if property_details and property_details.get('villa') != 'N/A' else None
    treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
    return {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None,
        "villa": treasurer.villa if treasurer else None,
    }


async def create_receipt_for_miscellaneous_payment(payment, note, upload=True):
    correlative_number = await generate_correlative_number(datetime.utcnow().year, "OTR")

    property_details = payment.property_details or DEFAULT_PROPERTY_DETAILS
    owner_details = payment.owner_details or DEFAULT_OWNER_DETAILS
    treasurer_details = await resolve_treasurer_details(property_details)

    receipt = Receipt(
        correlative_number=correlative_number,
        miscellaneous_payment=payment,
        issue_date=datetime.utcnow(),
        total_amount=payment.amount,
        property_details=property_details,
        owner_details=owner_details,
        fee_period=f"Pago varios: {payment.description}",
        notes=note,
        treasurer_details=treasurer_details,
    )
    await receipt.insert()

    cloudinary_url = None
    if upload:
        pdf_data = {
            "correlative_number": receipt.correlative_number,
            "issue_date": receipt.issue_date,
            "payment_date": payment.payment_date,
            "total_amount": receipt.total_amount,
            "property_details": receipt.property_details,
            "reference": payment.id,
            "fee_period": receipt.fee_period,
            "notes": receipt.notes,
            "treasurer_details": treasurer_details,
        }
        pdf_buffer = generate_receipt_pdf(pdf_data)
        cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)
        if cloudinary_url:
            receipt.generated_receipt_file = cloudinary_url
        await receipt.save()

    return receipt, cloudinary_url
