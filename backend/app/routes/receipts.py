import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, RedirectResponse
from typing import List, Literal, Optional
from datetime import datetime
from ..models.receipt import Receipt
from ..schemas.common import PaginatedResponse
from ..schemas.receipt import ReceiptCreate, ReceiptUpdate, ReceiptResponse
from ..models.payment import Payment
from ..models.miscellaneous_payment import MiscellaneousPayment
from ..models.fee import Fee
from ..models.property import Property
from ..models.treasurer import Treasurer
from ..models.user import User, UserRole
from ..dependencies.auth import get_current_user, require_admin
from ..utils.pdf_generator import generate_receipt_pdf
from ..config.database import database
from ..services.receipt_service import generate_correlative_number, create_receipt_for_payment
from ..services.cloudinary_service import upload_receipt_pdf
from bson import DBRef
from ..utils.links import link_id, link_ref_id
from ..utils.query import combine_filters, sort_spec, text_search_clauses

logger = logging.getLogger(__name__)

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
        fee = await Fee.get(payment_doc.fee_id)
        if fee:
            prop = await Property.get(link_ref_id(fee.property)) if link_ref_id(fee.property) else None
            if prop and link_id(prop.owner) == str(current_user.id):
                return
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


async def _owner_receipts_filter(current_user):
    # Owners see receipts for their own payments and payments on their properties
    user_id = str(current_user.id)
    properties = await Property.find_all().to_list()
    property_ids = {str(prop.id) for prop in properties if link_id(prop.owner) == user_id}
    fees = await Fee.find_all().to_list()
    fee_ids = {str(fee.id) for fee in fees if link_id(fee.property) in property_ids}

    payment_ids = [
        payment.id
        for payment in await Payment.find_all().to_list()
        if link_id(payment.user) == user_id or payment.fee_id in fee_ids
    ]
    misc_payment_ids = [
        payment.id
        for payment in await MiscellaneousPayment.find_all().to_list()
        if link_id(payment.user) == user_id
    ]
    clauses = []
    if payment_ids:
        clauses.append({"payment": {"$in": [DBRef("payments", pid) for pid in payment_ids]}})
    if misc_payment_ids:
        clauses.append(
            {
                "miscellaneous_payment": {
                    "$in": [DBRef("miscellaneous_payments", mid) for mid in misc_payment_ids]
                }
            }
        )
    if not clauses:
        return {"_id": None}
    return {"$or": clauses}


async def _owner_receipts_query(current_user):
    return Receipt.find(await _owner_receipts_filter(current_user))


RECEIPT_SORTS = {
    "date": "issue_date",
    "correlative": "correlative_number",
    "amount": "total_amount",
    "owner": "owner_details.name",
    "property": "property_details.villa",
}


def _build_receipt_pdf_data(receipt, payment_doc, misc_doc, expense_doc=None, treasurer_details=None):
    if payment_doc is not None:
        payment_date = payment_doc.payment_date
        reference = payment_doc.fee_id
    elif misc_doc is not None:
        payment_date = misc_doc.payment_date
        reference = str(misc_doc.id)
    elif expense_doc is not None:
        payment_date = expense_doc.expense_date
        reference = str(expense_doc.id)
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


@router.get("/", response_model=PaginatedResponse[ReceiptResponse])
async def get_receipts(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[Literal["date", "correlative", "amount", "owner", "property"]] = None,
    sort_dir: Optional[Literal["asc", "desc"]] = None,
    current_user: User = Depends(get_current_user)
):
    filters = []
    if current_user.role != UserRole.ADMIN:
        filters.append(await _owner_receipts_filter(current_user))

    search_clauses = text_search_clauses(
        search,
        [
            "correlative_number",
            "property_details.villa",
            "property_details.owner_name",
            "owner_details.name",
            "fee_period",
            "notes",
        ],
    )
    if search_clauses:
        filters.append({"$or": search_clauses})

    base_filter = combine_filters(*filters)
    receipt_query = Receipt.find(base_filter)

    # Get total count
    total_count = await receipt_query.count()

    # Calculate skip
    skip = (page - 1) * limit

    spec = sort_spec(sort_by, sort_dir, RECEIPT_SORTS, default_dir="desc")
    if not spec:
        spec = [("issue_date", -1)]

    # Get paginated results
    receipts = await receipt_query.sort(spec).skip(skip).limit(limit).to_list()

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

    return PaginatedResponse[ReceiptResponse](
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
    existing_receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
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
    pdf_data = _build_receipt_pdf_data(receipt, payment_doc, payment_misc, expense_doc)

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
    payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

    # Check permissions
    await _assert_receipt_access(payment_doc, payment_misc, current_user)

    # Always generate PDF on the fly to avoid Cloudinary permission issues
    pdf_data = _build_receipt_pdf_data(receipt, payment_doc, payment_misc, expense_doc)

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
    payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

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
        receipt, payment_doc, payment_misc, expense_doc, treasurer_details=updated_treasurer_details
    )

    pdf_buffer = generate_receipt_pdf(pdf_data)

    cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)

    receipt.generated_receipt_file = cloudinary_url
    await receipt.save()

    return {"message": "PDF regenerated successfully with updated treasurer information"}

@router.post("/regenerate-all-pdfs")
async def regenerate_all_receipt_pdfs(current_user: User = Depends(require_admin)):
    # Get all receipts
    receipts = await Receipt.find_all().to_list()
    updated_count = 0
    errors = []

    for receipt in receipts:
        try:
            # Fetch the linked documents (payment may be absent for
            # miscellaneous-payment and expense receipts)
            payment_doc, payment_misc, expense_doc = await _fetch_receipt_links(receipt)

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
                receipt, payment_doc, payment_misc, expense_doc, treasurer_details=updated_treasurer_details
            )

            pdf_buffer = generate_receipt_pdf(pdf_data)
            cloudinary_url = upload_receipt_pdf(pdf_buffer, receipt.correlative_number)
            receipt.generated_receipt_file = cloudinary_url
            await receipt.save()

            updated_count += 1

        except Exception:
            logger.exception("Error regenerating receipt %s", receipt.correlative_number)
            errors.append(f"Error processing receipt {receipt.correlative_number}")

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