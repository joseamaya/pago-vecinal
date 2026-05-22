from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment
from ..models.property import Property
from ..models.user import User, UserRole
from ..models.expense import Expense
from ..dependencies.auth import get_current_user, require_admin
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
    generate_filtered_fees_excel,
    generate_traffic_light_excel,
    generate_paid_fees_summary_excel,
    generate_payments_summary_excel,
    generate_fee_payment_matrix_excel,
    generate_fee_contribution_summary_excel, generate_expenses_excel, generate_expenses_by_period_range_excel,
    generate_detailed_expenses_excel
)

router = APIRouter()

@router.get("/property/{property_id}/payment-history")
async def download_property_payment_history(
    property_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "excel",
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

    # Filter by date range if specified
    if start_date and end_date:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        payments = [p for p in payments if start_dt <= p.payment_date <= end_dt]
        fees = [f for f in fees if start_dt.date() <= f.due_date <= end_dt.date()]
    elif start_date:
        start_dt = datetime.fromisoformat(start_date)
        payments = [p for p in payments if p.payment_date >= start_dt]
        fees = [f for f in fees if f.due_date >= start_dt.date()]
    elif end_date:
        end_dt = datetime.fromisoformat(end_date)
        payments = [p for p in payments if p.payment_date <= end_dt]
        fees = [f for f in fees if f.due_date <= end_dt.date()]

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

    date_suffix = ""
    if start_date and end_date:
        date_suffix = f"_{start_date.replace('-', '')}_a_{end_date.replace('-', '')}"
    elif start_date:
        date_suffix = f"_desde_{start_date.replace('-', '')}"
    elif end_date:
        date_suffix = f"_hasta_{end_date.replace('-', '')}"
    else:
        date_suffix = f"_{datetime.now().year}"

    filename = f"historial_pagos_{property_obj.villa}_{property_obj.row_letter}{property_obj.number}{date_suffix}.{extension}"
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

@router.get("/monthly-summary")
async def download_monthly_payment_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate PDF summary of payments for a specific month"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get payments for the specified date range
    if start_date and end_date:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    else:
        # Default to current month
        now = datetime.now()
        start_dt = datetime(now.year, now.month, 1)
        if now.month == 12:
            end_dt = datetime(now.year + 1, 1, 1)
        else:
            end_dt = datetime(now.year, now.month + 1, 1)

    payments = await Payment.find(
        Payment.payment_date >= start_dt,
        Payment.payment_date < end_dt
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
        buffer = generate_monthly_payment_summary_excel(start_dt, end_dt, payments_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        buffer = generate_monthly_payment_summary_pdf(year, month, payments_data)
        media_type = "application/pdf"
        extension = "pdf"

    date_suffix = ""
    if start_date and end_date:
        date_suffix = f"_{start_date.replace('-', '')}_a_{end_date.replace('-', '')}"
    else:
        now = datetime.now()
        date_suffix = f"_{now.year}_{now.month:02d}"

    filename = f"resumen_pagos{date_suffix}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/payments-summary")
async def download_payments_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of payments summary by month"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get payments for the date range
    if start_date and end_date:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    else:
        # Default to current month
        now = datetime.now()
        start_dt = datetime(now.year, now.month, 1)
        if now.month == 12:
            end_dt = datetime(now.year + 1, 1, 1)
        else:
            end_dt = datetime(now.year, now.month + 1, 1)

    payments = await Payment.find(
        Payment.payment_date >= start_dt,
        Payment.payment_date < end_dt
    ).to_list()

    # Group by year, month and amount
    monthly_summary = {}
    for payment in payments:
        year = payment.payment_date.year
        month = payment.payment_date.month
        amount = payment.amount
        key = (year, month, amount)
        if key not in monthly_summary:
            monthly_summary[key] = {'count': 0, 'total': 0}
        monthly_summary[key]['count'] += 1
        monthly_summary[key]['total'] += payment.amount

    # Prepare data for Excel
    summary_data = []
    for (year, month, amount), data in monthly_summary.items():
        summary_data.append({
            'year': year,
            'month': month,
            'amount': amount,
            'count': data['count'],
            'total': data['total']
        })

    # Sort by year, month
    summary_data.sort(key=lambda x: (x['year'], x['month']))

    # Generate Excel report
    buffer = generate_payments_summary_excel(start_dt, end_dt, summary_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    date_suffix = ""
    if start_date and end_date:
        date_suffix = f"_{start_date.replace('-', '')}_a_{end_date.replace('-', '')}"
    else:
        now = datetime.now()
        date_suffix = f"_{now.year}_{now.month:02d}"

    filename = f"resumen_pagos{date_suffix}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/fee-contribution-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_fee_contribution_summary(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of fee contribution summary by property"""
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

    # Get fees for the period range
    fees = await Fee.find().to_list()

    # Filter fees by period range in Python
    filtered_fees = []
    for fee in fees:
        fee_period = fee.year * 12 + fee.month
        start_period_num = start_year * 12 + start_month
        end_period_num = end_year * 12 + end_month

        if start_period_num <= fee_period <= end_period_num:
            filtered_fees.append(fee)

    # Fetch property details
    for fee in filtered_fees:
        await fee.fetch_link(Fee.property)

    # Group by property
    property_summary = {}
    for fee in filtered_fees:
        if fee.property:
            prop_key = f"{fee.property.row_letter}{fee.property.number}"
            if prop_key not in property_summary:
                property_summary[prop_key] = {
                    'row_letter': fee.property.row_letter,
                    'number': fee.property.number,
                    'paid_count': 0,
                    'unpaid_count': 0,
                    'total_paid_amount': 0,
                }

            if fee.status == FeeStatus.COMPLETED:
                property_summary[prop_key]['paid_count'] += 1
                property_summary[prop_key]['total_paid_amount'] += fee.paid_amount
            else:
                property_summary[prop_key]['unpaid_count'] += 1

    # Calculate total paid fees
    total_paid_fees = sum(data['paid_count'] for data in property_summary.values())

    # Prepare data for Excel
    contribution_data = []
    for prop, data in property_summary.items():
        contribution_percentage = (data['paid_count'] / total_paid_fees * 100) if total_paid_fees > 0 else 0
        contribution_data.append({
            'property': prop,
            'paid_count': data['paid_count'],
            'unpaid_count': data['unpaid_count'],
            'total_paid_amount': data['total_paid_amount'],
            'contribution_percentage': contribution_percentage,
        })

    # Sort by property
    contribution_data.sort(key=lambda x: (x['property'][0], int(x['property'][1:])))

    # Generate Excel report
    buffer = generate_fee_contribution_summary_excel(start_year, start_month, end_year, end_month, contribution_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"resumen_contribucion_cuotas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/fee-payment-matrix/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_fee_payment_matrix(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel matrix report of fee payments by property and month"""
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

    # Get fees for the period range
    fees = await Fee.find().to_list()

    # Filter fees by period range in Python
    filtered_fees = []
    for fee in fees:
        fee_period = fee.year * 12 + fee.month
        start_period_num = start_year * 12 + start_month
        end_period_num = end_year * 12 + end_month

        if start_period_num <= fee_period <= end_period_num:
            filtered_fees.append(fee)

    # Fetch property details
    for fee in filtered_fees:
        await fee.fetch_link(Fee.property)

    # Prepare matrix data
    matrix_data = []
    for fee in filtered_fees:
        if fee.property:
            property_str = f"{fee.property.row_letter}{fee.property.number}"
            matrix_data.append({
                'property': property_str,
                'row_letter': fee.property.row_letter,
                'number': fee.property.number,
                'year': fee.year,
                'month': fee.month,
                'paid_amount': fee.paid_amount
            })

    # Generate Excel report
    buffer = generate_fee_payment_matrix_excel(start_year, start_month, end_year, end_month, matrix_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"matriz_pagos_cuotas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/paid-fees-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_paid_fees_summary(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of paid fees summary by month for a period range"""
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

    # Get paid and partially paid fees for the period range
    # Fetch all fees and filter in Python
    all_fees = await Fee.find().to_list()
    
    # Filter by status (COMPLETED or PARTIALLY_PAID) and period range
    paid_fees = []
    for fee in all_fees:
        if fee.status in [FeeStatus.COMPLETED, FeeStatus.PARTIALLY_PAID]:
            # Also filter by period range
            fee_period = fee.year * 12 + fee.month
            start_period_num = start_year * 12 + start_month
            end_period_num = end_year * 12 + end_month
            
            if start_period_num <= fee_period <= end_period_num:
                paid_fees.append(fee)

    # Get expenses for the period range
    expenses = await Expense.find_all().to_list()

    # Group expenses by year, month
    expenses_by_period = {}
    for expense in expenses:
        if expense.year is not None and expense.month is not None:
            expense_period = expense.year * 12 + expense.month
            start_period_num = start_year * 12 + start_month
            end_period_num = end_year * 12 + end_month

            if start_period_num <= expense_period <= end_period_num:
                key = (expense.year, expense.month)
                if key not in expenses_by_period:
                    expenses_by_period[key] = 0
                expenses_by_period[key] += expense.amount

    # Group by year, month and amount
    # Use paid_amount to include partial payments
    # Track separately fully paid vs partially paid
    monthly_summary = {}
    for fee in paid_fees:
        key = (fee.year, fee.month, fee.amount)
        if key not in monthly_summary:
            monthly_summary[key] = {'count': 0, 'total': 0, 'fully_paid_count': 0, 'partially_paid_count': 0}
        
        if fee.status == FeeStatus.COMPLETED:
            monthly_summary[key]['fully_paid_count'] += 1
        else:
            monthly_summary[key]['partially_paid_count'] += 1
            
        monthly_summary[key]['count'] += 1
        monthly_summary[key]['total'] += fee.paid_amount  # Use paid_amount instead of amount

    # Prepare data for Excel
    summary_data = []
    for (year, month, amount), data in monthly_summary.items():
        period_expenses = expenses_by_period.get((year, month), 0)
        net = data['total'] - period_expenses
        summary_data.append({
            'year': year,
            'month': month,
            'amount': amount,
            'count': data['count'],
            'total': data['total'],
            'fully_paid_count': data['fully_paid_count'],
            'partially_paid_count': data['partially_paid_count'],
            'expenses': period_expenses,
            'net': net
        })

    # Sort by year, month
    summary_data.sort(key=lambda x: (x['year'], x['month']))

    # Generate Excel report
    buffer = generate_paid_fees_summary_excel(start_year, start_month, end_year, end_month, summary_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"resumen_cuotas_pagadas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
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

    expenses_data = [
        {
            "expense_date": expense.expense_date,
            "description": expense.description,
            "amount": expense.amount,
            "year": expense.year,
            "month": expense.month
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

    # Only report fees up to the current date
    query_filters["due_date"] = {"$lte": datetime.now().date()}

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

@router.get("/traffic-light")
async def download_traffic_light_report(
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report with traffic light system for condominium fees"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get current date for comparison
    current_date = datetime.now().date()

    # Get all properties
    properties = await Property.find_all().to_list()

    traffic_light_data = []

    for property_obj in properties:
        # Get all pending fees for this property that are overdue
        overdue_fees = await Fee.find(
            Fee.property.id == property_obj.id,
            Fee.status == FeeStatus.PENDING,
            Fee.due_date < current_date
        ).to_list()

        overdue_count = len(overdue_fees)

        # Determine status based on overdue count
        if overdue_count >= 3:
            status = "ROJO"
        elif overdue_count == 2:
            status = "AMARILLO"
        else:
            status = "VERDE"

        # House identifier: row_letter + number
        house = f"{property_obj.row_letter}{property_obj.number}"

        traffic_light_data.append({
            "house": house,
            "status": status
        })

    buffer = generate_traffic_light_excel(traffic_light_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"reporte_semaforo_cuotas_{datetime.now().strftime('%Y%m%d')}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/expenses/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_expenses_by_period_range_report(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate Excel report of administrative expenses for a period range"""
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

    # Get all expenses and filter by period range in Python
    expenses = await Expense.find_all().to_list()

    # Filter expenses by period range
    filtered_expenses = []
    for expense in expenses:
        if expense.year is not None and expense.month is not None:
            expense_period = expense.year * 12 + expense.month
            if start_period <= expense_period <= end_period:
                filtered_expenses.append(expense)

    # Sort by year, month, expense_date
    filtered_expenses.sort(key=lambda x: (x.year or 0, x.month or 0, x.expense_date))

    expenses_data = [
        {
            "expense_date": expense.expense_date,
            "description": expense.description,
            "amount": expense.amount,
            "year": expense.year,
            "month": expense.month
        }
        for expense in filtered_expenses
    ]

    # Generate Excel report
    buffer = generate_expenses_by_period_range_excel(start_year, start_month, end_year, end_month, expenses_data)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"reporte_gastos_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/detailed-expenses/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_detailed_expenses_report(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
    format: str = "excel",
    current_user: User = Depends(get_current_user)
):
    """Generate detailed Excel report of administrative expenses by month for a period range"""
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

    # Get all expenses and filter by period range in Python
    expenses = await Expense.find_all().to_list()

    # Filter expenses by period range
    filtered_expenses = []
    for expense in expenses:
        if expense.year is not None and expense.month is not None:
            expense_period = expense.year * 12 + expense.month
            if start_period <= expense_period <= end_period:
                filtered_expenses.append(expense)

    # Sort expenses by year, month, date
    filtered_expenses.sort(key=lambda x: (x.year or 0, x.month or 0, x.expense_date))

    # Group expenses by year and month
    monthly_expenses = {}
    for expense in filtered_expenses:
        key = (expense.year, expense.month)
        if key not in monthly_expenses:
            monthly_expenses[key] = []
        monthly_expenses[key].append(expense)

    # Prepare data for Excel
    monthly_summary = []
    for (year, month), expenses_list in monthly_expenses.items():
        total_amount = sum(exp.amount for exp in expenses_list)
        monthly_summary.append({
            'year': year,
            'month': month,
            'total_amount': total_amount,
            'count': len(expenses_list),
            'expenses': expenses_list
        })

    # Sort monthly summary by year, month
    monthly_summary.sort(key=lambda x: (x['year'], x['month']))

    # Generate Excel report
    buffer = generate_detailed_expenses_excel(start_year, start_month, end_year, end_month, monthly_summary)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension = "xlsx"

    filename = f"reporte_gastos_detallado_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.{extension}"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )