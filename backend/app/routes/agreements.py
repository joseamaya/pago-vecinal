import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import os
import shutil
from beanie import PydanticObjectId
from bson.errors import InvalidId
from ..models.agreement import (
    Agreement, AgreementInstallment, AgreementStatus, AgreementInstallmentStatus
)
from ..schemas.agreement import (
    AgreementCreate, AgreementUpdate, AgreementResponse,
    AgreementInstallmentCreate, AgreementInstallmentUpdate, AgreementInstallmentResponse
)
from ..models.fee import Fee, FeeStatus
from ..models.property import Property
from ..models.user import User, UserRole
from ..models.treasurer import Treasurer
from ..dependencies.auth import get_current_user, require_admin
from ..services.agreement_service import (
    build_agreement_response,
    build_installment_response,
    create_agreement_with_installments,
)
from ..services.ownership_service import primary_user_for_property, user_owns_property
from ..utils.uploads import (
    validate_upload,
    safe_extension,
    RECEIPT_EXTENSIONS,
    RECEIPT_CONTENT_TYPES,
    MAX_RECEIPT_MB,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_agreement_filters(current_user, property_id=None, status_filter=None):
    filters = []

    if current_user.role != UserRole.ADMIN:
        # Regular users can only see agreements for their properties
        filters.append(Agreement.user.id == current_user.id)

    if property_id:
        try:
            filters.append(Agreement.property.id == PydanticObjectId(property_id))
        except (InvalidId, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid property_id"
            )

    if status_filter:
        filters.append(Agreement.status == status_filter)

    return filters


@router.get("/", response_model=List[AgreementResponse])
async def get_agreements(
    current_user: User = Depends(get_current_user),
    property_id: Optional[str] = None,
    status: Optional[str] = None
):
    # Build query filters
    filters = _build_agreement_filters(current_user, property_id, status)

    # Get agreements
    if filters:
        agreements = await Agreement.find(*filters).to_list()
    else:
        agreements = await Agreement.find_all().to_list()

    # Sort by creation date descending
    agreements.sort(key=lambda a: a.created_at, reverse=True)

    # Fetch links and build responses
    responses = []
    for agreement in agreements:
        await agreement.fetch_link(Agreement.property)
        await agreement.fetch_link(Agreement.user)
        await agreement.fetch_link(Agreement.fees)
        responses.append(await build_agreement_response(agreement))

    return responses

@router.get("/{agreement_id}", response_model=AgreementResponse)
async def get_agreement(agreement_id: str, current_user: User = Depends(get_current_user)):
    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Fetch links
    await agreement.fetch_link(Agreement.property)
    await agreement.fetch_link(Agreement.user)
    await agreement.fetch_link(Agreement.fees)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(agreement.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return await build_agreement_response(agreement)

@router.post("/", response_model=AgreementResponse)
async def create_agreement(
    agreement_data: AgreementCreate,
    current_user: User = Depends(get_current_user)
):
    # Get the property
    prop = await Property.get(agreement_data.property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Check permissions
    if not await user_owns_property(current_user, prop):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get and validate fees
    fees = []
    total_debt = 0
    if not agreement_data.fee_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one fee must be selected for the agreement"
        )

    for fee_id in agreement_data.fee_ids:
        fee = await Fee.get(fee_id)
        if not fee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fee {fee_id} not found"
            )

        # Check if fee belongs to the property
        await fee.fetch_link(Fee.property)
        if str(fee.property.id) != agreement_data.property_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fee {fee_id} does not belong to the specified property"
            )

        # Check if fee is pending
        if fee.status != FeeStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fee {fee_id} is not pending (status: {fee.status})"
            )

        fees.append(fee)
        total_debt += fee.amount

    # Validate total debt
    if total_debt <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total debt must be greater than 0"
        )

    # Validate installments count
    if agreement_data.installments_count > 60:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of installments is 60"
        )

    # Validate monthly amount and installments
    if agreement_data.monthly_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Monthly amount must be greater than 0"
        )

    if agreement_data.installments_count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Installments count must be greater than 0"
        )

    # Admins can create agreements on behalf of the property owner
    if current_user.role == UserRole.ADMIN:
        agreement_owner = await primary_user_for_property(prop) or current_user
    else:
        agreement_owner = current_user

    agreement, installments = await create_agreement_with_installments(
        prop, fees, agreement_data, agreement_owner
    )

    await agreement.fetch_link(Agreement.property)
    await agreement.fetch_link(Agreement.user)
    await agreement.fetch_link(Agreement.fees)

    return await build_agreement_response(agreement, installments)

@router.put("/{agreement_id}", response_model=AgreementResponse)
async def update_agreement(
    agreement_id: str,
    agreement_update: AgreementUpdate,
    current_user: User = Depends(get_current_user)
):
    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Check permissions
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update agreements"
        )

    # Update fields
    update_data = agreement_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "installments_count" and value != agreement.installments_count:
            # Recalculate end date if installments count changed
            agreement.end_date = agreement.start_date + relativedelta(months=value)
        setattr(agreement, field, value)

    agreement.updated_at = datetime.utcnow()
    await agreement.save()

    # Fetch links for response
    await agreement.fetch_link(Agreement.property)
    await agreement.fetch_link(Agreement.user)
    await agreement.fetch_link(Agreement.fees)

    return await build_agreement_response(agreement)

@router.delete("/{agreement_id}")
async def delete_agreement(agreement_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete agreements"
        )

    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Fetch fees links
    await agreement.fetch_link(Agreement.fees)

    # Revert fee statuses back to PENDING
    for fee in agreement.fees:
        fee.status = FeeStatus.PENDING
        await fee.save()

    # Delete installments
    await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement.id
    ).delete()

    # Delete agreement
    await agreement.delete()

    return {"message": "Agreement deleted successfully"}

@router.get("/{agreement_id}/download-pdf")
async def download_agreement_pdf(agreement_id: str, current_user: User = Depends(get_current_user)):
    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Fetch user link for permissions check
    await agreement.fetch_link(Agreement.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(agreement.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    if not agreement.pdf_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found for this agreement"
        )

    # Convert relative path to absolute path if needed
    file_path = agreement.pdf_file
    if not os.path.isabs(file_path):
        file_path = os.path.join(os.getcwd(), file_path)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on disk"
        )

    filename = f"convenio_{agreement.agreement_number}.pdf"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )

@router.post("/{agreement_id}/installments/", response_model=AgreementInstallmentResponse)
async def create_installment_payment(
    agreement_id: str,
    installment_data: AgreementInstallmentCreate,
    current_user: User = Depends(get_current_user)
):
    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Fetch user link for permissions check
    await agreement.fetch_link(Agreement.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(agreement.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Create installment payment
    installment = AgreementInstallment(
        agreement=agreement,
        installment_number=installment_data.installment_number,
        amount=installment_data.amount,
        due_date=installment_data.due_date,
        notes=installment_data.notes
    )
    await installment.insert()

    # Fetch agreement link for response
    await installment.fetch_link(AgreementInstallment.agreement)

    return build_installment_response(installment)

@router.get("/installments/next-pending", response_model=Optional[dict])
async def get_next_pending_installment(current_user: User = Depends(get_current_user)):
    """
    Get the oldest pending installment for the current user across all their agreements.
    Returns the installment with agreement details for payment processing.
    """
    # Get all agreements for the current user
    if current_user.role == UserRole.ADMIN:
        agreements = await Agreement.find_all().to_list()
    else:
        agreements = await Agreement.find(Agreement.user.id == current_user.id).to_list()

    if not agreements:
        return None

    # Fetch installments for each agreement and find the oldest pending one
    oldest_pending = None
    oldest_due_date = None

    for agreement in agreements:
        # Fetch installments for this agreement
        installments = await AgreementInstallment.find(
            AgreementInstallment.agreement.id == agreement.id,
            AgreementInstallment.status == "pending"
        ).sort([("due_date", 1)]).to_list()  # Sort by due_date ascending (oldest first)

        if installments:
            # Get the oldest pending installment for this agreement
            for inst in installments:
                await inst.fetch_link(AgreementInstallment.agreement)

                if oldest_pending is None or inst.due_date < oldest_due_date:
                    oldest_pending = inst
                    oldest_due_date = inst.due_date

    if not oldest_pending:
        return None

    # Fetch agreement and property details
    await oldest_pending.agreement.fetch_link(Agreement.property)
    await oldest_pending.agreement.fetch_link(Agreement.user)

    return {
        "installment": build_installment_response(oldest_pending),
        "agreement": {
            "id": str(oldest_pending.agreement.id),
            "agreement_number": oldest_pending.agreement.agreement_number,
            "property_villa": oldest_pending.agreement.property.villa,
            "property_row_letter": oldest_pending.agreement.property.row_letter,
            "property_number": oldest_pending.agreement.property.number,
            "property_owner_name": oldest_pending.agreement.property.owner_name,
            "monthly_amount": oldest_pending.agreement.monthly_amount,
            "total_debt": oldest_pending.agreement.total_debt
        }
    }

@router.post("/installments/pay-next", response_model=dict)
async def pay_next_installment(
    amount: float = Form(...),
    payment_reference: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    """
    Pay the next pending installment for the current user.
    Automatically finds and pays the oldest pending installment.
    """
    # Get the next pending installment
    next_installment_data = await get_next_pending_installment(current_user)

    if not next_installment_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending installments found"
        )

    installment = next_installment_data["installment"]
    agreement_data = next_installment_data["agreement"]

    # Validate amount matches installment amount
    if abs(amount - installment.amount) > 0.01:  # Allow small floating point differences
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount must match installment amount of S/ {installment.amount}"
        )

    # Get the actual installment object
    installment_obj = await AgreementInstallment.get(installment.id)
    if not installment_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installment not found"
        )

    # Resolve the agreement before mutating the installment so a lookup
    # failure doesn't leave a paid installment behind.
    agreement = await Agreement.get(agreement_data["id"])
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )
    await agreement.fetch_link(Agreement.property)

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

    # Update installment
    installment_obj.status = AgreementInstallmentStatus.PAID
    installment_obj.paid_date = datetime.utcnow()
    installment_obj.payment_reference = payment_reference
    installment_obj.notes = notes
    await installment_obj.save()

    # Generate receipt for agreement installment payment (best effort)
    receipt_created = False
    try:
        logger.info("Creating receipt for agreement installment %s", installment_obj.id)

        from ..services.receipt_service import generate_correlative_number
        current_year = datetime.utcnow().year
        correlative_number = await generate_correlative_number(current_year, "CONV")

        # Create property and owner details snapshot
        property_details = {
            "villa": getattr(agreement.property, 'villa', 'N/A'),
            "row_letter": getattr(agreement.property, 'row_letter', 'N/A'),
            "number": getattr(agreement.property, 'number', 0),
            "owner_name": getattr(agreement.property, 'owner_name', 'Propietario no registrado'),
            "owner_phone": getattr(agreement.property, 'owner_phone', 'N/A') or "N/A"
        }
        owner_details = {
            "name": getattr(agreement.property, 'owner_name', 'Propietario no registrado'),
            "phone": getattr(agreement.property, 'owner_phone', 'N/A') or "N/A"
        }

        # Get treasurer data based on villa
        villa = agreement.property.villa if agreement.property else None
        treasurer = await Treasurer.find_one(Treasurer.villa == villa) if villa else None
        treasurer_details = {
            "name": treasurer.name if treasurer else "Tesorero no configurado",
            "signature": treasurer.signature if treasurer else None,
            "villa": treasurer.villa if treasurer else None
        }

        # Create receipt record
        from ..models.receipt import Receipt
        receipt = Receipt(
            correlative_number=correlative_number,
            issue_date=datetime.utcnow(),
            total_amount=installment_obj.amount,
            property_details=property_details,
            owner_details=owner_details,
            fee_period=f"Convenio {agreement.agreement_number} - Cuota {installment_obj.installment_number}",
            notes=f"Recibo generado automáticamente al pagar cuota de convenio",
            treasurer_details=treasurer_details
        )

        await receipt.insert()

        receipt_created = True
        logger.info("Receipt created in database with ID: %s", receipt.id)
    except Exception:
        logger.exception("Error creating receipt for agreement installment %s", installment_obj.id)

    # Update fee statuses based on agreement payments, regardless of whether
    # receipt generation succeeded.
    await agreement.fetch_link(Agreement.fees)
    total_paid_installments = await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement.id,
        AgreementInstallment.status == AgreementInstallmentStatus.PAID
    ).to_list()

    total_paid_amount = sum(inst.amount for inst in total_paid_installments)

    # Distribute the payment across the fees proportionally
    for fee in agreement.fees:
        # Calculate how much of this fee has been paid through the agreement
        fee_portion = (fee.amount / agreement.total_debt) * total_paid_amount
        fee.paid_amount = min(fee_portion, fee.amount)  # Don't exceed the fee amount

        # Update fee status
        if fee.paid_amount >= fee.amount:
            fee.status = FeeStatus.COMPLETED
        elif fee.paid_amount > 0:
            fee.status = FeeStatus.PARTIALLY_PAID
        else:
            fee.status = FeeStatus.AGREEMENT  # Keep as agreement if no payment yet

        await fee.save()

    # Check if all installments are paid to update agreement status
    all_installments = await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement.id
    ).to_list()

    if all_installments and all(
        inst.status == AgreementInstallmentStatus.PAID for inst in all_installments
    ):
        agreement.status = AgreementStatus.COMPLETED
        await agreement.save()

    return {
        "message": "Installment payment processed successfully",
        "installment": installment,
        "agreement": agreement_data,
        "receipt_file": receipt_file_path,
        "receipt_created": receipt_created
    }

@router.put("/{agreement_id}/installments/{installment_id}", response_model=AgreementInstallmentResponse)
async def update_installment_payment(
    agreement_id: str,
    installment_id: str,
    installment_update: AgreementInstallmentUpdate,
    current_user: User = Depends(get_current_user)
):
    agreement = await Agreement.get(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agreement not found"
        )

    # Fetch user link for permissions check
    await agreement.fetch_link(Agreement.user)

    installment = await AgreementInstallment.get(installment_id)
    if not installment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installment not found"
        )

    await installment.fetch_link(AgreementInstallment.agreement)

    if not installment.agreement or str(installment.agreement.id) != agreement_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installment not found"
        )

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        str(agreement.user.id) != str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Update fields
    update_data = installment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(installment, field, value)

    await installment.save()

    # Fetch agreement link for response
    await installment.fetch_link(AgreementInstallment.agreement)

    return build_installment_response(installment)
