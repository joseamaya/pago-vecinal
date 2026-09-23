from datetime import datetime
import os
import logging
from ..models.receipt import Receipt
from ..models.payment import Payment
from ..models.treasurer import Treasurer
from ..config.database import database
from ..utils.pdf_generator import generate_receipt_pdf

logger = logging.getLogger(__name__)

async def generate_automatic_receipt(payment: Payment) -> str:
    """
    Generate a receipt automatically when payment is approved
    Returns the Cloudinary URL of the generated PDF
    """
    logger.info("Starting receipt generation for payment %s", payment.id)

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    logger.debug("Payment fee: %s", payment.fee)
    logger.debug("Payment user: %s", payment.user)

    # Fetch property and fee_schedule from fee
    if payment.fee:
        await payment.fee.fetch_link('property')
        await payment.fee.fetch_link('fee_schedule')
        logger.debug("Fee property: %s", payment.fee.property)
        logger.debug("Fee property type: %s", type(payment.fee.property))
        logger.debug("Fee schedule: %s", payment.fee.fee_schedule)
        if hasattr(payment.fee.property, 'id'):
            logger.debug("Property ID: %s", payment.fee.property.id)
    else:
        raise Exception("Payment has no associated fee")

    # Use centralized receipt creation function
    from ..services.receipt_service import create_receipt_for_payment
    receipt = await create_receipt_for_payment(payment)
    return receipt.generated_receipt_file if receipt else None