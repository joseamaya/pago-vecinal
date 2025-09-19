from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from ..models.expense import (
    Expense, ExpenseCreate, ExpenseUpdate,
    ExpenseResponse, ExpenseStatus, ExpenseType
)
from ..models.receipt import Receipt
from ..models.user import User, UserRole
from ..routes.auth import get_current_user

class BulkApproveRequest(BaseModel):
    expense_ids: List[str]

router = APIRouter()

@router.get("/", response_model=List[ExpenseResponse])
async def get_expenses(current_user: User = Depends(get_current_user)):
    # Only admins can access expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access expenses"
        )

    expenses = await Expense.find_all().to_list()

    # Fetch links for each expense
    for expense in expenses:
        await expense.fetch_link(Expense.user)

    return [
        ExpenseResponse(
            id=str(expense.id),
            user_id=str(expense.user.id),
            expense_type=expense.expense_type,
            amount=expense.amount,
            expense_date=expense.expense_date,
            receipt_file=expense.receipt_file,
            generated_receipt_file=expense.generated_receipt_file,
            status=expense.status,
            description=expense.description,
            notes=expense.notes,
            beneficiary=expense.beneficiary,
            beneficiary_details=expense.beneficiary_details,
            created_at=expense.id.generation_time if hasattr(expense.id, 'generation_time') else datetime.utcnow()
        )
        for expense in expenses
    ]

@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    # Only admins can access expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access expenses"
        )

    expense = await Expense.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    # Fetch linked documents
    await expense.fetch_link(Expense.user)

    return ExpenseResponse(
        id=str(expense.id),
        user_id=str(expense.user.id),
        expense_type=expense.expense_type,
        amount=expense.amount,
        expense_date=expense.expense_date,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
        status=expense.status,
        description=expense.description,
        notes=expense.notes,
        beneficiary=expense.beneficiary,
        beneficiary_details=expense.beneficiary_details,
        created_at=expense.id.generation_time if hasattr(expense.id, 'generation_time') else datetime.utcnow()
    )

@router.post("/", response_model=ExpenseResponse)
async def create_expense(
    expense_type: ExpenseType = Form(...),
    amount: float = Form(...),
    expense_date: datetime = Form(...),
    description: str = Form(...),
    notes: Optional[str] = Form(None),
    beneficiary: str = Form(...),
    beneficiary_details: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    # Only admins can create expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create expenses"
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

    expense = Expense(
        user=current_user,
        expense_type=expense_type,
        amount=amount,
        expense_date=expense_date,
        receipt_file=receipt_file_path,
        description=description,
        notes=notes,
        beneficiary=beneficiary,
        beneficiary_details=beneficiary_details
    )
    await expense.insert()

    # Fetch linked documents for the response
    await expense.fetch_link(Expense.user)

    return ExpenseResponse(
        id=str(expense.id),
        user_id=str(expense.user.id),
        expense_type=expense.expense_type,
        amount=expense.amount,
        expense_date=expense.expense_date,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
        status=expense.status,
        description=expense.description,
        notes=expense.notes,
        beneficiary=expense.beneficiary,
        beneficiary_details=expense.beneficiary_details,
        created_at=expense.id.generation_time if hasattr(expense.id, 'generation_time') else datetime.utcnow()
    )

@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    amount: Optional[float] = Form(None),
    expense_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    beneficiary: Optional[str] = Form(None),
    beneficiary_details: Optional[str] = Form(None),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    # Only admins can update expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update expenses"
        )

    expense = await Expense.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    # Fetch linked documents
    await expense.fetch_link(Expense.user)

    # Handle file upload
    if receipt_file:
        # Create unique filename
        file_extension = os.path.splitext(receipt_file.filename)[1]
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}{file_extension}"
        file_path = os.path.join("static", "uploads", unique_filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)

        expense.receipt_file = file_path

    # Update fields
    if amount is not None:
        expense.amount = amount
    if expense_type is not None:
        expense.expense_type = ExpenseType(expense_type)
    if description is not None:
        expense.description = description
    if status is not None:
        expense.status = ExpenseStatus(status)
    if notes is not None:
        expense.notes = notes
    if beneficiary is not None:
        expense.beneficiary = beneficiary
    if beneficiary_details is not None:
        expense.beneficiary_details = beneficiary_details

    # Create receipt in database if status changed to approved
    if status == "approved":
        try:
            print(f"Creating receipt for expense {expense_id}")

            # Generate correlative number
            current_year = datetime.utcnow().year
            last_receipt = await Receipt.find(
                {"correlative_number": {"$regex": f"^REC-{current_year}"}}
            ).sort([("correlative_number", -1)]).first_or_none()

            if last_receipt:
                parts = last_receipt.correlative_number.split("-")
                if len(parts) == 3:
                    last_number = int(parts[2])
                    new_number = last_number + 1
                else:
                    new_number = 1
            else:
                new_number = 1

            correlative_number = f"REC-{current_year}-{new_number:05d}"

            # Create receipt record
            receipt = Receipt(
                correlative_number=correlative_number,
                expense=expense,
                issue_date=datetime.utcnow(),
                total_amount=expense.amount,
                property_details=None,  # No property for admin expenses
                owner_details=None,  # No owner for admin expenses
                fee_period=f"Gasto administrativo: {expense.description}",
                notes=f"Recibo generado automáticamente al aprobar el gasto administrativo"
            )

            await receipt.insert()

            print(f"Receipt created in database with ID: {receipt.id}")
        except Exception as e:
            # Log the error but don't fail the expense update
            print(f"Error creating receipt for expense {expense_id}: {e}")
            import traceback
            traceback.print_exc()

    await expense.save()

    # Fetch links again after save
    await expense.fetch_link(Expense.user)

    response_data = ExpenseResponse(
        id=str(expense.id),
        user_id=str(expense.user.id),
        expense_type=expense.expense_type,
        amount=expense.amount,
        expense_date=expense.expense_date,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
        status=expense.status,
        description=expense.description,
        notes=expense.notes,
        beneficiary=expense.beneficiary,
        beneficiary_details=expense.beneficiary_details,
        created_at=expense.id.generation_time if hasattr(expense.id, 'generation_time') else datetime.utcnow()
    )
    print(f"Returning response with generated_receipt_file: {response_data.generated_receipt_file}")
    return response_data

@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    # Only admins can delete expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete expenses"
        )

    expense = await Expense.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    await expense.delete()
    return {"message": "Expense deleted successfully"}

@router.get("/{expense_id}/download-receipt")
async def download_expense_receipt(expense_id: str, current_user: User = Depends(get_current_user)):
    """Download the automatically generated receipt PDF for an expense"""
    # Only admins can download expense receipts
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access expense receipts"
        )

    expense = await Expense.get(expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    # Fetch linked documents
    await expense.fetch_link(Expense.user)

    # Check if receipt file exists
    if not expense.generated_receipt_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt file associated with this expense"
        )

    # Convert relative path to absolute path if needed
    file_path = expense.generated_receipt_file
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
    filename = f"recibo_gasto_administrativo_{expense_id}.pdf"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )

@router.post("/bulk-approve")
async def bulk_approve_expenses(
    request: BulkApproveRequest,
    current_user: User = Depends(get_current_user)
):
    # Only admins can bulk approve expenses
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can approve expenses"
        )

    expense_ids = request.expense_ids
    """Bulk approve multiple expenses"""
    if not expense_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No expense IDs provided"
        )

    approved_count = 0
    errors = []

    for expense_id in expense_ids:
        try:
            expense = await Expense.get(expense_id)
            if not expense:
                errors.append(f"Expense {expense_id} not found")
                continue

            # Check if expense is already approved
            if expense.status == ExpenseStatus.APPROVED:
                errors.append(f"Expense {expense_id} is already approved")
                continue

            # Fetch linked documents
            await expense.fetch_link(Expense.user)

            # Update expense status
            expense.status = ExpenseStatus.APPROVED
            await expense.save()

            # Generate receipt (similar to individual approval)
            try:
                print(f"Creating receipt for expense {expense_id}")

                # Generate correlative number
                current_year = datetime.utcnow().year
                last_receipt = await Receipt.find(
                    {"correlative_number": {"$regex": f"^REC-{current_year}"}}
                ).sort([("correlative_number", -1)]).first_or_none()

                if last_receipt:
                    parts = last_receipt.correlative_number.split("-")
                    if len(parts) == 3:
                        last_number = int(parts[2])
                        new_number = last_number + 1
                    else:
                        new_number = 1
                else:
                    new_number = 1

                correlative_number = f"REC-{current_year}-{new_number:05d}"

                # Create receipt record
                receipt = Receipt(
                    correlative_number=correlative_number,
                    expense=expense,
                    issue_date=datetime.utcnow(),
                    total_amount=expense.amount,
                    property_details=None,  # No property for admin expenses
                    owner_details=None,  # No owner for admin expenses
                    fee_period=f"Gasto administrativo: {expense.description}",
                    notes=f"Recibo generado automáticamente al aprobar el gasto administrativo (aprobación masiva)"
                )

                await receipt.insert()

                print(f"Receipt created in database with ID: {receipt.id}")
            except Exception as e:
                # Log the error but don't fail the bulk operation
                print(f"Error creating receipt for expense {expense_id}: {e}")
                import traceback
                traceback.print_exc()

            approved_count += 1

        except Exception as e:
            errors.append(f"Error processing expense {expense_id}: {str(e)}")

    return {
        "message": f"Successfully approved {approved_count} expenses",
        "approved_count": approved_count,
        "errors": errors
    }