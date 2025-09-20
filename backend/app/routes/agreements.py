from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime, timedelta
import os
from ..models.agreement import (
    Agreement, AgreementCreate, AgreementUpdate, AgreementResponse,
    AgreementInstallment, AgreementInstallmentCreate, AgreementInstallmentUpdate, AgreementInstallmentResponse,
    AgreementStatus, AgreementInstallmentStatus
)
from ..models.fee import Fee, FeeStatus
from ..models.property import Property
from ..models.user import User, UserRole
from ..routes.auth import get_current_user
from ..utils.pdf_generator import generate_agreement_pdf

router = APIRouter()

@router.get("/", response_model=List[AgreementResponse])
async def get_agreements(
    current_user: User = Depends(get_current_user),
    property_id: Optional[str] = None,
    status: Optional[str] = None
):
    # Build query filters
    query_filters = {}

    if current_user.role != UserRole.ADMIN:
        # Regular users can only see agreements for their properties
        query_filters["user.id"] = current_user.id

    if property_id:
        query_filters["property.id"] = property_id

    if status:
        query_filters["status"] = status

    # Get agreements
    if query_filters:
        agreements = await Agreement.find(query_filters).to_list()
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

        # Fetch installments
        installments = await AgreementInstallment.find(
            AgreementInstallment.agreement.id == agreement.id
        ).to_list()
    
        # Fetch agreement links for installments
        for inst in installments:
            await inst.fetch_link(AgreementInstallment.agreement)
    
        installment_responses = [
            AgreementInstallmentResponse(
                id=str(inst.id),
                agreement_id=str(inst.agreement.id),
                installment_number=inst.installment_number,
                amount=inst.amount,
                due_date=inst.due_date,
                paid_date=inst.paid_date,
                status=inst.status,
                payment_reference=inst.payment_reference,
                notes=inst.notes
            )
            for inst in installments
        ]

        responses.append(AgreementResponse(
            id=str(agreement.id),
            property_id=str(agreement.property.id),
            property_villa=agreement.property.villa,
            property_row_letter=agreement.property.row_letter,
            property_number=agreement.property.number,
            property_owner_name=agreement.property.owner_name,
            fee_ids=[str(fee.id) for fee in agreement.fees],
            user_id=str(agreement.user.id),
            total_debt=agreement.total_debt,
            monthly_amount=agreement.monthly_amount,
            installments_count=agreement.installments_count,
            start_date=agreement.start_date,
            end_date=agreement.end_date,
            status=agreement.status,
            agreement_number=agreement.agreement_number,
            pdf_file=agreement.pdf_file,
            notes=agreement.notes,
            created_at=agreement.created_at,
            updated_at=agreement.updated_at,
            installments=installment_responses
        ))

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

    # Fetch installments
    installments = await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement.id
    ).to_list()

    # Fetch agreement links for installments
    for inst in installments:
        await inst.fetch_link(AgreementInstallment.agreement)

    installment_responses = [
        AgreementInstallmentResponse(
            id=str(inst.id),
            agreement_id=str(inst.agreement.id),
            installment_number=inst.installment_number,
            amount=inst.amount,
            due_date=inst.due_date,
            paid_date=inst.paid_date,
            status=inst.status,
            payment_reference=inst.payment_reference,
            notes=inst.notes
        )
        for inst in installments
    ]

    return AgreementResponse(
        id=str(agreement.id),
        property_id=str(agreement.property.id),
        property_villa=agreement.property.villa,
        property_row_letter=agreement.property.row_letter,
        property_number=agreement.property.number,
        property_owner_name=agreement.property.owner_name,
        fee_ids=[str(fee.id) for fee in agreement.fees],
        user_id=str(agreement.user.id),
        total_debt=agreement.total_debt,
        monthly_amount=agreement.monthly_amount,
        installments_count=agreement.installments_count,
        start_date=agreement.start_date,
        end_date=agreement.end_date,
        status=agreement.status,
        agreement_number=agreement.agreement_number,
        pdf_file=agreement.pdf_file,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
        installments=installment_responses
    )

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
    if (current_user.role != UserRole.ADMIN and
        (not prop.owner or str(prop.owner.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get and validate fees
    fees = []
    total_debt = 0
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

    # Calculate end date
    end_date = agreement_data.start_date + timedelta(days=30 * agreement_data.installments_count)

    # Generate agreement number
    current_year = datetime.utcnow().year
    last_agreement = await Agreement.find(
        {"agreement_number": {"$regex": f"^AGR-{current_year}"}}
    ).sort([("agreement_number", -1)]).first_or_none()

    if last_agreement:
        parts = last_agreement.agreement_number.split("-")
        if len(parts) == 3:
            last_number = int(parts[2])
            new_number = last_number + 1
        else:
            new_number = 1
    else:
        new_number = 1

    agreement_number = f"AGR-{current_year}-{new_number:05d}"

    # Create agreement
    agreement = Agreement(
        property=prop,
        fees=fees,
        user=current_user,
        total_debt=total_debt,
        monthly_amount=agreement_data.monthly_amount,
        installments_count=agreement_data.installments_count,
        start_date=agreement_data.start_date,
        end_date=end_date,
        agreement_number=agreement_number,
        notes=agreement_data.notes
    )
    await agreement.insert()

    # Update fee statuses to AGREEMENT
    for fee in fees:
        fee.status = FeeStatus.AGREEMENT
        await fee.save()

    # Create installments
    installments = []
    for i in range(1, agreement_data.installments_count + 1):
        due_date = agreement_data.start_date + timedelta(days=30 * (i - 1))
        installment = AgreementInstallment(
            agreement=agreement,
            installment_number=i,
            amount=agreement_data.monthly_amount,
            due_date=due_date
        )
        await installment.insert()
        installments.append(installment)

    # Generate PDF
    try:
        pdf_buffer = generate_agreement_pdf(agreement, prop, fees, installments)
        pdf_filename = f"agreement_{agreement_number}.pdf"
        pdf_path = os.path.join("static", "uploads", pdf_filename)

        with open(pdf_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        agreement.pdf_file = pdf_path
        await agreement.save()
    except Exception as e:
        print(f"Error generating agreement PDF: {e}")
        # Don't fail the agreement creation if PDF generation fails

    # Fetch links for response
    await agreement.fetch_link(Agreement.property)
    await agreement.fetch_link(Agreement.user)
    await agreement.fetch_link(Agreement.fees)
    await agreement.fetch_link(Agreement.fees)

    # Fetch agreement links for installments
    for inst in installments:
        await inst.fetch_link(AgreementInstallment.agreement)

    installment_responses = [
        AgreementInstallmentResponse(
            id=str(inst.id),
            agreement_id=str(inst.agreement.id),
            installment_number=inst.installment_number,
            amount=inst.amount,
            due_date=inst.due_date,
            paid_date=inst.paid_date,
            status=inst.status,
            payment_reference=inst.payment_reference,
            notes=inst.notes
        )
        for inst in installments
    ]

    return AgreementResponse(
        id=str(agreement.id),
        property_id=str(agreement.property.id),
        property_villa=agreement.property.villa,
        property_row_letter=agreement.property.row_letter,
        property_number=agreement.property.number,
        property_owner_name=agreement.property.owner_name,
        fee_ids=[str(fee.id) for fee in agreement.fees],
        user_id=str(agreement.user.id),
        total_debt=agreement.total_debt,
        monthly_amount=agreement.monthly_amount,
        installments_count=agreement.installments_count,
        start_date=agreement.start_date,
        end_date=agreement.end_date,
        status=agreement.status,
        agreement_number=agreement.agreement_number,
        pdf_file=agreement.pdf_file,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
        installments=installment_responses
    )

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
            agreement.end_date = agreement.start_date + timedelta(days=30 * value)
        setattr(agreement, field, value)

    agreement.updated_at = datetime.utcnow()
    await agreement.save()

    # Fetch links for response
    await agreement.fetch_link(Agreement.property)
    await agreement.fetch_link(Agreement.user)

    # Fetch installments
    installments = await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement.id
    ).to_list()

    # Fetch agreement links for installments
    for inst in installments:
        await inst.fetch_link(AgreementInstallment.agreement)

    installment_responses = [
        AgreementInstallmentResponse(
            id=str(inst.id),
            agreement_id=str(inst.agreement.id),
            installment_number=inst.installment_number,
            amount=inst.amount,
            due_date=inst.due_date,
            paid_date=inst.paid_date,
            status=inst.status,
            payment_reference=inst.payment_reference,
            notes=inst.notes
        )
        for inst in installments
    ]

    return AgreementResponse(
        id=str(agreement.id),
        property_id=str(agreement.property.id),
        property_villa=agreement.property.villa,
        property_row_letter=agreement.property.row_letter,
        property_number=agreement.property.number,
        property_owner_name=agreement.property.owner_name,
        fee_ids=[str(fee.id) for fee in agreement.fees],
        user_id=str(agreement.user.id),
        total_debt=agreement.total_debt,
        monthly_amount=agreement.monthly_amount,
        installments_count=agreement.installments_count,
        start_date=agreement.start_date,
        end_date=agreement.end_date,
        status=agreement.status,
        agreement_number=agreement.agreement_number,
        pdf_file=agreement.pdf_file,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
        installments=installment_responses
    )

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

    return AgreementInstallmentResponse(
        id=str(installment.id),
        agreement_id=str(installment.agreement.id),
        installment_number=installment.installment_number,
        amount=installment.amount,
        due_date=installment.due_date,
        paid_date=installment.paid_date,
        status=installment.status,
        payment_reference=installment.payment_reference,
        notes=installment.notes
    )

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
        "installment": AgreementInstallmentResponse(
            id=str(oldest_pending.id),
            agreement_id=str(oldest_pending.agreement.id),
            installment_number=oldest_pending.installment_number,
            amount=oldest_pending.amount,
            due_date=oldest_pending.due_date,
            paid_date=oldest_pending.paid_date,
            status=oldest_pending.status,
            payment_reference=oldest_pending.payment_reference,
            notes=oldest_pending.notes
        ),
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

    # Update installment
    installment_obj.status = AgreementInstallmentStatus.PAID
    installment_obj.paid_date = datetime.utcnow()
    installment_obj.payment_reference = payment_reference
    installment_obj.notes = notes
    await installment_obj.save()

    # Generate receipt for agreement installment payment
    try:
        print(f"Creating receipt for agreement installment {installment_obj.id}")

        # Generate correlative number - agreement installments use CONV
        from .receipts import generate_correlative_number
        current_year = datetime.utcnow().year
        correlative_number = await generate_correlative_number(current_year, "CONV")

        # Get agreement and property details
        agreement = await Agreement.get(agreement_data["id"])
        await agreement.fetch_link(Agreement.property)

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

        # Create receipt record
        from ..models.receipt import Receipt
        receipt = Receipt(
            correlative_number=correlative_number,
            issue_date=datetime.utcnow(),
            total_amount=installment_obj.amount,
            property_details=property_details,
            owner_details=owner_details,
            fee_period=f"Convenio {agreement.agreement_number} - Cuota {installment_obj.installment_number}",
            notes=f"Recibo generado automáticamente al pagar cuota de convenio"
        )

        await receipt.insert()

        print(f"Receipt created in database with ID: {receipt.id}")
    except Exception as e:
        # Log the error but don't fail the payment
        print(f"Error creating receipt for agreement installment {installment_obj.id}: {e}")
        import traceback
        traceback.print_exc()

    # Check if all installments are paid to update agreement status
    if agreement:
        all_installments = await AgreementInstallment.find(
            AgreementInstallment.agreement.id == agreement.id
        ).to_list()

        if all(inst.status == AgreementInstallmentStatus.PAID for inst in all_installments):
            agreement.status = AgreementStatus.COMPLETED
            await agreement.save()

    return {
        "message": "Installment payment processed successfully",
        "installment": installment,
        "agreement": agreement_data,
        "receipt_file": receipt_file_path
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
    if not installment or str(installment.agreement.id) != agreement_id:
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

    return AgreementInstallmentResponse(
        id=str(installment.id),
        agreement_id=str(installment.agreement.id),
        installment_number=installment.installment_number,
        amount=installment.amount,
        due_date=installment.due_date,
        paid_date=installment.paid_date,
        status=installment.status,
        payment_reference=installment.payment_reference,
        notes=installment.notes
    )
