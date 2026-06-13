from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Optional


MONTH_NAMES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


def validate_month_range(start_month: int, end_month: int):
    if start_month < 1 or start_month > 12 or end_month < 1 or end_month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los meses deben estar entre 1 y 12"
        )


def validate_period_range(start_year: int, start_month: int, end_year: int, end_month: int):
    validate_month_range(start_month, end_month)
    if start_year * 12 + start_month > end_year * 12 + end_month:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El período inicial debe ser anterior o igual al período final"
        )


def build_period_fee_filter(start_year: int, start_month: int, end_year: int, end_month: int) -> dict:
    if start_year == end_year:
        return {
            "year": start_year,
            "month": {"$gte": start_month, "$lte": end_month}
        }
    return {
        "$or": [
            {"year": start_year, "month": {"$gte": start_month}},
            {"year": {"$gt": start_year, "$lt": end_year}},
            {"year": end_year, "month": {"$lte": end_month}}
        ]
    }


def build_period_expense_filter(start_year: int, start_month: int, end_year: int, end_month: int) -> dict:
    if start_year == end_year:
        return {
            "year": start_year,
            "month": {"$gte": start_month, "$lte": end_month}
        }
    return {
        "$or": [
            {"year": start_year, "month": {"$gte": start_month}},
            {"year": {"$gt": start_year, "$lt": end_year}},
            {"year": end_year, "month": {"$lte": end_month}}
        ]
    }


def get_period_label(start_year: int, start_month: int, end_year: int, end_month: int) -> str:
    if start_year == end_year and start_month == end_month:
        return f"{MONTH_NAMES[start_month]} {start_year}"
    return f"{MONTH_NAMES[start_month]} {start_year} - {MONTH_NAMES[end_month]} {end_year}"


def get_date_suffix(start_date: Optional[str] = None, end_date: Optional[str] = None) -> str:
    if start_date and end_date:
        return f"_{start_date.replace('-', '')}_a_{end_date.replace('-', '')}"
    elif start_date:
        return f"_desde_{start_date.replace('-', '')}"
    elif end_date:
        return f"_hasta_{end_date.replace('-', '')}"
    return f"_{datetime.now().year}"


def get_excel_media_type() -> str:
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def get_pdf_media_type() -> str:
    return "application/pdf"


def streaming_response(buffer, filename: str, media_type: str) -> StreamingResponse:
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
