import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Optional
from datetime import datetime
import os
import shutil
from ..models.miscellaneous_payment import (
    MiscellaneousPayment, MiscellaneousPaymentStatus, MiscellaneousPaymentType
)
from ..schemas.miscellaneous_payment import (
    MiscellaneousPaymentCreate, MiscellaneousPaymentUpdate, MiscellaneousPaymentResponse
)
from ..models.receipt import Receipt
from ..models.user import User, UserRole
from ..models.property import Property
from ..dependencies.auth import get_current_user, require_admin
from ..utils.pdf_generator import generate_receipt_pdf
from ..services.miscellaneous_payment_service import (
    DEFAULT_PROPERTY_DETAILS,
    DEFAULT_OWNER_DETAILS,
    build_miscellaneous_payment_response,
    create_receipt_for_miscellaneous_payment,
    resolve_treasurer_details,
)
from ..utils.uploads import (
    validate_upload,
    safe_extension,
    RECEIPT_EXTENSIONS,
    RECEIPT_CONTENT_TYPES,
    MAX_RECEIPT_MB,
)
from ..schemas.common import BulkApproveRequest
from ..utils.links import link_id
from bson import DBRef

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[MiscellaneousPaymentResponse])
async def get_miscellaneous_payments(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        payments = await MiscellaneousPayment.find_all().to_list()
    else:
        # Owners can only see their own payments
        payments = await MiscellaneousPayment.find({"user": DBRef("users", current_user.id)}).to_list()

    # Fetch links for each payment
    for payment in payments:
        if payment.property:
            await payment.fetch_link(MiscellaneousPayment.property)
        await payment.fetch_link(MiscellaneousPayment.user)

    return [build_miscellaneous_payment_response(payment) for payment in payments]

@router.get("/{payment_id}", response_model=MiscellaneousPaymentResponse)
async def get_miscellaneous_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    payment = await MiscellaneousPayment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(payment.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return build_miscellaneous_payment_response(payment)

@router.post("/", response_model=MiscellaneousPaymentResponse)
async def create_miscellaneous_payment(
    property_id: Optional[str] = Form(None),
    payment_type: MiscellaneousPaymentType = Form(...),
    amount: float = Form(...),
    payment_date: datetime = Form(...),
    description: str = Form(...),
    notes: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    # Get the property if provided
    prop = None
    if property_id:
        prop = await Property.get(property_id)
        if not prop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Property not found"
            )

        # Check if user owns this property or is admin
        if (current_user.role != UserRole.ADMIN and
            (not prop.owner or link_id(prop.owner) != str(current_user.id))):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    # Handle file upload
    receipt_file_path = None
    if receipt_file:
        await validate_upload(receipt_file, RECEIPT_EXTENSIONS, RECEIPT_CONTENT_TYPES, MAX_RECEIPT_MB)

        # Create unique filename
        file_extension = safe_extension(receipt_file.filename)
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}{file_extension}"
        file_path = os.path.join("static", "uploads", unique_filename)

        # Save file
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)

        receipt_file_path = file_path

    # Create property and owner details snapshot for receipt generation
    property_details = None
    owner_details = None
    if prop:
        property_details = {
            "villa": getattr(prop, 'villa', 'N/A'),
            "row_letter": getattr(prop, 'row_letter', 'N/A'),
            "number": getattr(prop, 'number', 0),
            "owner_name": getattr(prop, 'owner_name', 'Propietario no registrado'),
            "owner_phone": getattr(prop, 'owner_phone', 'N/A') or "N/A"
        }
        owner_details = {
            "name": getattr(prop, 'owner_name', 'Propietario no registrado'),
            "phone": getattr(prop, 'owner_phone', 'N/A') or "N/A"
        }

    payment = MiscellaneousPayment(
        property=prop,
        user=current_user,
        payment_type=payment_type,
        amount=amount,
        payment_date=payment_date,
        receipt_file=receipt_file_path,
        description=description,
        notes=notes,
        property_details=property_details,
        owner_details=owner_details
    )
    await payment.insert()

    # Fetch linked documents for the response
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    return build_miscellaneous_payment_response(payment)

@router.put("/{payment_id}", response_model=MiscellaneousPaymentResponse)
async def update_miscellaneous_payment(
    payment_id: str,
    property_id: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    payment_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    payment_status: Optional[str] = Form(None, alias="status"),
    notes: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    payment = await MiscellaneousPayment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(payment.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Handle file upload
    if receipt_file:
        await validate_upload(receipt_file, RECEIPT_EXTENSIONS, RECEIPT_CONTENT_TYPES, MAX_RECEIPT_MB)

        # Create unique filename
        file_extension = safe_extension(receipt_file.filename)
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}{file_extension}"
        file_path = os.path.join("static", "uploads", unique_filename)

        # Save file
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)

        payment.receipt_file = file_path

    # Update fields
    if property_id is not None:
        prop = None
        if property_id:
            prop = await Property.get(property_id)
            if not prop:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Property not found"
                )
            if (current_user.role != UserRole.ADMIN and
                (not prop.owner or link_id(prop.owner) != str(current_user.id))):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions"
                )
            payment.property_details = {
                "villa": getattr(prop, "villa", "N/A"),
                "row_letter": getattr(prop, "row_letter", "N/A"),
                "number": getattr(prop, "number", 0),
                "owner_name": getattr(prop, "owner_name", "Propietario no registrado"),
                "owner_phone": getattr(prop, "owner_phone", "N/A") or "N/A",
            }
            payment.owner_details = {
                "name": getattr(prop, "owner_name", "Propietario no registrado"),
                "phone": getattr(prop, "owner_phone", "N/A") or "N/A",
            }
        else:
            payment.property_details = None
            payment.owner_details = None
        payment.property = prop
    if amount is not None:
        payment.amount = amount
    if payment_type is not None:
        payment.payment_type = MiscellaneousPaymentType(payment_type)
    if description is not None:
        payment.description = description
    if payment_status is not None:
        payment.status = MiscellaneousPaymentStatus(payment_status)
    if notes is not None:
        payment.notes = notes

    # Create receipt in database if status changed to approved
    if payment_status == "approved":
        try:
            logger.info("Creating receipt for miscellaneous payment %s", payment_id)
            _, cloudinary_url = await create_receipt_for_miscellaneous_payment(
                payment,
                note="Recibo generado automáticamente al aprobar el pago varios",
            )
            payment.generated_receipt_file = cloudinary_url
            await payment.save()
            logger.info("Receipt PDF generated and uploaded for miscellaneous payment %s", payment_id)
        except Exception:
            logger.exception("Error creating receipt for miscellaneous payment %s", payment_id)

    await payment.save()

    # Fetch links again after save
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    response_data = build_miscellaneous_payment_response(payment)
    logger.info("Returning response with generated_receipt_file: %s", response_data.generated_receipt_file)
    return response_data

@router.delete("/{payment_id}")
async def delete_miscellaneous_payment(payment_id: str, current_user: User = Depends(require_admin)):
    payment = await MiscellaneousPayment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    await payment.delete()
    return {"message": "Payment deleted successfully"}

@router.get("/{payment_id}/download-receipt")
async def download_miscellaneous_receipt(payment_id: str, current_user: User = Depends(get_current_user)):
    """Download the automatically generated receipt PDF for a miscellaneous payment"""
    payment = await MiscellaneousPayment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(payment.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if payment is approved
    if payment.status != MiscellaneousPaymentStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt only available for approved payments"
        )

    # Get the associated receipt
    receipt = await Receipt.find_one({"miscellaneous_payment": DBRef("miscellaneous_payments", payment.id)})
    if not receipt:
        # Create receipt on the fly for payments approved before the fix
        logger.info("Creating receipt on the fly for miscellaneous payment %s", payment_id)
        receipt, _ = await create_receipt_for_miscellaneous_payment(
            payment,
            note="Recibo generado automáticamente al descargar",
            upload=False,
        )
        logger.info("Receipt created on the fly with ID: %s", receipt.id)

    # Fetch property and treasurer details
    property_details = payment.property_details or DEFAULT_PROPERTY_DETAILS
    treasurer_details = await resolve_treasurer_details(property_details)

    # Generate PDF data
    pdf_data = {
        "correlative_number": receipt.correlative_number,
        "issue_date": receipt.issue_date,
        "payment_date": payment.payment_date,
        "total_amount": receipt.total_amount,
        "property_details": property_details,
        "reference": payment.id,
        "fee_period": receipt.fee_period,
        "notes": receipt.notes,
        "treasurer_details": treasurer_details
    }

    pdf_buffer = generate_receipt_pdf(pdf_data)

    # Return PDF as streaming response
    filename = f"recibo_pago_varios_{receipt.correlative_number}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/bulk-approve")
async def bulk_approve_miscellaneous_payments(
    request: BulkApproveRequest,
    current_user: User = Depends(require_admin)
):
    payment_ids = request.payment_ids
    """Bulk approve multiple miscellaneous payments"""
    if not payment_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment IDs provided"
        )

    approved_count = 0
    errors = []

    for payment_id in payment_ids:
        try:
            payment = await MiscellaneousPayment.get(payment_id)
            if not payment:
                errors.append(f"Payment {payment_id} not found")
                continue

            # Check if payment is already approved
            if payment.status == MiscellaneousPaymentStatus.APPROVED:
                errors.append(f"Payment {payment_id} is already approved")
                continue

            # Fetch linked documents
            if payment.property:
                await payment.fetch_link(MiscellaneousPayment.property)
            await payment.fetch_link(MiscellaneousPayment.user)

            # Update payment status
            payment.status = MiscellaneousPaymentStatus.APPROVED
            await payment.save()

            # Generate receipt (similar to individual approval)
            try:
                logger.info("Creating receipt for miscellaneous payment %s", payment_id)
                _, cloudinary_url = await create_receipt_for_miscellaneous_payment(
                    payment,
                    note="Recibo generado automáticamente al aprobar el pago varios (aprobación masiva)",
                )
                if cloudinary_url:
                    payment.generated_receipt_file = cloudinary_url
                await payment.save()
                logger.info("Receipt PDF generated for miscellaneous payment %s", payment_id)
            except Exception:
                # Log the error but don't fail the bulk operation
                logger.exception("Error creating receipt for miscellaneous payment %s", payment_id)

            approved_count += 1

        except Exception:
            logger.exception("Error processing miscellaneous payment %s in bulk approve", payment_id)
            errors.append(f"Error processing payment {payment_id}")

    return {
        "message": f"Successfully approved {approved_count} miscellaneous payments",
        "approved_count": approved_count,
        "errors": errors
    }