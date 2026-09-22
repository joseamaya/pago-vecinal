import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, RedirectResponse
from beanie.operators import In, Or
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from ..models.receipt import Receipt, ReceiptCreate, ReceiptUpdate, ReceiptResponse
from ..models.payment import Payment
from ..models.miscellaneous_payment import MiscellaneousPayment
from ..models.fee import Fee
from ..models.treasurer import Treasurer
from ..models.user import User, UserRole
from ..dependencies.auth import get_current_user, require_admin
from ..utils.pdf_generator import generate_receipt_pdf
from ..config.database import database
from ..services.receipt_service import generate_correlative_number, create_receipt_for_payment
from ..services.cloudinary_service import upload_receipt_pdf

logger = logging.getLogger(__name__)

class PaginatedReceiptResponse(BaseModel):
    data: List[ReceiptResponse]
    pagination: dict

router = APIRouter()


async def _fetch_receipt_links(receipt):
    payment_doc = await receipt.payment.fetch() if receipt.payment else None
    misc_doc = (
        await receipt.miscellaneous_payment.fetch()
        if receipt.miscellaneous_payment
        else None
    )
    expense_doc = await receipt.expense.fetch() if receipt.expense else None
    return payment_doc, misc_doc, expense_doc


async def _assert_receipt_access(payment_doc, misc_doc, current_user):
    if current_user.role == UserRole.ADMIN:
        return

    if payment_doc is not None:
        await payment_doc.fetch_link(Payment.user)
        owner = payment_doc.user
    elif misc_doc is not None:
        await misc_doc.fetch_link(MiscellaneousPayment.user)
        owner = misc_doc.user
    else:
        owner = None

    if not owner or str(owner.id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )


async def _owner_receipts_query(current_user):
    # Owners can only see receipts for their own payments (regular and miscellaneous)
    payment_ids = [
        p.id
        for p in await Payment.find(Payment.user.id == current_user.id).to_list()
    ]
    misc_payment_ids = [
        m.id
        for m in await MiscellaneousPayment.find(
            MiscellaneousPayment.user.id == current_user.id
        ).to_list()
    ]
    return Receipt.find(
        Or(
            In(Receipt.payment.id, payment_ids),
            In(Receipt.miscellaneous_payment.id, misc_payment_ids),
        )
    )


def _build_receipt_pdf_data(receipt, payment_doc, misc_doc, treasurer_details=None):
    if payment_doc is not None:
        payment_date = payment_doc.payment_date
        reference = payment_doc.fee_id
    elif misc_doc is not None:
        payment_date = misc_doc.payment_date
        reference = str(misc_doc.id)
    else:
        payment_date = receipt.issue_date
        reference = receipt.correlative_number

    return {
        "correlative_number": receipt.correlative_number,
        "issue_date": receipt.issue_date,
        "payment_date": payment_date,
        "total_amount": receipt.total_amount,
        "property_details": receipt.property_details,
        "reference": reference,
        "fee_period": receipt.fee_period,
        "notes": receipt.notes,
        "treasurer_details": (
            treasurer_details if treasurer_details is not None else receipt.treasurer_details
        ),
    }


@router.get("/", response_model=PaginatedReceiptResponse)
async def get_receipts(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    # Build base query
    if current_user.role == UserRole.ADMIN:
        base_query = Receipt.find_all()
    else:
        base_query = await _owner_receipts_query(current_user)

    # Get total count
    total_count = await base_query.count()

    # Calculate skip
    skip = (page - 1) * limit

    # Get paginated results, sorted by issue date descending
    receipts = await base_query.sort([("issue_date", -1)]).skip(skip).limit(limit).to_list()

    # Fetch links for each receipt
    for receipt in receipts:
        await receipt.fetch_link(Receipt.payment)
        await receipt.fetch_link(Receipt.miscellaneous_payment)
        await receipt.fetch_link(Receipt.expense)

    # Calculate total pages
    total_pages = (total_count + limit - 1) // limit

    # Build receipt responses
    receipt_responses = [
        ReceiptResponse(
            id=str(receipt.id),
            correlative_number=receipt.correlative_number,
            payment_id=str(receipt.payment.id) if receipt.payment else None,
            miscellaneous_payment_id=str(receipt.miscellaneous_payment.id) if receipt.miscellaneous_payment else None,
            expense_id=str(receipt.expense.id) if receipt.expense else None,
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

    return PaginatedReceiptResponse(
        data=receipt_responses,
        pagination={
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages
        }
    )

@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(receipt_id: str, current_user: User = Depends(get_current_user)):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch the linked documents
    payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    return ReceiptResponse(
        id=str(receipt.id),
        correlative_number=receipt.correlative_number,
        payment_id=str(payment_doc.id) if payment_doc else None,
        miscellaneous_payment_id=str(payment_misc.id) if payment_misc else None,
        expense_id=str(expense_doc.id) if expense_doc else None,
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

    # Check if payment is approved (receipts are created when payments are approved)
    if payment.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate receipt for unapproved payment"
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

    # Use centralized receipt creation function
    receipt = await create_receipt_for_payment(payment, receipt_data.fee_period, receipt_data.notes)

    # Fetch linked documents for the response
    await receipt.fetch_link(Receipt.payment)

    return ReceiptResponse(
        id=str(receipt.id),
        correlative_number=receipt.correlative_number,
        payment_id=str(receipt.payment.id) if receipt.payment else None,
        miscellaneous_payment_id=str(receipt.miscellaneous_payment.id) if receipt.miscellaneous_payment else None,
        issue_date=receipt.issue_date,
        total_amount=receipt.total_amount,
        property_details=receipt.property_details,
        owner_details=receipt.owner_details,
        fee_period=receipt.fee_period,
        notes=receipt.notes,
        treasurer_details=receipt.treasurer_details,
        generated_receipt_file=receipt.generated_receipt_file
    )

@router.put("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: str,
    receipt_data: ReceiptUpdate,
    current_user: User = Depends(get_current_user)
):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch the linked documents
    payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    # Update fields
    if receipt_data.fee_period is not None:
        receipt.fee_period = receipt_data.fee_period
    if receipt_data.notes is not None:
        receipt.notes = receipt_data.notes

    await receipt.save()

    # Regenerate PDF with updated information
    pdf_data = _build_receipt_pdf_data(receipt, payment_doc, payment_misc)

    pdf_buffer = generate_receipt_pdf(pdf_data)

    cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)

    receipt.generated_receipt_file = cloudinary_url
    await receipt.save()

    return ReceiptResponse(
        id=str(receipt.id),
        correlative_number=receipt.correlative_number,
        payment_id=str(payment_doc.id) if payment_doc else None,
        miscellaneous_payment_id=str(payment_misc.id) if payment_misc else None,
        expense_id=str(expense_doc.id) if expense_doc else None,
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

    # Fetch the linked documents
    payment_doc, payment_misc, _ = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    # Always generate PDF on the fly to avoid Cloudinary permission issues
    pdf_data = _build_receipt_pdf_data(receipt, payment_doc, payment_misc)

    pdf_buffer = generate_receipt_pdf(pdf_data)

    # Return PDF as streaming response
    filename = f"recibo_{receipt.correlative_number}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/{receipt_id}/regenerate-pdf")
async def regenerate_receipt_pdf(receipt_id: str, current_user: User = Depends(get_current_user)):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch the linked documents
    payment_doc, payment_misc, _ = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    # Update property details with current information
    if payment_doc and payment_doc.fee:
        await payment_doc.fetch_link(Payment.fee)
        await payment_doc.fee.fetch_link(Fee.property)
        if payment_doc.fee.property:
            property = payment_doc.fee.property
            updated_property_details = {
                "villa": property.villa,
                "row_letter": property.row_letter,
                "number": property.number,
                "owner_name": property.owner_name,
                "owner_phone": property.owner_phone
            }
            receipt.property_details = updated_property_details

    # Update treasurer details with current information
    villa = receipt.property_details.get('villa') if receipt.property_details else None
    treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
    updated_treasurer_details = {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None,
        "villa": treasurer.villa if treasurer else None
    }

    # Update receipt with latest details
    receipt.treasurer_details = updated_treasurer_details
    await receipt.save()

    # Regenerate PDF data with updated information
    pdf_data = _build_receipt_pdf_data(
        receipt, payment_doc, payment_misc, treasurer_details=updated_treasurer_details
    )

    pdf_buffer = generate_receipt_pdf(pdf_data)

    cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)

    receipt.generated_receipt_file = cloudinary_url
    await receipt.save()

    return {"message": "PDF regenerated successfully with updated treasurer information"}

@router.post("/regenerate-all-pdfs")
async def regenerate_all_receipt_pdfs(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions - only admins can regenerate all PDFs"
        )

    # Get all receipts
    receipts = await Receipt.find_all().to_list()
    updated_count = 0
    errors = []

    for receipt in receipts:
        try:
            # Fetch the linked documents (payment may be absent for
            # miscellaneous-payment and expense receipts)
            payment_doc, payment_misc, _ = await _fetch_receipt_links(receipt)

            # Update property details with current information
            if payment_doc and payment_doc.fee:
                await payment_doc.fetch_link(Payment.fee)
                await payment_doc.fee.fetch_link(Fee.property)
                if payment_doc.fee.property:
                    property = payment_doc.fee.property
                    updated_property_details = {
                        "villa": property.villa,
                        "row_letter": property.row_letter,
                        "number": property.number,
                        "owner_name": property.owner_name,
                        "owner_phone": property.owner_phone
                    }
                    receipt.property_details = updated_property_details

            # Update treasurer details with current information
            villa = receipt.property_details.get('villa') if receipt.property_details else None
            treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
            updated_treasurer_details = {
                "name": treasurer.name if treasurer else "Tesorero no configurado",
                "signature": treasurer.signature if treasurer else None,
                "villa": treasurer.villa if treasurer else None
            }

            # Update receipt with latest details
            receipt.treasurer_details = updated_treasurer_details

            # Regenerate PDF data with updated information
            pdf_data = _build_receipt_pdf_data(
                receipt, payment_doc, payment_misc, treasurer_details=updated_treasurer_details
            )

            pdf_buffer = generate_receipt_pdf(pdf_data)
            cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)
            receipt.generated_receipt_file = cloudinary_url
            await receipt.save()

            updated_count += 1

        except Exception as e:
            errors.append(f"Error processing receipt {receipt.correlative_number}: {str(e)}")

    return {
        "message": f"Regenerated {updated_count} receipt PDFs successfully",
        "updated_count": updated_count,
        "errors": errors
    }

@router.delete("/{receipt_id}")
async def delete_receipt(receipt_id: str, current_user: User = Depends(get_current_user)):
    receipt = await Receipt.get(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Fetch the linked documents
    payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    # Delete the Cloudinary file if it exists
    if receipt.generated_receipt_file:
        try:
            url_parts = receipt.generated_receipt_file.split('/')
            if len(url_parts) >= 8:
                public_id = '/'.join(url_parts[-2:])
                from ..services.cloudinary_service import delete_cloudinary_file
                delete_cloudinary_file(public_id)
        except Exception as e:
            logger.error("Error deleting Cloudinary file: %s", e)

    await receipt.delete()
    return {"message": "Receipt deleted successfully"}