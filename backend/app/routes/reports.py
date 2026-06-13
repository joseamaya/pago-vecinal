from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
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
    generate_all_properties_payment_history_excel,
    generate_all_properties_annual_statement_excel,
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
    generate_fee_contribution_summary_excel,
    generate_expenses_excel,
    generate_expenses_by_period_range_excel,
    generate_detailed_expenses_excel
)
from ..utils.report_helpers import (
    validate_period_range,
    build_period_fee_filter,
    build_period_expense_filter,
    get_date_suffix,
    get_excel_media_type,
    get_pdf_media_type,
    streaming_response,
)

router = APIRouter()


@router.get("/payment-history")
async def download_property_payment_history(
    property_id: Optional[str] = None,
    start_year: Optional[int] = None,
    start_month: Optional[int] = None,
    end_year: Optional[int] = None,
    end_month: Optional[int] = None,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate report of payment history. If property_id is provided, filter by that property; otherwise include all properties."""
    fee_filter: dict = {}
    if start_year is not None and end_year is not None and start_month is not None and end_month is not None:
        validate_period_range(start_year, start_month, end_year, end_month)
        fee_filter.update(build_period_fee_filter(start_year, start_month, end_year, end_month))

    if property_id:
        property_obj = await Property.get(property_id)
        if not property_obj:
            raise HTTPException(status_code=404, detail="Property not found")
        fee_filter["property.$id"] = PydanticObjectId(property_id)

    fees = await Fee.find(fee_filter).to_list()

    # Batch-fetch property links
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fee_ids = [str(f.id) for f in fees]
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

    if property_id:
        # Single property — use existing single-property format
        property_obj = await Property.get(property_id)
        property_data = {
            "villa": property_obj.villa,
            "row_letter": property_obj.row_letter,
            "number": property_obj.number,
            "owner_name": property_obj.owner_name,
            "owner_phone": property_obj.owner_phone
        }
        prop_fees = [f for f in fees if f.property]
        pending_fees = [f for f in prop_fees if f.status == FeeStatus.PENDING]
        payments_data = [
            {"payment_date": p.payment_date, "amount": p.amount, "status": p.status, "reference": p.fee_id}
            for p in payments
        ]
        fees_data = [
            {"month": f.month, "year": f.year, "amount": f.amount, "due_date": f.due_date, "status": f.status}
            for f in pending_fees
        ]
        suffix = ""
        if start_year is not None:
            suffix = f"_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}"
        base = f"historial_pagos_{property_obj.villa}_{property_obj.row_letter}{property_obj.number}{suffix}"

        if format.lower() == "excel":
            buffer = generate_property_payment_history_excel(property_data, payments_data, fees_data)
            return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())
        buffer = generate_property_payment_history_pdf(property_data, payments_data, fees_data)
        return streaming_response(buffer, f"{base}.pdf", get_pdf_media_type())

    # All properties — flat format with property info in each row
    fee_map = {str(f.id): f for f in fees}
    all_payments_data = []
    for p in payments:
        fee = fee_map.get(p.fee_id)
        if not fee or not fee.property:
            continue
        all_payments_data.append({
            "villa": fee.property.villa,
            "row_letter": fee.property.row_letter,
            "number": fee.property.number,
            "owner_name": fee.property.owner_name,
            "payment_date": p.payment_date,
            "amount": p.amount,
            "status": p.status,
        })

    all_pending_fees_data = []
    for f in fees:
        if f.status == FeeStatus.PENDING and f.property:
            all_pending_fees_data.append({
                "villa": f.property.villa,
                "row_letter": f.property.row_letter,
                "number": f.property.number,
                "owner_name": f.property.owner_name,
                "month": f.month,
                "year": f.year,
                "amount": f.amount,
                "due_date": f.due_date,
                "status": f.status,
            })

    suffix = ""
    if start_year is not None:
        suffix = f"_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}"
    base = f"historial_pagos_todas{suffix}"

    buffer = generate_all_properties_payment_history_excel(all_payments_data, all_pending_fees_data)
    return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())


@router.get("/outstanding-fees")
async def download_outstanding_fees_report(
    format: str = "pdf",
    current_user: User = Depends(require_admin)
):
    """Generate report of all outstanding fees"""
    fees = await Fee.find(Fee.status == FeeStatus.PENDING).to_list()
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

    base = f"cuotas_pendientes_{datetime.now().strftime('%Y%m%d')}"

    if format.lower() == "excel":
        buffer = generate_outstanding_fees_excel(fees_data)
        return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())

    buffer = generate_outstanding_fees_pdf(fees_data)
    return streaming_response(buffer, f"{base}.pdf", get_pdf_media_type())


@router.get("/monthly-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_monthly_payment_summary(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate summary of payments for a fee period range"""
    validate_period_range(start_year, start_month, end_year, end_month)

    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    fee_ids = [str(f.id) for f in fees]

    for fee in fees:
        await fee.fetch_link(Fee.property)

    fee_map = {str(f.id): f for f in fees}
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

    payments_data = [
        {
            "property_villa": fee_map[p.fee_id].property.villa,
            "property_row_letter": fee_map[p.fee_id].property.row_letter,
            "property_number": fee_map[p.fee_id].property.number,
            "property_owner_name": fee_map[p.fee_id].property.owner_name,
            "payment_date": p.payment_date,
            "amount": p.amount,
            "status": p.status
        }
        for p in payments if p.fee_id in fee_map and fee_map[p.fee_id].property
    ]

    base = f"resumen_pagos_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}"

    if format.lower() == "excel":
        buffer = generate_monthly_payment_summary_excel(
            datetime(start_year, start_month, 1),
            datetime(end_year, end_month, 28),
            payments_data
        )
        return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())

    buffer = generate_monthly_payment_summary_pdf(start_year, start_month, payments_data)
    return streaming_response(buffer, f"{base}.pdf", get_pdf_media_type())


@router.get("/payments-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_payments_summary(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of payments summary by fee period"""
    validate_period_range(start_year, start_month, end_year, end_month)

    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    fee_ids = [str(f.id) for f in fees]
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

    monthly_summary = {}
    for payment in payments:
        key = (payment.payment_date.year, payment.payment_date.month, payment.amount)
        if key not in monthly_summary:
            monthly_summary[key] = {'count': 0, 'total': 0}
        monthly_summary[key]['count'] += 1
        monthly_summary[key]['total'] += payment.amount

    summary_data = sorted(
        [{'year': y, 'month': m, 'amount': a, 'count': d['count'], 'total': d['total']}
         for (y, m, a), d in monthly_summary.items()],
        key=lambda x: (x['year'], x['month'])
    )

    buffer = generate_payments_summary_excel(
        datetime(start_year, start_month, 1),
        datetime(end_year, end_month, 28),
        summary_data
    )
    return streaming_response(
        buffer,
        f"resumen_pagos_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/fee-contribution-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_fee_contribution_summary(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of fee contribution summary by property"""
    validate_period_range(start_year, start_month, end_year, end_month)

    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    property_summary = {}
    for fee in fees:
        if not fee.property:
            continue
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

    total_paid_fees = sum(d['paid_count'] for d in property_summary.values())
    contribution_data = [
        {
            'property': prop,
            'paid_count': d['paid_count'],
            'unpaid_count': d['unpaid_count'],
            'total_paid_amount': d['total_paid_amount'],
            'contribution_percentage': (d['paid_count'] / total_paid_fees * 100) if total_paid_fees > 0 else 0,
            'observation': '',
        }
        for prop, d in sorted(
            property_summary.items(),
            key=lambda x: (x[1]['row_letter'], x[1]['number'])
        )
    ]

    buffer = generate_fee_contribution_summary_excel(start_year, start_month, end_year, end_month, contribution_data)
    return streaming_response(
        buffer,
        f"resumen_contribucion_cuotas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/fee-payment-matrix/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_fee_payment_matrix(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel matrix report of fee payments by property and month"""
    validate_period_range(start_year, start_month, end_year, end_month)

    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    matrix_data = [
        {
            'property': f"{fee.property.row_letter}{fee.property.number}",
            'row_letter': fee.property.row_letter,
            'number': fee.property.number,
            'year': fee.year,
            'month': fee.month,
            'paid_amount': fee.paid_amount,
        }
        for fee in fees if fee.property
    ]

    buffer = generate_fee_payment_matrix_excel(start_year, start_month, end_year, end_month, matrix_data)
    return streaming_response(
        buffer,
        f"matriz_pagos_cuotas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/paid-fees-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_paid_fees_summary(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of paid fees summary by month for a period range"""
    validate_period_range(start_year, start_month, end_year, end_month)

    period_filter = build_period_fee_filter(start_year, start_month, end_year, end_month)
    period_filter["status"] = {"$in": [FeeStatus.COMPLETED, FeeStatus.PARTIALLY_PAID]}
    paid_fees = await Fee.find(period_filter).to_list()

    expenses = await Expense.find(
        build_period_expense_filter(start_year, start_month, end_year, end_month)
    ).to_list()

    expenses_by_period = {}
    for expense in expenses:
        if expense.year is not None and expense.month is not None:
            key = (expense.year, expense.month)
            expenses_by_period[key] = expenses_by_period.get(key, 0) + expense.amount

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
        monthly_summary[key]['total'] += fee.paid_amount

    summary_data = sorted(
        [
            {
                'year': y, 'month': m, 'amount': a,
                'count': d['count'], 'total': d['total'],
                'fully_paid_count': d['fully_paid_count'],
                'partially_paid_count': d['partially_paid_count'],
                'expenses': expenses_by_period.get((y, m), 0),
                'net': d['total'] - expenses_by_period.get((y, m), 0),
            }
            for (y, m, a), d in monthly_summary.items()
        ],
        key=lambda x: (x['year'], x['month'])
    )

    buffer = generate_paid_fees_summary_excel(start_year, start_month, end_year, end_month, summary_data)
    return streaming_response(
        buffer,
        f"resumen_cuotas_pagadas_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/monthly-fees/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_monthly_fees_report(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of monthly fees for a specific period range"""
    validate_period_range(start_year, start_month, end_year, end_month)

    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fees_data = sorted(
        [
            {
                "property_villa": f.property.villa,
                "property_row_letter": f.property.row_letter,
                "property_number": f.property.number,
                "property_owner_name": f.property.owner_name,
                "month": f.month,
                "year": f.year,
                "amount": f.amount,
                "due_date": f.due_date,
                "status": f.status,
            }
            for f in fees if f.property
        ],
        key=lambda x: (x['property_villa'], x['property_row_letter'], x['property_number'], x['year'], x['month'])
    )

    buffer = generate_monthly_fees_excel(fees_data, start_year, start_month, end_year, end_month)
    return streaming_response(
        buffer,
        f"cuotas_mensuales_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/annual-statement/{year}")
async def download_annual_property_statement(
    year: int,
    property_id: Optional[str] = None,
    format: str = "pdf",
    current_user: User = Depends(get_current_user)
):
    """Generate annual statement for a property (owners can see their own).
    If property_id is omitted (admin only), returns a consolidated Excel for all properties."""
    if not property_id:
        # All properties — admin only, returns Excel
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        all_props = await Property.find_all().to_list()
        # Batch: get all fees for the year, then payments by fee_id
        fees = await Fee.find(Fee.year == year).to_list()
        for fee in fees:
            await fee.fetch_link(Fee.property)

        fee_ids = [str(f.id) for f in fees]
        payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

        fee_map = {str(f.id): f for f in fees}
        payments_by_property = {}
        for p in payments:
            fee = fee_map.get(p.fee_id)
            if not fee or not fee.property:
                continue
            prop_key = str(fee.property.id)
            if prop_key not in payments_by_property:
                payments_by_property[prop_key] = []
            payments_by_property[prop_key].append(p)

        fees_by_property = {}
        for f in fees:
            if not f.property:
                continue
            prop_key = str(f.property.id)
            if prop_key not in fees_by_property:
                fees_by_property[prop_key] = []
            fees_by_property[prop_key].append(f)

        all_properties_data = []
        for prop in all_props:
            prop_key = str(prop.id)
            prop_fees = fees_by_property.get(prop_key, [])
            prop_payments = payments_by_property.get(prop_key, [])
            all_properties_data.append({
                "villa": prop.villa,
                "row_letter": prop.row_letter,
                "number": prop.number,
                "owner_name": prop.owner_name,
                "total_fees": sum(f.amount for f in prop_fees),
                "total_paid": sum(p.amount for p in prop_payments),
            })

        buffer = generate_all_properties_annual_statement_excel(year, all_properties_data)
        return streaming_response(
            buffer,
            f"estado_anual_consolidado_{year}.xlsx",
            get_excel_media_type()
        )

    # Single property
    property_obj = await Property.get(property_id)
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    if (current_user.role != UserRole.ADMIN and
        (not property_obj.owner or str(property_obj.owner.id) != str(current_user.id))):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    fees = await Fee.find(
        Fee.property.id == PydanticObjectId(property_id), Fee.year == year
    ).to_list()

    fee_ids = [str(f.id) for f in fees]
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

    property_data = {
        "villa": property_obj.villa,
        "row_letter": property_obj.row_letter,
        "number": property_obj.number,
        "owner_name": property_obj.owner_name,
        "owner_phone": property_obj.owner_phone
    }

    fees_data = [{"month": f.month, "year": f.year, "amount": f.amount} for f in fees]
    payments_data = [{"payment_date": p.payment_date, "amount": p.amount} for p in payments]

    base = f"estado_anual_{property_obj.villa}_{property_obj.row_letter}{property_obj.number}_{year}"

    if format.lower() == "excel":
        buffer = generate_annual_property_statement_excel(property_data, year, fees_data, payments_data)
        return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())

    buffer = generate_annual_property_statement_pdf(property_data, year, fees_data, payments_data)
    return streaming_response(buffer, f"{base}.pdf", get_pdf_media_type())


@router.get("/all-payments")
async def download_all_payments_report(
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of all payments"""
    payments = await Payment.find_all().to_list()
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)

    payments_data = sorted(
        [
            {
                "payment_date": p.payment_date,
                "property_villa": p.fee.property.villa if p.fee and p.fee.property else "N/A",
                "property_row_letter": p.fee.property.row_letter if p.fee and p.fee.property else "N/A",
                "property_number": p.fee.property.number if p.fee and p.fee.property else 0,
                "property_owner_name": p.fee.property.owner_name if p.fee and p.fee.property else "N/A",
                "amount": p.amount,
                "status": p.status,
                "fee_reference": p.fee.reference if p.fee else "N/A",
                "notes": p.notes,
            }
            for p in payments if p.fee
        ],
        key=lambda x: x['payment_date'], reverse=True
    )

    buffer = generate_all_payments_excel(payments_data)
    return streaming_response(
        buffer,
        f"reporte_pagos_completo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        get_excel_media_type()
    )


@router.get("/expenses")
async def download_expenses_report(
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of all administrative expenses"""
    expenses = await Expense.find_all().to_list()
    expenses_data = sorted(
        [
            {
                "expense_date": e.expense_date,
                "description": e.description,
                "amount": e.amount,
                "year": e.year,
                "month": e.month,
            }
            for e in expenses
        ],
        key=lambda x: x['expense_date'], reverse=True
    )

    buffer = generate_expenses_excel(expenses_data)
    return streaming_response(
        buffer,
        f"reporte_gastos_administrativos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        get_excel_media_type()
    )


@router.get("/filtered-fees")
async def download_filtered_fees_report(
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    property_id: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of fees based on applied filters"""
    query_filter = {"due_date": {"$lte": datetime.now().date()}}

    if year is not None:
        query_filter["year"] = year
    if month is not None:
        query_filter["month"] = month
    if status and status.strip():
        status_list = [s.strip() for s in status.split(',')]
        query_filter["status"] = status_list[0] if len(status_list) == 1 else {"$in": status_list}
    if property_id and property_id.strip():
        query_filter["property.$id"] = PydanticObjectId(property_id)

    fees = await Fee.find(query_filter).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fees_data = sorted(
        [
            {
                "property_villa": f.property.villa,
                "property_row_letter": f.property.row_letter,
                "property_number": f.property.number,
                "property_owner_name": f.property.owner_name,
                "amount": f.amount,
                "paid_amount": f.paid_amount,
                "remaining_amount": f.amount - f.paid_amount,
                "year": f.year,
                "month": f.month,
                "due_date": f.due_date,
                "status": f.status,
                "notes": f.notes,
            }
            for f in fees if f.property
        ],
        key=lambda x: (-x['year'], -x['month'], x['property_villa'], x['property_row_letter'], x['property_number'])
    )

    buffer = generate_filtered_fees_excel(fees_data)
    return streaming_response(
        buffer,
        f"cuotas_filtradas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        get_excel_media_type()
    )


@router.get("/traffic-light")
async def download_traffic_light_report(
    current_user: User = Depends(require_admin)
):
    """Generate Excel report with traffic light system for condominium fees"""
    current_date = datetime.now().date()
    properties = await Property.find_all().to_list()

    traffic_light_data = []
    for property_obj in properties:
        overdue = await Fee.find(
            Fee.property.id == property_obj.id,
            Fee.status == FeeStatus.PENDING,
            Fee.due_date < current_date
        ).to_list()

        overdue_count = len(overdue)
        if overdue_count >= 3:
            status = "ROJO"
        elif overdue_count == 2:
            status = "AMARILLO"
        else:
            status = "VERDE"

        traffic_light_data.append({
            "house": f"{property_obj.row_letter}{property_obj.number}",
            "status": status,
        })

    buffer = generate_traffic_light_excel(traffic_light_data)
    return streaming_response(
        buffer,
        f"reporte_semaforo_cuotas_{datetime.now().strftime('%Y%m%d')}.xlsx",
        get_excel_media_type()
    )


@router.get("/expenses/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_expenses_by_period_range_report(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of administrative expenses for a period range"""
    validate_period_range(start_year, start_month, end_year, end_month)

    expenses = await Expense.find(
        build_period_expense_filter(start_year, start_month, end_year, end_month)
    ).to_list()

    expenses_data = sorted(
        [
            {
                "expense_date": e.expense_date,
                "description": e.description,
                "amount": e.amount,
                "year": e.year,
                "month": e.month,
            }
            for e in expenses
        ],
        key=lambda x: (x['year'] or 0, x['month'] or 0, x['expense_date'])
    )

    buffer = generate_expenses_by_period_range_excel(start_year, start_month, end_year, end_month, expenses_data)
    return streaming_response(
        buffer,
        f"reporte_gastos_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )


@router.get("/detailed-expenses/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_detailed_expenses_report(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate detailed Excel report of administrative expenses by month"""
    validate_period_range(start_year, start_month, end_year, end_month)

    expenses = await Expense.find(
        build_period_expense_filter(start_year, start_month, end_year, end_month)
    ).to_list()

    expenses.sort(key=lambda x: (x.year or 0, x.month or 0, x.expense_date))

    monthly_expenses = {}
    for expense in expenses:
        key = (expense.year, expense.month)
        if key not in monthly_expenses:
            monthly_expenses[key] = []
        monthly_expenses[key].append(expense)

    monthly_summary = sorted(
        [
            {
                'year': y,
                'month': m,
                'total_amount': sum(e.amount for e in elist),
                'count': len(elist),
                'expenses': elist,
            }
            for (y, m), elist in monthly_expenses.items()
        ],
        key=lambda x: (x['year'], x['month'])
    )

    buffer = generate_detailed_expenses_excel(start_year, start_month, end_year, end_month, monthly_summary)
    return streaming_response(
        buffer,
        f"reporte_gastos_detallado_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )
