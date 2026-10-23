import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Optional
from datetime import datetime
import os
import shutil
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from bson import ObjectId
from ..models.payment import Payment, PaymentStatus
from ..schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse
from ..models.fee import Fee, FeeStatus
from ..models.treasurer import Treasurer
from ..models.user import User, UserRole
from ..models.receipt import Receipt
from ..utils.links import link_id, link_ref_id
from bson import DBRef
from ..schemas.receipt import ReceiptResponse
from ..models.property import Property
from ..dependencies.auth import get_current_user, require_admin
from ..config.database import database
from ..utils.pdf_generator import generate_receipt_pdf
from ..utils.uploads import (
    validate_upload,
    EXCEL_EXTENSIONS,
    EXCEL_CONTENT_TYPES,
    MAX_EXCEL_MB,
)
from ..services.payment_service import (
    update_fee_status_based_on_payments,
    create_receipt_on_approval,
    bulk_import_payment_rows,
)
from ..schemas.common import BulkApproveRequest, PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter()


async def _owner_fee_ids(current_user: User) -> list:
    properties = await Property.find_all().to_list()
    property_ids = {
        str(prop.id) for prop in properties if link_id(prop.owner) == str(current_user.id)
    }
    if not property_ids:
        return []
    fees = await Fee.find_all().to_list()
    return [str(fee.id) for fee in fees if link_id(fee.property) in property_ids]


async def _can_access_fee(fee: Fee, current_user: User) -> bool:
    if current_user.role == UserRole.ADMIN:
        return True
    if fee.user and link_id(fee.user) == str(current_user.id):
        return True
    property_id = link_ref_id(fee.property)
    prop = await Property.get(property_id) if property_id else None
    return bool(prop and link_id(prop.owner) == str(current_user.id))


async def _can_access_payment(payment: Payment, current_user: User) -> bool:
    if current_user.role == UserRole.ADMIN:
        return True
    if payment.user and link_id(payment.user) == str(current_user.id):
        return True
    fee = await Fee.get(payment.fee_id)
    return bool(fee and await _can_access_fee(fee, current_user))

@router.get("/", response_model=PaginatedResponse[PaymentResponse])
async def get_payments(
    page: int = 1,
    limit: int = 20,
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    fee_id: Optional[str] = None,
    property_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Build query filters
    query_filters = {}
    if current_user.role != UserRole.ADMIN:
        # Owners see payments they registered and payments made on their fees
        owned_fee_ids = await _owner_fee_ids(current_user)
        owner_clauses = [{"user.$id": current_user.id}]
        if owned_fee_ids:
            owner_clauses.append({"fee_id": {"$in": owned_fee_ids}})
        query_filters["$or"] = owner_clauses

    # Add filter parameters
    if year is not None and month is not None:
        # Filter by specific year and month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query_filters["payment_date"] = {"$gte": start_date, "$lt": end_date}
    elif year is not None:
        # Filter by year only
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
        query_filters["payment_date"] = {"$gte": start_date, "$lt": end_date}
    elif month is not None:
        # Filter by month across all years (this is more complex, but we'll do it by month number)
        query_filters["$expr"] = {"$eq": [{"$month": "$payment_date"}, month]}

    if status is not None:
        query_filters["status"] = status

    if fee_id is not None:
        query_filters["fee_id"] = fee_id

    # Property filter will be handled in the aggregation pipeline

    # Get motor collection for aggregation
    payment_collection = database.payments

    # Get total count using aggregation with lookups for property filter
    count_pipeline = [
        {"$match": query_filters},
        {"$lookup": {
            "from": "fees",
            "localField": "fee.$id",
            "foreignField": "_id",
            "as": "fee_data"
        }},
        {"$unwind": "$fee_data"},
        {"$lookup": {
            "from": "properties",
            "localField": "fee_data.property.$id",
            "foreignField": "_id",
            "as": "property_data"
        }},
        {"$unwind": "$property_data"}
    ]
    if property_id is not None:
        count_pipeline.append({"$match": {"property_data._id": ObjectId(property_id)}})
    count_pipeline.append({"$count": "total"})
    count_result = await payment_collection.aggregate(count_pipeline).to_list(length=1)
    total_count = count_result[0]["total"] if count_result else 0

    # Calculate skip
    skip = (page - 1) * limit

    # Aggregation pipeline for paginated results
    pipeline = [
        {"$match": query_filters},
        {"$lookup": {
            "from": "fees",
            "localField": "fee.$id",
            "foreignField": "_id",
            "as": "fee_data"
        }},
        {"$unwind": "$fee_data"},
        {"$lookup": {
            "from": "properties",
            "localField": "fee_data.property.$id",
            "foreignField": "_id",
            "as": "property_data"
        }},
        {"$unwind": "$property_data"},
        {"$lookup": {
            "from": "users",
            "localField": "user.$id",
            "foreignField": "_id",
            "as": "user_data"
        }},
        {"$unwind": {"path": "$user_data", "preserveNullAndEmptyArrays": True}},
    ]
    if property_id is not None:
        pipeline.append({"$match": {"property_data._id": ObjectId(property_id)}})
    pipeline.append({"$addFields": {
        "status_priority": {
            "$switch": {
                "branches": [
                    {"case": {"$eq": ["$status", "pending"]}, "then": 1},
                    {"case": {"$eq": ["$status", "approved"]}, "then": 2},
                    {"case": {"$eq": ["$status", "rejected"]}, "then": 3},
                    {"case": {"$eq": ["$status", "completed"]}, "then": 4},
                    {"case": {"$eq": ["$status", "failed"]}, "then": 5},
                    {"case": {"$eq": ["$status", "cancelled"]}, "then": 6}
                ],
                "default": 7
            }
        }
    }})
    pipeline.append({"$sort": {
        "status_priority": 1,
        "payment_date": -1
    }})
    pipeline.append({"$skip": skip})
    pipeline.append({"$limit": limit})

    # Execute aggregation
    results = await payment_collection.aggregate(pipeline).to_list(length=None)

    # Calculate total pages
    total_pages = (total_count + limit - 1) // limit

    # Build payment responses from aggregated data
    payment_responses = []
    for result in results:
        # Find associated receipt
        receipt = await Receipt.find_one({"payment": DBRef("payments", result["_id"])})
        receipt_correlative = receipt.correlative_number if receipt else None
        receipt_issue_date = receipt.issue_date if receipt else None

        payment_responses.append(
            PaymentResponse(
                id=str(result["_id"]),
                fee_id=str(result["fee_data"]["_id"]),
                user_id=str(result["user_data"]["_id"]) if result.get("user_data") else None,
                amount=result["amount"],
                payment_date=result["payment_date"],
                status=result["status"],
                notes=result.get("notes"),
                property_row_letter=result["property_data"]["row_letter"],
                property_number=result["property_data"]["number"],
                fee_month=result["fee_data"]["month"],
                fee_year=result["fee_data"]["year"],
                receipt_correlative_number=receipt_correlative,
                receipt_issue_date=receipt_issue_date
            )
        )

    return PaginatedResponse[PaymentResponse](
        data=payment_responses,
        pagination={
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages
        }
    )

@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    payment = await Payment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)
    # Fetch property from fee
    if payment.fee:
        await payment.fee.fetch_link('property')

    # Fetch associated receipt if exists
    receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
    receipt_correlative = receipt.correlative_number if receipt else None
    receipt_issue_date = receipt.issue_date if receipt else None

    # Check permissions
    if not await _can_access_payment(payment, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return PaymentResponse(
        id=str(payment.id),
        fee_id=payment.fee_id,
        user_id=str(payment.user.id),
        amount=payment.amount,
        payment_date=payment.payment_date,
        status=payment.status,
        notes=payment.notes,
        property_row_letter=getattr(payment.fee.property, 'row_letter', None) if payment.fee and payment.fee.property else None,
        property_number=getattr(payment.fee.property, 'number', None) if payment.fee and payment.fee.property else None,
        fee_month=getattr(payment.fee, 'month', None) if payment.fee else None,
        fee_year=getattr(payment.fee, 'year', None) if payment.fee else None,
        receipt_correlative_number=receipt_correlative,
        receipt_issue_date=receipt_issue_date
    )

@router.post("/", response_model=PaymentResponse)
async def create_payment(
    fee_id: str = Form(...),
    amount: float = Form(...),
    payment_date: Optional[datetime] = Form(None),
    payment_status: Optional[str] = Form(None, alias="status"),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    # Get the fee
    fee = await Fee.get(fee_id)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )

    # Check if user owns this fee or is admin
    if not await _can_access_fee(fee, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    payment = Payment(
        fee=fee,
        fee_id=str(fee.id),
        user=current_user,
        amount=amount,
        payment_date=payment_date if payment_date is not None else datetime.utcnow(),
        notes=notes
    )

    # Set status if provided, otherwise use default (PENDING)
    if payment_status is not None:
        payment.status = PaymentStatus(payment_status)

    await payment.insert()

    # Create receipt and update fee status if approved
    if payment_status == "approved":
        await payment.fetch_link(Payment.fee)
        await create_receipt_on_approval(payment)
        if payment.fee:
            await update_fee_status_based_on_payments(payment.fee)

    # Fetch linked documents for the response
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)
    # Fetch property from fee
    if payment.fee:
        await payment.fee.fetch_link('property')

    # Fetch associated receipt if exists
    receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
    receipt_correlative = receipt.correlative_number if receipt else None
    receipt_issue_date = receipt.issue_date if receipt else None

    return PaymentResponse(
        id=str(payment.id),
        fee_id=payment.fee_id,
        user_id=str(payment.user.id),
        amount=payment.amount,
        payment_date=payment.payment_date,
        status=payment.status,
        notes=payment.notes,
        property_row_letter=getattr(payment.fee.property, 'row_letter', None) if payment.fee and payment.fee.property else None,
        property_number=getattr(payment.fee.property, 'number', None) if payment.fee and payment.fee.property else None,
        fee_month=getattr(payment.fee, 'month', None) if payment.fee else None,
        fee_year=getattr(payment.fee, 'year', None) if payment.fee else None,
        receipt_correlative_number=receipt_correlative,
        receipt_issue_date=receipt_issue_date
    )

@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: str,
    amount: Optional[float] = Form(None),
    payment_status: Optional[str] = Form(None, alias="status"),
    notes: Optional[str] = Form(None),
    payment_date: Optional[datetime] = Form(None),
    current_user: User = Depends(get_current_user)
):
    payment = await Payment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    # Check permissions
    if not await _can_access_payment(payment, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )


    # Update fields
    if amount is not None:
        payment.amount = amount
    if payment_status is not None:
        payment.status = PaymentStatus(payment_status)
    if notes is not None:
        payment.notes = notes
    if payment_date is not None:
        payment.payment_date = payment_date


    await payment.save()

    # Create receipt automatically if status changed to approved
    if payment_status == "approved":
        try:
            logger.info("Creating receipt for payment %s", payment_id)
            await create_receipt_on_approval(payment)
        except Exception as e:
            logger.exception("Error creating receipt for payment %s", payment_id)

    # Update fee status based on total payments if payment was approved
    if payment_status == "approved" and payment.fee:
        await update_fee_status_based_on_payments(payment.fee)

    # Fetch links again after save
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)
    # Fetch property from fee
    if payment.fee:
        await payment.fee.fetch_link('property')

    # Fetch associated receipt if exists
    receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
    receipt_correlative = receipt.correlative_number if receipt else None
    receipt_issue_date = receipt.issue_date if receipt else None

    return PaymentResponse(
        id=str(payment.id),
        fee_id=payment.fee_id,
        user_id=str(payment.user.id),
        amount=payment.amount,
        payment_date=payment.payment_date,
        status=payment.status,
        notes=payment.notes,
        property_row_letter=getattr(payment.fee.property, 'row_letter', None) if payment.fee and payment.fee.property else None,
        property_number=getattr(payment.fee.property, 'number', None) if payment.fee and payment.fee.property else None,
        fee_month=getattr(payment.fee, 'month', None) if payment.fee else None,
        fee_year=getattr(payment.fee, 'year', None) if payment.fee else None,
        receipt_correlative_number=receipt_correlative,
        receipt_issue_date=receipt_issue_date
    )

@router.delete("/{payment_id}")
async def delete_payment(payment_id: str, current_user: User = Depends(require_admin)):
    payment = await Payment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch the associated fee to update it later
    await payment.fetch_link(Payment.fee)
    fee = payment.fee

    # Find and delete the associated receipt
    receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
    if receipt:
        # Delete the generated PDF file if it exists
        if receipt.generated_receipt_file and os.path.exists(receipt.generated_receipt_file):
            try:
                os.remove(receipt.generated_receipt_file)
            except OSError as e:
                # Log error, but continue with deletion
                logger.error("Error deleting receipt file: %s", e)

        await receipt.delete()

    # Delete the payment itself
    await payment.delete()

    # After payment is deleted, update the associated fee's status
    if fee:
        await update_fee_status_based_on_payments(fee)

    return {"message": "Payment deleted successfully"}

@router.get("/{payment_id}/download-receipt")
async def download_generated_receipt(payment_id: str, current_user: User = Depends(get_current_user)):
    """Download the automatically generated receipt PDF for a payment"""
    payment = await Payment.get(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    # Check permissions
    if not await _can_access_payment(payment, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Find associated receipt
    receipt = await Receipt.find_one({"payment": DBRef("payments", payment.id)})
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt associated with this payment"
        )

    # Fetch the actual payment document
    payment_doc = await receipt.payment.fetch()

    # Always generate PDF on the fly to avoid Cloudinary permission issues
    # Fetch current property and treasurer details
    if payment.fee:
        await payment.fee.fetch_link('property')
        property_details = {
            "villa": payment.fee.property.villa,
            "row_letter": payment.fee.property.row_letter,
            "number": payment.fee.property.number,
            "owner_name": payment.fee.property.owner_name,
            "owner_phone": payment.fee.property.owner_phone
        }
    else:
        property_details = receipt.property_details or {}

    # Get current treasurer data
    villa = property_details.get('villa')
    treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
    treasurer_details = {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None,
        "villa": treasurer.villa if treasurer else None
    }

    pdf_data = {
        "correlative_number": receipt.correlative_number,
        "issue_date": receipt.issue_date,
        "payment_date": payment_doc.payment_date,
        "total_amount": receipt.total_amount,
        "property_details": property_details,
        "reference": payment_doc.fee_id,
        "fee_period": receipt.fee_period,
        "notes": receipt.notes,
        "treasurer_details": treasurer_details
    }

    pdf_buffer = generate_receipt_pdf(pdf_data)

    # Return PDF as streaming response
    filename = f"recibo_{receipt.correlative_number}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/bulk-import")
async def bulk_import_payments(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin)
):
    """Bulk import payments from Excel file"""
    await validate_upload(file, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, MAX_EXCEL_MB)

    try:
        # Load workbook
        wb = load_workbook(file.file)
        ws = wb.active

        # Expected columns: Villa, Fila, Número, Año, Mes, Monto, Fecha de Pago, Notas
        expected_headers = ['Villa', 'Fila', 'Número', 'Año', 'Mes', 'Monto', 'Fecha de Pago', 'Notas']

        # Check headers
        actual_headers = []
        for col in range(1, 9):
            cell_value = ws.cell(row=1, column=col).value
            if cell_value:
                actual_headers.append(str(cell_value).strip())
            else:
                actual_headers.append("")

        if actual_headers[:7] != expected_headers[:7]:  # Notas is optional
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Excel format. Expected headers: {', '.join(expected_headers[:7])}"
            )

        return await bulk_import_payment_rows(ws, current_user)

    except InvalidFileException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Excel file"
        )
    except Exception:
        logger.exception("Error processing payments import file")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing file"
        )

@router.post("/bulk-approve")
async def bulk_approve_payments(
    request: BulkApproveRequest,
    current_user: User = Depends(require_admin)
):
    payment_ids = request.payment_ids
    """Bulk approve multiple payments"""
    if not payment_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment IDs provided"
        )

    approved_count = 0
    errors = []

    for payment_id in payment_ids:
        try:
            payment = await Payment.get(payment_id)
            if not payment:
                errors.append(f"Payment {payment_id} not found")
                continue

            # Check if payment is already approved
            if payment.status == PaymentStatus.APPROVED:
                errors.append(f"Payment {payment_id} is already approved")
                continue

            # Fetch linked documents
            await payment.fetch_link(Payment.fee)
            await payment.fetch_link(Payment.user)

            # Update payment status
            payment.status = PaymentStatus.APPROVED
            await payment.save()

            # Create receipt automatically
            try:
                logger.info("Creating receipt for payment %s", payment_id)
                await create_receipt_on_approval(payment)
            except Exception as e:
                logger.exception("Error creating receipt for payment %s", payment_id)

            # Update fee status based on total payments
            if payment.fee:
                await update_fee_status_based_on_payments(payment.fee)


            approved_count += 1

        except Exception:
            logger.exception("Error processing payment %s in bulk approve", payment_id)
            errors.append(f"Error processing payment {payment_id}")

    return {
        "message": f"Successfully approved {approved_count} payments",
        "approved_count": approved_count,
        "errors": errors
    }