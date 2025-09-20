from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from ..models.miscellaneous_payment import (
    MiscellaneousPayment, MiscellaneousPaymentCreate, MiscellaneousPaymentUpdate,
    MiscellaneousPaymentResponse, MiscellaneousPaymentStatus, MiscellaneousPaymentType
)
from ..models.receipt import Receipt
from ..models.user import User, UserRole
from ..models.property import Property
from ..routes.auth import get_current_user

class BulkApproveRequest(BaseModel):
    payment_ids: List[str]

router = APIRouter()

@router.get("/", response_model=List[MiscellaneousPaymentResponse])
async def get_miscellaneous_payments(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        payments = await MiscellaneousPayment.find_all().to_list()
    else:
        # Owners can only see their own payments
        payments = await MiscellaneousPayment.find(MiscellaneousPayment.user.id == current_user.id).to_list()

    # Fetch links for each payment
    for payment in payments:
        if payment.property:
            await payment.fetch_link(MiscellaneousPayment.property)
        await payment.fetch_link(MiscellaneousPayment.user)

    return [
        MiscellaneousPaymentResponse(
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
            created_at=payment.id.generation_time if hasattr(payment.id, 'generation_time') else datetime.utcnow()
        )
        for payment in payments
    ]

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
        created_at=payment.id.generation_time if hasattr(payment.id, 'generation_time') else datetime.utcnow()
    )

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
            (not prop.owner or str(prop.owner.id) != str(current_user.id))):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

    # Handle file upload
    receipt_file_path = None
    if receipt_file:
        # Create unique filename
        file_extension = os.path.splitext(receipt_file.filename)[1]
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}{file_extension}"
        file_path = os.path.join("static", "uploads", unique_filename)

        # Save file
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
        created_at=payment.id.generation_time if hasattr(payment.id, 'generation_time') else datetime.utcnow()
    )

@router.put("/{payment_id}", response_model=MiscellaneousPaymentResponse)
async def update_miscellaneous_payment(
    payment_id: str,
    amount: Optional[float] = Form(None),
    payment_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
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
        # Create unique filename
        file_extension = os.path.splitext(receipt_file.filename)[1]
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}{file_extension}"
        file_path = os.path.join("static", "uploads", unique_filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)

        payment.receipt_file = file_path

    # Update fields
    if amount is not None:
        payment.amount = amount
    if payment_type is not None:
        payment.payment_type = MiscellaneousPaymentType(payment_type)
    if description is not None:
        payment.description = description
    if status is not None:
        payment.status = MiscellaneousPaymentStatus(status)
    if notes is not None:
        payment.notes = notes

    # Create receipt in database if status changed to approved
    if status == "approved":
        try:
            print(f"Creating receipt for miscellaneous payment {payment_id}")

            # Generate correlative number - miscellaneous payments use OTR
            from .receipts import generate_correlative_number
            correlative_number = await generate_correlative_number(current_year, "OTR")

            # Use stored property and owner details or create defaults
            property_details = payment.property_details or {
                "villa": "N/A",
                "row_letter": "N/A",
                "number": 0,
                "owner_name": "Propietario no registrado",
                "owner_phone": "N/A"
            }
            owner_details = payment.owner_details or {
                "name": "Propietario no registrado",
                "phone": "N/A"
            }

            # Create receipt record
            receipt = Receipt(
                correlative_number=correlative_number,
                miscellaneous_payment=payment,
                issue_date=datetime.utcnow(),
                total_amount=payment.amount,
                property_details=property_details,
                owner_details=owner_details,
                fee_period=f"Pago varios: {payment.description}",
                notes=f"Recibo generado automáticamente al aprobar el pago varios"
            )

            await receipt.insert()

            print(f"Receipt created in database with ID: {receipt.id}")
        except Exception as e:
            # Log the error but don't fail the payment update
            print(f"Error creating receipt for miscellaneous payment {payment_id}: {e}")
            import traceback
            traceback.print_exc()

    await payment.save()

    # Fetch links again after save
    if payment.property:
        await payment.fetch_link(MiscellaneousPayment.property)
    await payment.fetch_link(MiscellaneousPayment.user)

    response_data = MiscellaneousPaymentResponse(
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
        created_at=payment.id.generation_time if hasattr(payment.id, 'generation_time') else datetime.utcnow()
    )
    print(f"Returning response with generated_receipt_file: {response_data.generated_receipt_file}")
    return response_data

@router.delete("/{payment_id}")
async def delete_miscellaneous_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

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

    # Check if receipt file exists
    if not payment.generated_receipt_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt file associated with this payment"
        )

    # Convert relative path to absolute path if needed
    file_path = payment.generated_receipt_file
    if not os.path.isabs(file_path):
        file_path = os.path.join(os.getcwd(), file_path)

    print(f"Looking for receipt file at: {file_path}")
    print(f"File exists: {os.path.exists(file_path)}")

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt file not found at {file_path}"
        )

    # Return the PDF file
    filename = f"recibo_pago_varios_{payment_id}.pdf"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )

@router.post("/bulk-approve")
async def bulk_approve_miscellaneous_payments(
    request: BulkApproveRequest,
    current_user: User = Depends(get_current_user)
):
    payment_ids = request.payment_ids
    """Bulk approve multiple miscellaneous payments"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

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
                print(f"Creating receipt for miscellaneous payment {payment_id}")

                # Generate correlative number - miscellaneous payments use OTR
                from .receipts import generate_correlative_number
                correlative_number = await generate_correlative_number(current_year, "OTR")

                # Use stored property and owner details or create defaults
                property_details = payment.property_details or {
                    "villa": "N/A",
                    "row_letter": "N/A",
                    "number": 0,
                    "owner_name": "Propietario no registrado",
                    "owner_phone": "N/A"
                }
                owner_details = payment.owner_details or {
                    "name": "Propietario no registrado",
                    "phone": "N/A"
                }

                # Create receipt record
                receipt = Receipt(
                    correlative_number=correlative_number,
                    miscellaneous_payment=payment,
                    issue_date=datetime.utcnow(),
                    total_amount=payment.amount,
                    property_details=property_details,
                    owner_details=owner_details,
                    fee_period=f"Pago varios: {payment.description}",
                    notes=f"Recibo generado automáticamente al aprobar el pago varios (aprobación masiva)"
                )

                await receipt.insert()

                print(f"Receipt created in database with ID: {receipt.id}")
            except Exception as e:
                # Log the error but don't fail the bulk operation
                print(f"Error creating receipt for miscellaneous payment {payment_id}: {e}")
                import traceback
                traceback.print_exc()

            approved_count += 1

        except Exception as e:
            errors.append(f"Error processing payment {payment_id}: {str(e)}")

    return {
        "message": f"Successfully approved {approved_count} miscellaneous payments",
        "approved_count": approved_count,
        "errors": errors
    }