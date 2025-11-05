from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from ..models.expense import (
    Expense, ExpenseCreate, ExpenseUpdate,
    ExpenseResponse, ExpenseType
)
from ..models.receipt import Receipt
from ..models.user import User, UserRole
from ..routes.auth import get_current_user


class BulkImportResponse(BaseModel):
    successful_imports: int
    failed_imports: int
    errors: List[dict]

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
            year=expense.year,
            month=expense.month,
            receipt_file=expense.receipt_file,
            generated_receipt_file=expense.generated_receipt_file,
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
        year=expense.year,
        month=expense.month,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
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
    year: int = Form(...),
    month: int = Form(...),
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
        year=year,
        month=month,
        receipt_file=receipt_file_path,
        description=description,
        notes=notes,
        beneficiary=beneficiary,
        beneficiary_details=beneficiary_details
    )
    await expense.insert()

    # Expenses should not generate receipts as they are outgoing payments
    # We receive vouchers from suppliers, we don't issue receipts for expenses
    pass

    # Fetch linked documents for the response
    await expense.fetch_link(Expense.user)

    return ExpenseResponse(
        id=str(expense.id),
        user_id=str(expense.user.id),
        expense_type=expense.expense_type,
        amount=expense.amount,
        expense_date=expense.expense_date,
        year=expense.year,
        month=expense.month,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
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
    year: Optional[int] = Form(None),
    month: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
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
    if year is not None:
        expense.year = year
    if month is not None:
        expense.month = month
    if description is not None:
        expense.description = description
    if notes is not None:
        expense.notes = notes
    if beneficiary is not None:
        expense.beneficiary = beneficiary
    if beneficiary_details is not None:
        expense.beneficiary_details = beneficiary_details

    await expense.save()

    # Fetch links again after save
    await expense.fetch_link(Expense.user)

    response_data = ExpenseResponse(
        id=str(expense.id),
        user_id=str(expense.user.id),
        expense_type=expense.expense_type,
        amount=expense.amount,
        expense_date=expense.expense_date,
        year=expense.year,
        month=expense.month,
        receipt_file=expense.receipt_file,
        generated_receipt_file=expense.generated_receipt_file,
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

# Expenses don't generate receipts - they receive vouchers from suppliers
# This endpoint is no longer needed


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_expenses(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Bulk import expenses from Excel file"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can bulk import expenses"
        )

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )

    try:
        # Load workbook
        wb = load_workbook(file.file)
        ws = wb.active

        # Expected columns: Tipo de Gasto, Monto, Fecha de Gasto, Año, Mes, Beneficiario, Descripción, Detalles del Beneficiario, Notas
        expected_headers = ['Tipo de Gasto', 'Monto', 'Fecha de Gasto', 'Año', 'Mes', 'Beneficiario', 'Descripción', 'Detalles del Beneficiario', 'Notas']

        # Check headers
        actual_headers = []
        for col in range(1, 10):
            cell_value = ws.cell(row=1, column=col).value
            if cell_value:
                actual_headers.append(str(cell_value).strip())
            else:
                actual_headers.append("")

        if actual_headers[:7] != expected_headers[:7]:  # Required fields up to Descripción
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Excel format. Expected headers: {', '.join(expected_headers[:7])}"
            )

        results = {
            "successful_imports": 0,
            "failed_imports": 0,
            "errors": []
        }

        # Process each row starting from row 2
        for row_idx in range(2, ws.max_row + 1):
            try:
                # Extract data
                expense_type_str = str(ws.cell(row=row_idx, column=1).value or "").strip()
                amount = ws.cell(row=row_idx, column=2).value
                expense_date_cell = ws.cell(row=row_idx, column=3).value
                year = ws.cell(row=row_idx, column=4).value
                month = ws.cell(row=row_idx, column=5).value
                beneficiary = str(ws.cell(row=row_idx, column=6).value or "").strip()
                description = str(ws.cell(row=row_idx, column=7).value or "").strip()
                beneficiary_details = str(ws.cell(row=row_idx, column=8).value or "").strip()
                notes = str(ws.cell(row=row_idx, column=9).value or "").strip()

                # Validate required fields
                if not all([expense_type_str, amount is not None, expense_date_cell is not None, year is not None, month is not None, beneficiary, description]):
                    results["errors"].append({
                        "row": row_idx,
                        "error": "Missing required fields"
                    })
                    results["failed_imports"] += 1
                    continue

                # Validate expense type
                try:
                    expense_type = ExpenseType(expense_type_str.lower())
                except ValueError:
                    results["errors"].append({
                        "row": row_idx,
                        "error": f"Invalid expense type: {expense_type_str}. Must be one of: {', '.join([e.value for e in ExpenseType])}"
                    })
                    results["failed_imports"] += 1
                    continue

                # Convert types
                try:
                    amount = float(amount)
                    year = int(year)
                    month = int(month)

                    if isinstance(expense_date_cell, datetime):
                        expense_date = expense_date_cell
                    else:
                        expense_date = datetime.strptime(str(expense_date_cell), '%Y-%m-%d')

                except (ValueError, TypeError) as e:
                    results["errors"].append({
                        "row": row_idx,
                        "error": f"Invalid data types: {str(e)}"
                    })
                    results["failed_imports"] += 1
                    continue

                # Validate data ranges
                if month < 1 or month > 12:
                    results["errors"].append({
                        "row": row_idx,
                        "error": "Month must be between 1 and 12"
                    })
                    results["failed_imports"] += 1
                    continue

                if amount <= 0:
                    results["errors"].append({
                        "row": row_idx,
                        "error": "Amount must be greater than 0"
                    })
                    results["failed_imports"] += 1
                    continue

                if expense_date > datetime.utcnow():
                    results["errors"].append({
                        "row": row_idx,
                        "error": "Expense date cannot be in the future"
                    })
                    results["failed_imports"] += 1
                    continue

                # Create expense
                expense = Expense(
                    user=current_user,
                    expense_type=expense_type,
                    amount=amount,
                    expense_date=expense_date,
                    year=year,
                    month=month,
                    description=description,
                    notes=notes if notes else None,
                    beneficiary=beneficiary,
                    beneficiary_details=beneficiary_details if beneficiary_details else None
                )
                await expense.insert()

                # Expenses should not generate receipts as they are outgoing payments
                # We receive vouchers from suppliers, we don't issue receipts for expenses
                pass

                results["successful_imports"] += 1

            except Exception as e:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"Unexpected error: {str(e)}"
                })
                results["failed_imports"] += 1
                continue

        return BulkImportResponse(**results)

    except InvalidFileException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Excel file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )