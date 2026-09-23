from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime
from ..models.property import Property
from ..models.user import User, UserRole
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
    get_excel_media_type,
    get_pdf_media_type,
    streaming_response,
)
from ..services.report_service import (
    get_fees_and_payments,
    build_single_property_payment_history,
    build_all_properties_payment_history,
    get_outstanding_fees_data,
    get_monthly_payment_summary_data,
    get_payments_summary_data,
    get_fee_contribution_summary_data,
    get_fee_payment_matrix_data,
    get_paid_fees_summary_data,
    get_monthly_fees_data,
    get_all_properties_annual_statement_data,
    get_single_property_annual_statement_data,
    get_all_payments_data,
    get_all_expenses_data,
    get_filtered_fees_data,
    get_traffic_light_data,
    get_expenses_by_period_range_data,
    get_detailed_expenses_data,
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

    property_obj = None
    if property_id:
        property_obj = await Property.get(property_id)
        if not property_obj:
            raise HTTPException(status_code=404, detail="Property not found")
        fee_filter["property.$id"] = PydanticObjectId(property_id)

    fees, payments = await get_fees_and_payments(fee_filter)

    if property_id:
        # Single property — use existing single-property format
        property_data, payments_data, fees_data = build_single_property_payment_history(
            property_obj, fees, payments
        )
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
    all_payments_data, all_pending_fees_data = build_all_properties_payment_history(fees, payments)

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
    fees_data = await get_outstanding_fees_data()

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

    payments_data = await get_monthly_payment_summary_data(start_year, start_month, end_year, end_month)

    base = f"resumen_pagos_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}"

    if format.lower() == "excel":
        buffer = generate_monthly_payment_summary_excel(
            datetime(start_year, start_month, 1),
            datetime(end_year, end_month, 28),
            payments_data
        )
        return streaming_response(buffer, f"{base}.xlsx", get_excel_media_type())

    buffer = generate_monthly_payment_summary_pdf(start_year, start_month, end_year, end_month, payments_data)
    return streaming_response(buffer, f"{base}.pdf", get_pdf_media_type())


@router.get("/payments-summary/{start_year}/{start_month}/{end_year}/{end_month}")
async def download_payments_summary(
    start_year: int, start_month: int, end_year: int, end_month: int,
    format: str = "excel",
    current_user: User = Depends(require_admin)
):
    """Generate Excel report of payments summary by fee period"""
    validate_period_range(start_year, start_month, end_year, end_month)

    summary_data = await get_payments_summary_data(start_year, start_month, end_year, end_month)

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

    contribution_data = await get_fee_contribution_summary_data(start_year, start_month, end_year, end_month)

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

    matrix_data = await get_fee_payment_matrix_data(start_year, start_month, end_year, end_month)

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

    summary_data = await get_paid_fees_summary_data(start_year, start_month, end_year, end_month)

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

    fees_data = await get_monthly_fees_data(start_year, start_month, end_year, end_month)

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

        all_properties_data = await get_all_properties_annual_statement_data(year)

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

    await property_obj.fetch_link(Property.owner)

    if (current_user.role != UserRole.ADMIN and
        (not property_obj.owner or str(property_obj.owner.id) != str(current_user.id))):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    property_data, fees_data, payments_data = await get_single_property_annual_statement_data(
        property_obj, year
    )

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
    payments_data = await get_all_payments_data()

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
    expenses_data = await get_all_expenses_data()

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
    fees_data = await get_filtered_fees_data(year, month, status, property_id)

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
    traffic_light_data = await get_traffic_light_data()

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

    expenses_data = await get_expenses_by_period_range_data(start_year, start_month, end_year, end_month)

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

    monthly_summary = await get_detailed_expenses_data(start_year, start_month, end_year, end_month)

    buffer = generate_detailed_expenses_excel(start_year, start_month, end_year, end_month, monthly_summary)
    return streaming_response(
        buffer,
        f"reporte_gastos_detallado_{start_year}_{start_month:02d}_a_{end_year}_{end_month:02d}.xlsx",
        get_excel_media_type()
    )
