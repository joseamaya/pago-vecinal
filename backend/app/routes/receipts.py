from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import List
from datetime import datetime
from ..models.receipt import Receipt, ReceiptCreate, ReceiptResponse
from ..models.payment import Payment
from ..models.user import User, UserRole
from ..routes.auth import get_current_user
from ..utils.pdf_generator import generate_receipt_pdf
from ..config.database import database

router = APIRouter()

async def generate_correlative_number() -> str:
    """Generate a correlative receipt number"""
    current_year = datetime.utcnow().year

    # Find the last receipt for this year
    last_receipt = await Receipt.find(
        Receipt.correlative_number.startswith(f"REC-{current_year}")
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

    # Format: REC-YYYY-XXXXX (padded to 5 digits)
    return f"REC-{current_year}-{new_number:05d}"

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
            notes=receipt.notes
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
        notes=receipt.notes
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
    await payment.fetch_link(Payment.property)
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

    # Generate correlative number
    correlative_number = await generate_correlative_number()

    # Create property and owner details snapshot
    property_details = {
        "villa": payment.property.villa,
        "row_letter": payment.property.row_letter,
        "number": payment.property.number,
        "owner_name": payment.property.owner_name,
        "owner_phone": payment.property.owner_phone
    }

    owner_details = {
        "name": payment.property.owner_name,
        "phone": payment.property.owner_phone
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
        notes=receipt_data.notes
    )

    await receipt.insert()

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
        notes=receipt.notes
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

    # Prepare data for PDF generation
    pdf_data = {
        "correlative_number": receipt.correlative_number,
        "issue_date": receipt.issue_date,
        "payment_date": receipt.payment.payment_date,
        "total_amount": receipt.total_amount,
        "property_details": receipt.property_details,
        "reference": receipt.payment.reference,
        "fee_period": receipt.fee_period,
        "notes": receipt.notes
    }

    # Generate PDF
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