from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment
from ..models.property import Property
from ..models.user import User, UserRole
from ..models.expense import Expense
from ..routes.auth import get_current_user
from ..utils.pdf_generator import (
    generate_property_payment_history_pdf,
    generate_outstanding_fees_pdf,
    generate_monthly_payment_summary_pdf,
    generate_annual_property_statement_pdf
)
from ..utils.excel_generator import (
    generate_property_payment_history_excel,
    generate_outstanding_fees_excel,
    generate_monthly_payment_summary_excel,
    generate_monthly_fees_excel,
    generate_annual_property_statement_excel,
    generate_all_payments_excel,
    generate_filtered_fees_excel
)

router = APIRouter()

@router.get("/property/{property_id}/payment-history")
async def download_property_payment_history(
    property_id: str,
    year: Optional[int] = None,
    format: str = "pdf",
    current_user: User = Depends(get_current_user)
):
    """Generate PDF report of payment history for a specific property"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get property
    property_obj = await Property.get(property_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Get payments for this property through fee relationship
    payments = await Payment.find().to_list()

    # Filter payments by property through fee
    filtered_payments = []
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)
            if payment.fee.property and str(payment.fee.property.id) == property_id:
                filtered_payments.append(payment)

    payments = filtered_payments

    # Get outstanding fees for this property
    fees = await Fee.find(
        Fee.property.id == property_obj.id,
        Fee.status == FeeStatus.PENDING
    ).to_list()

    # Filter by year if specified
    if year:
        payments = [p for p in payments if p.payment_date.year == year]
        fees = [f for f in fees if f.year == year]

    # Prepare data
    property_data = {
        "villa": property_obj.villa,
        "row_letter": property_obj.row_letter,
        "number": property_obj.number,
        "owner_name": property_obj.owner_name,
        "owner_phone": property_obj.owner_phone
    }

    payments_data = [
        {
            "payment_date": payment.payment_date,
            "amount": payment.amount,
            "status": payment.status,
            "reference": payment.fee_id  # Use fee_id as reference
        }
        for payment in payments
    ]

    fees_data = [
        {
            "month": fee.month,
            "year": fee.year,
            "amount": fee.amount,
            "due_date": fee.due_date,
            "status": fee.status
        }
        for fee in fees
    ]

    # Generate report based on format
    if format.lower() == "excel":
        buffer = generate_property_payment_history_excel(property_data, payments_data, fees_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        buffer = generate_property_payment_history_pdf(property_data, payments_data, fees_data)
        media_type = "application/pdf"
        extension = "pdf"

    filename = f"historial_pagos_{property_obj.villa}_{property_obj.row_letter}{property_obj.number}_{year or datetime.now().year}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/outstanding-fees")
async def download_outstanding_fees_report(
    format: str = "pdf",
    current_user: User = Depends(get_current_user)
):
    """Generate PDF report of all outstanding fees"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get all outstanding fees
    fees = await Fee.find(Fee.status == FeeStatus.PENDING).to_list()

    # Fetch property details for each fee
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fees_data = [
        {
            "property_villa": fee.property.villa,
            "property_row_letter": fee.property.row_letter,
            "property_number": fee.property.number,
            "property_owner_name": fee.property.owner_name,
            "month": fee.month,
            "year": fee.year,
            "amount": fee.amount,
            "due_date": fee.due_date
        }
        for fee in fees if fee.property
    ]

    # Generate report based on format
    if format.lower() == "excel":
        buffer = generate_outstanding_fees_excel(fees_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        buffer = generate_outstanding_fees_pdf(fees_data)
        media_type = "application/pdf"
        extension = "pdf"

    filename = f"cuotas_pendientes_{datetime.now().strftime('%Y%m%d')}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/monthly-summary/{year}/{month}")
async def download_monthly_payment_summary(
    year: int,
    month: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user)
):
    """Generate PDF summary of payments for a specific month"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Validate month
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12"
        )

    # Get payments for the specified month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    payments = await Payment.find(
        Payment.payment_date >= start_date,
        Payment.payment_date < end_date
    ).to_list()

    # Fetch property details through fee
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)

    payments_data = [
        {
            "property_villa": payment.fee.property.villa,
            "property_row_letter": payment.fee.property.row_letter,
            "property_number": payment.fee.property.number,
            "property_owner_name": payment.fee.property.owner_name,
            "payment_date": payment.payment_date,
            "amount": payment.amount,
            "status": payment.status
        }
        for payment in payments if payment.fee and payment.fee.property
    ]

    # Generate report based on format
    if format.lower() == "excel":
        buffer = generate_monthly_payment_summary_excel(year, month, payments_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        buffer = generate_monthly_payment_summary_pdf(year, month, payments_data)
        media_type = "application/pdf"
        extension = "pdf"

    filename = f"resumen_mensual_{year}_{month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/monthly-fees/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_monthly_fees_report(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of monthly fees for a specific period range"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Validate months
    if start_month < 1 or start_month > 12 or end_month < 1 or end_month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Months must be between 1 and 12"
        )

    # Validate period range
    start_period = start_year * 12 + start_month
    end_period = end_year * 12 + end_month
    if start_period > end_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start period must be before or equal to end period"
        )

    # Get fees for the specified period range
    # Using a simpler approach to avoid complex query syntax issues
    fees = await Fee.find().to_list()

    # Filter fees by period range in Python
    filtered_fees = []
    for fee in fees:
        fee_period = fee.year * 12 + fee.month
        start_period_num = start_year * 12 + start_month
        end_period_num = end_year * 12 + end_month

        if start_period_num <= fee_period <= end_period_num:
            filtered_fees.append(fee)

    fees = filtered_fees

    # Fetch property details for each fee
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fees_data = [
        {
            "property_villa": fee.property.villa,
            "property_row_letter": fee.property.row_letter,
            "property_number": fee.property.number,
            "property_owner_name": fee.property.owner_name,
            "month": fee.month,
            "year": fee.year,
            "amount": fee.amount,
            "due_date": fee.due_date,
            "status": fee.status
        }
        for fee in fees if fee.property
    ]

    # Sort by property and then by period
    fees_data.sort(key=lambda x: (x['property_villa'], x['property_row_letter'], x['property_number'], x['year'], x['month']))

    # Generate Excel report
    buffer = generate_monthly_fees_excel(fees_data, start_year, start_month, end_year, end_month)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"cuotas_mensuales_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/property/{property_id}/annual-statement/{year}")
async def download_annual_property_statement(
    property_id: str,
    year: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user)
):
    """Generate annual statement for a property"""
    # Allow owners to see their own statements
    property_obj = await Property.get(property_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not property_obj.owner or str(property_obj.owner.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get fees for this property and year
    fees = await Fee.find(
        Fee.property.id == property_obj.id,
        Fee.year == year
    ).to_list()

    # Get payments for this property and year through fee relationship
    payments = await Payment.find(
        Payment.payment_date >= datetime(year, 1, 1),
        Payment.payment_date < datetime(year + 1, 1, 1)
    ).to_list()

    # Filter payments by property through fee
    filtered_payments = []
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)
            if payment.fee.property and str(payment.fee.property.id) == property_id:
                filtered_payments.append(payment)

    payments = filtered_payments

    # Prepare data
    property_data = {
        "villa": property_obj.villa,
        "row_letter": property_obj.row_letter,
        "number": property_obj.number,
        "owner_name": property_obj.owner_name,
        "owner_phone": property_obj.owner_phone
    }

    fees_data = [
        {
            "month": fee.month,
            "year": fee.year,
            "amount": fee.amount
        }
        for fee in fees
    ]

    payments_data = [
        {
            "payment_date": payment.payment_date,
            "amount": payment.amount
        }
        for payment in payments
    ]

    # Generate report based on format
    if format.lower() == "excel":
        buffer = generate_annual_property_statement_excel(property_data, year, fees_data, payments_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        buffer = generate_annual_property_statement_pdf(property_data, year, fees_data, payments_data)
        media_type = "application/pdf"
        extension = "pdf"

    filename = f"estado_anual_{property_obj.villa}_{property_obj.row_letter}{property_obj.number}_{year}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/all-payments")
async def download_all_payments_report(
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of all payments"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get all payments
    payments = await Payment.find_all().to_list()

    # Fetch property and fee details for each payment
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)

    payments_data = [
        {
            "payment_date": payment.payment_date,
            "property_villa": payment.fee.property.villa if payment.fee and payment.fee.property else "N/A",
            "property_row_letter": payment.fee.property.row_letter if payment.fee and payment.fee.property else "N/A",
            "property_number": payment.fee.property.number if payment.fee and payment.fee.property else 0,
            "property_owner_name": payment.fee.property.owner_name if payment.fee and payment.fee.property else "Propietario no registrado",
            "amount": payment.amount,
            "status": payment.status,
            "fee_reference": payment.fee.reference if payment.fee else "N/A",
            "notes": payment.notes
        }
        for payment in payments if payment.fee
    ]

    # Sort by payment date descending (newest first)
    payments_data.sort(key=lambda x: x['payment_date'], reverse=True)

    # Generate Excel report
    buffer = generate_all_payments_excel(payments_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"reporte_pagos_completo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/expenses")
async def download_expenses_report(
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of all administrative expenses"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get all expenses
    expenses = await Expense.find_all().to_list()

    # Fetch user details for each expense
    for expense in expenses:
        await expense.fetch_link(Expense.user)

    expenses_data = [
        {
            "expense_date": expense.expense_date,
            "expense_type": expense.expense_type,
            "beneficiary": expense.beneficiary,
            "beneficiary_details": expense.beneficiary_details,
            "amount": expense.amount,
            "status": expense.status,
            "description": expense.description,
            "notes": expense.notes,
            "created_by": expense.user.full_name if expense.user else "N/A"
        }
        for expense in expenses
    ]

    # Sort by expense date descending (newest first)
    expenses_data.sort(key=lambda x: x['expense_date'], reverse=True)

    # Generate Excel report
    buffer = generate_expenses_excel(expenses_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"reporte_gastos_administrativos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/filtered-fees")
async def download_filtered_fees_report(
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    property_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of fees based on applied filters"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Build query filters (same as in fees.py)
    query_filters = {}

    if current_user.role != UserRole.ADMIN:
        # Owners can only see their own fees
        query_filters["user.$id"] = PydanticObjectId(current_user.id)

    if year is not None:
        query_filters["year"] = year

    if month is not None:
        query_filters["month"] = month

    if status is not None and status.strip():
        # Support multiple statuses separated by comma
        status_list = [s.strip() for s in status.split(',')]
        if len(status_list) == 1:
            query_filters["status"] = status_list[0]
        else:
            query_filters["status"] = {"$in": status_list}

    if property_id is not None and property_id.strip():
        query_filters["property.$id"] = PydanticObjectId(property_id)

    # Get fees with filters
    fees = await Fee.find(query_filters).to_list()

    # Fetch property details for each fee
    for fee in fees:
        await fee.fetch_link(Fee.property)

    # Sort by period (same as in fees.py)
    fees_data = [
        {
            "property_villa": fee.property.villa,
            "property_row_letter": fee.property.row_letter,
            "property_number": fee.property.number,
            "property_owner_name": fee.property.owner_name,
            "amount": fee.amount,
            "paid_amount": fee.paid_amount,
            "remaining_amount": fee.amount - fee.paid_amount,
            "year": fee.year,
            "month": fee.month,
            "due_date": fee.due_date,
            "status": fee.status,
            "notes": fee.notes
        }
        for fee in fees if fee.property
    ]

    # Sort by year desc, month desc, property
    fees_data.sort(key=lambda x: (-x['year'], -x['month'], x['property_villa'], x['property_row_letter'], x['property_number']))

    # Generate Excel report
    buffer = generate_filtered_fees_excel(fees_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"cuotas_filtradas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )