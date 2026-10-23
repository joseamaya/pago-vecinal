from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Dict, Any

from ..models.user import User, UserRole
from ..models.property import Property
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment, PaymentStatus
from ..models.expense import Expense
from ..models.receipt import Receipt
from ..dependencies.auth import get_current_user
from ..utils.links import link_id as _link_id, link_ref_id as _link_ref_id

router = APIRouter()

COLLECTED_STATUSES = (PaymentStatus.APPROVED, PaymentStatus.COMPLETED)
DEBT_STATUSES = (FeeStatus.PENDING, FeeStatus.PARTIALLY_PAID, FeeStatus.AGREEMENT)


def _month_start(reference: datetime, offset: int = 0) -> datetime:
    total = reference.year * 12 + (reference.month - 1) - offset
    year, month = divmod(total, 12)
    return datetime(year, month + 1, 1)


def _month_key(value: datetime) -> tuple:
    return value.year, value.month


def _fee_remaining(fee: Fee) -> float:
    return max(fee.amount - (fee.paid_amount or 0.0), 0.0)


async def _owner_properties(user: User):
    properties = await Property.find_all().to_list()
    user_id = str(user.id)
    return [prop for prop in properties if _link_id(prop.owner) == user_id]


async def _owner_fees(user: User):
    properties = await _owner_properties(user)
    property_ids = {str(prop.id) for prop in properties}
    fees = await Fee.find_all().to_list()
    return [fee for fee in fees if _link_id(fee.property) in property_ids]


async def _owner_payments(user: User):
    fees = await _owner_fees(user)
    fee_ids = {str(fee.id) for fee in fees}
    payments = await Payment.find_all().to_list()
    return [payment for payment in payments if payment.fee_id in fee_ids]


@router.get("/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Get dashboard statistics for the current user."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    next_month = _month_start(now, -1)

    if current_user.role == UserRole.ADMIN:
        properties = await Property.find_all().to_list()
        fees = await Fee.find_all().to_list()
        payments = await Payment.find_all().to_list()
        expenses = await Expense.find_all().to_list()
        receipts = await Receipt.find_all().to_list()
    else:
        properties = await _owner_properties(current_user)
        fees = await _owner_fees(current_user)
        payments = await _owner_payments(current_user)
        expenses = await Expense.find_all().to_list()
        receipts = []

    total_debt = sum(_fee_remaining(fee) for fee in fees if fee.status in DEBT_STATUSES)
    pending_fees = [fee for fee in fees if fee.status in DEBT_STATUSES]
    collected = sum(
        payment.amount
        for payment in payments
        if payment.status in COLLECTED_STATUSES
        and month_start <= payment.payment_date < next_month
    )
    expenses_month = sum(
        expense.amount
        for expense in expenses
        if month_start <= expense.expense_date < next_month
    )
    billed = sum(fee.amount for fee in fees)
    paid = sum(fee.paid_amount or 0.0 for fee in fees)

    return {
        "properties": len(properties),
        "fees": len(fees),
        "payments": len(payments),
        "receipts": len(receipts),
        "expenses": len(expenses),
        "total_debt": round(total_debt, 2),
        "pending_fees": len(pending_fees),
        "collected_this_month": round(collected, 2),
        "expenses_this_month": round(expenses_month, 2),
        "collection_rate": round((paid / billed) * 100, 1) if billed else 0.0,
        "period": {"month": now.month, "year": now.year},
    }


@router.get("/trends")
async def get_dashboard_trends(
    months: int = 6,
    current_user: User = Depends(get_current_user),
):
    """Monthly collected payments vs administrative expenses."""
    months = max(1, min(months, 24))
    now = datetime.utcnow()
    first_month = _month_start(now, months - 1)

    if current_user.role == UserRole.ADMIN:
        all_payments = await Payment.find_all().to_list()
    else:
        all_payments = await _owner_payments(current_user)

    payments = [
        payment
        for payment in all_payments
        if payment.status in COLLECTED_STATUSES and payment.payment_date >= first_month
    ]
    expenses = [
        expense
        for expense in await Expense.find_all().to_list()
        if expense.expense_date >= first_month
    ]

    buckets: Dict[tuple, Dict[str, Any]] = {}
    for offset in range(months - 1, -1, -1):
        start = _month_start(now, offset)
        key = (start.year, start.month)
        buckets[key] = {
            "year": start.year,
            "month": start.month,
            "collected": 0.0,
            "expenses": 0.0,
        }

    for payment in payments:
        bucket = buckets.get(_month_key(payment.payment_date))
        if bucket is not None:
            bucket["collected"] += payment.amount
    for expense in expenses:
        bucket = buckets.get(_month_key(expense.expense_date))
        if bucket is not None:
            bucket["expenses"] += expense.amount

    series = []
    for bucket in buckets.values():
        bucket["collected"] = round(bucket["collected"], 2)
        bucket["expenses"] = round(bucket["expenses"], 2)
        bucket["balance"] = round(bucket["collected"] - bucket["expenses"], 2)
        series.append(bucket)

    return {"months": months, "series": series}


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 8,
    current_user: User = Depends(get_current_user),
):
    """Latest payment movements relevant to the current user."""
    limit = max(1, min(limit, 20))
    if current_user.role == UserRole.ADMIN:
        payments = await Payment.find_all().to_list()
    else:
        payments = await _owner_payments(current_user)

    payments = [payment for payment in payments if payment.status in COLLECTED_STATUSES]
    payments.sort(key=lambda payment: payment.payment_date, reverse=True)
    payments = payments[:limit]

    activity = []
    for payment in payments:
        fee = await Fee.get(payment.fee_id)
        property_doc = await Property.get(_link_ref_id(fee.property)) if fee else None
        activity.append(
            {
                "id": str(payment.id),
                "type": "payment",
                "amount": payment.amount,
                "status": payment.status.value if hasattr(payment.status, "value") else payment.status,
                "date": payment.payment_date,
                "property": {
                    "villa": property_doc.villa,
                    "row_letter": property_doc.row_letter,
                    "number": property_doc.number,
                }
                if property_doc
                else None,
                "period": {"month": fee.month, "year": fee.year} if fee else None,
            }
        )

    return {"activity": activity}


@router.get("/owner/debt-summary")
async def get_owner_debt_summary(current_user: User = Depends(get_current_user)):
    """Get debt summary for owner."""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    properties = await _owner_properties(current_user)
    fees = await _owner_fees(current_user)

    debt_summary = []
    total_debt = 0
    for prop in properties:
        property_fees = [
            fee
            for fee in fees
            if _link_id(fee.property) == str(prop.id) and fee.status in DEBT_STATUSES
        ]
        property_debt = sum(_fee_remaining(fee) for fee in property_fees)
        total_debt += property_debt

        debt_summary.append(
            {
                "property": {
                    "id": str(prop.id),
                    "villa": prop.villa,
                    "row_letter": prop.row_letter,
                    "number": prop.number,
                    "owner_name": prop.owner_name,
                },
                "pending_fees": len(property_fees),
                "debt_amount": property_debt,
                "fees": [
                    {
                        "id": str(fee.id),
                        "amount": _fee_remaining(fee),
                        "due_date": fee.due_date,
                        "month": fee.month,
                        "year": fee.year,
                    }
                    for fee in property_fees
                ],
            }
        )

    return {"total_debt": total_debt, "properties": debt_summary}


@router.get("/owner/property-report")
async def get_owner_property_report(current_user: User = Depends(get_current_user)):
    """Get property report for owner."""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    properties = await _owner_properties(current_user)
    fees = await _owner_fees(current_user)
    payments = await _owner_payments(current_user)

    property_reports = []
    for prop in properties:
        property_fees = [fee for fee in fees if _link_id(fee.property) == str(prop.id)]
        fee_ids = {str(fee.id) for fee in property_fees}
        property_payments = [payment for payment in payments if payment.fee_id in fee_ids]

        total_fees = sum(fee.amount for fee in property_fees)
        total_payments = sum(payment.amount for payment in property_payments)
        pending_fees = [fee for fee in property_fees if fee.status in DEBT_STATUSES]
        pending_amount = sum(_fee_remaining(fee) for fee in pending_fees)

        property_reports.append(
            {
                "property": {
                    "id": str(prop.id),
                    "villa": prop.villa,
                    "row_letter": prop.row_letter,
                    "number": prop.number,
                    "owner_name": prop.owner_name,
                    "owner_phone": prop.owner_phone,
                },
                "fees_summary": {
                    "total_fees": len(property_fees),
                    "total_amount": total_fees,
                    "paid_amount": total_payments,
                    "pending_amount": pending_amount,
                    "pending_fees": len(pending_fees),
                },
                "payments": len(property_payments),
            }
        )

    return {"properties": property_reports}


@router.get("/owner/expenses-report")
async def get_owner_expenses_report(current_user: User = Depends(get_current_user)):
    """Get expenses report for owner (shows all community expenses)."""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    expenses = await Expense.find_all().to_list()

    expense_types = {}
    total_expenses = 0

    for expense in expenses:
        exp_type = expense.description
        if exp_type not in expense_types:
            expense_types[exp_type] = {
                "count": 0,
                "total_amount": 0,
                "expenses": [],
            }

        expense_types[exp_type]["count"] += 1
        expense_types[exp_type]["total_amount"] += expense.amount
        total_expenses += expense.amount

        expense_types[exp_type]["expenses"].append(
            {
                "id": str(expense.id),
                "amount": expense.amount,
                "expense_date": expense.expense_date,
                "description": expense.description,
            }
        )

    return {
        "total_expenses": total_expenses,
        "expense_types": expense_types,
    }
