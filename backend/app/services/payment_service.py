import logging
from datetime import datetime
from bson import DBRef

from ..models.payment import Payment, PaymentStatus
from ..models.fee import Fee, FeeStatus
from ..models.property import Property
from .receipt_service import create_receipt_for_payment

logger = logging.getLogger(__name__)


async def update_fee_status_based_on_payments(fee):
    if fee.status == FeeStatus.AGREEMENT:
        # Fees under an agreement are reconciled by the agreement logic;
        # recomputing from direct payments would wipe that state.
        return

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


async def bulk_import_payment_rows(ws, current_user):
    results = {
        "successful_imports": 0,
        "failed_imports": 0,
        "errors": [],
    }

    for row_idx in range(2, ws.max_row + 1):
        try:
            villa = str(ws.cell(row=row_idx, column=1).value or "").strip()
            fila = str(ws.cell(row=row_idx, column=2).value or "").strip()
            numero = ws.cell(row=row_idx, column=3).value
            year = ws.cell(row=row_idx, column=4).value
            month = ws.cell(row=row_idx, column=5).value
            amount = ws.cell(row=row_idx, column=6).value
            payment_date_cell = ws.cell(row=row_idx, column=7).value
            notes = str(ws.cell(row=row_idx, column=8).value or "").strip()

            if not all([villa, fila, numero is not None, year is not None, month is not None, amount is not None, payment_date_cell is not None]):
                results["errors"].append({"row": row_idx, "error": "Missing required fields"})
                results["failed_imports"] += 1
                continue

            try:
                numero = int(numero)
                year = int(year)
                month = int(month)
                amount = float(amount)
                logger.debug("Payment date cell: %s", payment_date_cell)

                if isinstance(payment_date_cell, datetime):
                    payment_date = payment_date_cell
                else:
                    payment_date = datetime.strptime(str(payment_date_cell), '%Y-%m-%d')

                logger.debug("Parsed payment_date: %s", payment_date)

            except (ValueError, TypeError) as e:
                logger.debug("Invalid data types on row %s: %s", row_idx, e)
                results["errors"].append({"row": row_idx, "error": "Invalid data types in row"})
                results["failed_imports"] += 1
                continue

            if month < 1 or month > 12:
                results["errors"].append({"row": row_idx, "error": "Month must be between 1 and 12"})
                results["failed_imports"] += 1
                continue

            if amount <= 0:
                results["errors"].append({"row": row_idx, "error": "Amount must be greater than 0"})
                results["failed_imports"] += 1
                continue

            if payment_date > datetime.utcnow():
                results["errors"].append({"row": row_idx, "error": "Payment date cannot be in the future"})
                results["failed_imports"] += 1
                continue

            property_obj = await Property.find_one(
                Property.villa == villa,
                Property.row_letter == fila,
                Property.number == numero
            )

            if not property_obj:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"Property not found: Villa {villa}, {fila}{numero}"
                })
                results["failed_imports"] += 1
                continue

            fee = await Fee.find_one(
                {
                    "property": DBRef("properties", property_obj.id),
                    "year": year,
                    "month": month,
                    "status": FeeStatus.PENDING,
                }
            )

            if not fee:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"No pending fee found for property {villa}-{fila}{numero} in {month}/{year}"
                })
                results["failed_imports"] += 1
                continue

            existing_payment = await Payment.find_one(Payment.fee_id == str(fee.id))
            if existing_payment:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"Payment already exists for this fee"
                })
                results["failed_imports"] += 1
                continue

            payment = Payment(
                fee=fee,
                fee_id=str(fee.id),
                user=current_user,
                amount=amount,
                payment_date=payment_date,
                notes=notes if notes else None
            )
            await payment.insert()

            payment.status = PaymentStatus.APPROVED
            await payment.save()

            try:
                logger.info("Creating receipt for bulk import payment %s", payment.id)
                await create_receipt_on_approval(payment)
            except Exception:
                logger.exception("Error creating receipt for bulk import payment %s", payment.id)

            await update_fee_status_based_on_payments(fee)

            results["successful_imports"] += 1

        except Exception:
            logger.exception("Unexpected error importing payment on row %s", row_idx)
            results["errors"].append({"row": row_idx, "error": "Unexpected error processing row"})
            results["failed_imports"] += 1
            continue

    return results
