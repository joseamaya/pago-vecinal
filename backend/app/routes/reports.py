from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment
from ..models.property import Property
from ..models.user import User, UserRole
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
    generate_annual_property_statement_excel
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

    # Get payments for this property
    payments = await Payment.find(Payment.property.id == property_obj.id).to_list()
    for payment in payments:
        await payment.fetch_link(Payment.fee)

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
            "reference": payment.reference
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

    # Fetch property details
    for payment in payments:
        await payment.fetch_link(Payment.property)

    payments_data = [
        {
            "property_villa": payment.property.villa,
            "property_row_letter": payment.property.row_letter,
            "property_number": payment.property.number,
            "property_owner_name": payment.property.owner_name,
            "payment_date": payment.payment_date,
            "amount": payment.amount,
            "status": payment.status
        }
        for payment in payments if payment.property
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

    # Get payments for this property and year
    payments = await Payment.find(
        Payment.property.id == property_obj.id,
        Payment.payment_date >= datetime(year, 1, 1),
        Payment.payment_date < datetime(year + 1, 1, 1)
    ).to_list()

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