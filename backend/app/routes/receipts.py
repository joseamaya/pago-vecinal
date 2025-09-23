from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime
import os
from ..models.receipt import Receipt, ReceiptCreate, ReceiptResponse
from ..models.payment import Payment
from ..models.fee import Fee
from ..models.treasurer import Treasurer
from ..models.user import User, UserRole
from ..routes.auth import get_current_user
from ..utils.pdf_generator import generate_receipt_pdf
from ..config.database import database

router = APIRouter()

async def generate_correlative_number(year: int, prefix: str = "REC") -> str:
    """Generate a correlative receipt number with specified prefix"""

    # Find the last receipt for this year and prefix
    last_receipt = await Receipt.find(
        {"correlative_number": {"$regex": f"^{prefix}-{year}"}}
    ).sort([("correlative_number", -1)]).first_or_none()

    if last_receipt:
        # Extract the sequential number from the last receipt
        parts = last_receipt.correlative_number.split("-")
        if len(parts) == 3:
            last_number = int(parts[2])
            new_number = last_number + 1
        else:
            new_number = 1
    else:
        new_number = 1

    # Format: PREFIX-YYYY-XXXXX (padded to 5 digits)
    return f"{prefix}-{year}-{new_number:05d}"

@router.get("/", response_model=List[ReceiptResponse])
async def get_receipts(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        receipts = await Receipt.find_all().to_list()
    else:
        # Owners can only see receipts for their payments
        receipts = await Receipt.find(
            Receipt.payment.user.id == current_user.id
        ).to_list()

    # Fetch links for each receipt
    for receipt in receipts:
        await receipt.fetch_link(Receipt.payment)

    return [
        ReceiptResponse(
            id=str(receipt.id),
            correlative_number=receipt.correlative_number,
            payment_id=str(receipt.payment.id),
            issue_date=receipt.issue_date,
            total_amount=receipt.total_amount,
            property_details=receipt.property_details,
            owner_details=receipt.owner_details,
            fee_period=receipt.fee_period,
            notes=receipt.notes,
            treasurer_details=receipt.treasurer_details,
            generated_receipt_file=receipt.generated_receipt_file
        )
        for receipt in receipts
    ]

@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(receipt_id: str, current_user: User = Depends(get_current_user)):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch linked documents
    await receipt.fetch_link(Receipt.payment)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not receipt.payment.user or str(receipt.payment.user.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return ReceiptResponse(
        id=str(receipt.id),
        correlative_number=receipt.correlative_number,
        payment_id=str(receipt.payment.id),
        issue_date=receipt.issue_date,
        total_amount=receipt.total_amount,
        property_details=receipt.property_details,
        owner_details=receipt.owner_details,
        fee_period=receipt.fee_period,
        notes=receipt.notes,
        treasurer_details=receipt.treasurer_details,
        generated_receipt_file=receipt.generated_receipt_file
    )

@router.post("/", response_model=ReceiptResponse)
async def create_receipt(
    receipt_data: ReceiptCreate,
    current_user: User = Depends(get_current_user)
):
    # Get the payment
    payment = await Payment.get(receipt_data.payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    if payment.fee:
        await payment.fee.fetch_link(Fee.property)
    if payment.user:
        await payment.fetch_link(Payment.user)

    # Check if payment is completed
    if payment.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate receipt for incomplete payment"
        )

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not payment.user or str(payment.user.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if receipt already exists for this payment
    existing_receipt = await Receipt.find_one(Receipt.payment.id == payment.id)
    if existing_receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt already exists for this payment"
        )


    # Generate correlative number - fee payments use CUOT
    correlative_number = await generate_correlative_number(payment.payment_date.year, "CUOT")

    # Create property and owner details snapshot
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

    # Get treasurer data based on villa
    villa = payment.fee.property.villa if payment.fee and payment.fee.property else None
    treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
    treasurer_details = {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None,
        "villa": treasurer.villa if treasurer else None
    }

    # Create receipt
    receipt = Receipt(
        correlative_number=correlative_number,
        payment=payment,
        issue_date=datetime.utcnow(),
        total_amount=payment.amount,
        property_details=property_details,
        owner_details=owner_details,
        fee_period=receipt_data.fee_period,
        notes=receipt_data.notes,
        treasurer_details=treasurer_details
    )

    await receipt.insert()

    # Generate PDF receipt
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

    # Save PDF to file
    pdf_filename = f"recibo_{receipt.correlative_number}.pdf"
    pdf_file_path = f"backend/static/receipts/{pdf_filename}"
    os.makedirs(os.path.dirname(pdf_file_path), exist_ok=True)

    with open(pdf_file_path, "wb") as f:
        f.write(pdf_buffer.getvalue())

    # Update receipt with generated file path
    receipt.generated_receipt_file = pdf_file_path
    await receipt.save()

    # Fetch linked documents for the response
    await receipt.fetch_link(Receipt.payment)

    return ReceiptResponse(
        id=str(receipt.id),
        correlative_number=receipt.correlative_number,
        payment_id=str(receipt.payment.id),
        issue_date=receipt.issue_date,
        total_amount=receipt.total_amount,
        property_details=receipt.property_details,
        owner_details=receipt.owner_details,
        fee_period=receipt.fee_period,
        notes=receipt.notes,
        treasurer_details=receipt.treasurer_details,
        generated_receipt_file=receipt.generated_receipt_file
    )

@router.get("/{receipt_id}/download")
async def download_receipt_pdf(receipt_id: str, current_user: User = Depends(get_current_user)):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch linked documents
    await receipt.fetch_link(Receipt.payment)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not receipt.payment.user or str(receipt.payment.user.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if PDF file exists
    if receipt.generated_receipt_file and os.path.exists(receipt.generated_receipt_file):
        # Serve the existing file
        def file_generator():
            with open(receipt.generated_receipt_file, "rb") as f:
                yield from f

        filename = f"recibo_{receipt.correlative_number}.pdf"
        return StreamingResponse(
            file_generator(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        # Generate PDF on the fly
        pdf_data = {
            "correlative_number": receipt.correlative_number,
            "issue_date": receipt.issue_date,
            "payment_date": receipt.payment.payment_date,
            "total_amount": receipt.total_amount,
            "property_details": receipt.property_details,
            "reference": receipt.payment.fee_id,
            "fee_period": receipt.fee_period,
            "notes": receipt.notes,
            "treasurer_details": receipt.treasurer_details
        }

        pdf_buffer = generate_receipt_pdf(pdf_data)

        # Return PDF as streaming response
        filename = f"recibo_{receipt.correlative_number}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

@router.delete("/{receipt_id}")
async def delete_receipt(receipt_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    await receipt.delete()
    return {"message": "Receipt deleted successfully"}