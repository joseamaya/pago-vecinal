import logging
from ..models.payment import Payment, PaymentStatus
from ..models.fee import Fee, FeeStatus
from .receipt_service import create_receipt_for_payment

logger = logging.getLogger(__name__)


async def update_fee_status_based_on_payments(fee):
    approved_payments = await Payment.find(
        Payment.fee_id == str(fee.id),
        Payment.status == PaymentStatus.APPROVED
    ).to_list()

    total_paid = sum(payment.amount for payment in approved_payments)

    fee.paid_amount = total_paid
    if total_paid >= fee.amount:
        fee.status = FeeStatus.COMPLETED
    elif total_paid > 0:
        fee.status = FeeStatus.PARTIALLY_PAID
    else:
        fee.status = FeeStatus.PENDING

    await fee.save()


async def create_receipt_on_approval(payment):
    try:
        logger.info("Creating receipt for payment %s", payment.id)
        await create_receipt_for_payment(payment)
        logger.info("Receipt created successfully for payment %s", payment.id)
    except Exception as e:
        logger.exception("Error creating receipt for payment %s", payment.id)


async def approve_payment(payment):
    payment.status = PaymentStatus.APPROVED
    await payment.save()
    await create_receipt_on_approval(payment)
    if payment.fee:
        await payment.fetch_link(Payment.fee)
        await update_fee_status_based_on_payments(payment.fee)


async def bulk_approve_payments(payment_ids):
    approved_count = 0
    errors = []

    for payment_id in payment_ids:
        try:
            payment = await Payment.get(payment_id)
            if payment and payment.status != PaymentStatus.APPROVED:
                await payment.fetch_link(Payment.fee)
                await payment.fetch_link(Payment.user)
                await approve_payment(payment)
                approved_count += 1
            elif payment and payment.status == PaymentStatus.APPROVED:
                approved_count += 1
        except Exception as e:
            logger.exception("Error approving payment %s", payment_id)
            errors.append({"payment_id": payment_id, "error": str(e)})

    return {"approved_count": approved_count, "errors": errors}
