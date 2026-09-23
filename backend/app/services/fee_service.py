import logging
from datetime import datetime
from ..models.fee import Fee, FeeStatus, FeeSchedule
from ..models.property import Property
from ..models.payment import Payment, PaymentStatus

logger = logging.getLogger(__name__)


async def recalculate_fee_status(fee):
    if fee.status == FeeStatus.AGREEMENT:
        # Fees under an agreement are reconciled by the agreement logic;
        # recomputing from direct payments would wipe that state.
        return

    approved_payments = await Payment.find(
        Payment.fee_id == str(fee.id),
        Payment.status == PaymentStatus.APPROVED
    ).to_list()

    total_paid = sum(p.amount for p in approved_payments)

    if total_paid >= fee.amount:
        fee.status = FeeStatus.COMPLETED
    elif total_paid > 0:
        fee.status = FeeStatus.PARTIALLY_PAID
    else:
        fee.status = FeeStatus.PENDING

    fee.paid_amount = total_paid
    await fee.save()
