from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime
from ..models.user import User, UserRole
from ..models.property import Property
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment
from ..models.agreement import Agreement
from ..models.expense import Expense
from ..routes.auth import get_current_user

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Get dashboard statistics for the current user"""
    if current_user.role == UserRole.ADMIN:
        # Admin stats
        properties = await Property.find_all().to_list()
        fees = await Fee.find_all().to_list()
        payments = await Payment.find_all().to_list()
        agreements = await Agreement.find_all().to_list()
        expenses = await Expense.find_all().to_list()

        return {
            "properties": len(properties),
            "fees": len(fees),
            "payments": len(payments),
            "agreements": len(agreements),
            "expenses": len(expenses),
        }
    else:
        # Owner stats
        properties = await Property.find(Property.owner.id == current_user.id).to_list()
        fees = await Fee.find(Fee.user.id == current_user.id).to_list()
        payments = await Payment.find(Payment.user.id == current_user.id).to_list()
        agreements = await Agreement.find(Agreement.user.id == current_user.id).to_list()

        # Calculate debt (pending fees)
        pending_fees = [fee for fee in fees if fee.status == FeeStatus.PENDING]
        total_debt = sum(fee.amount for fee in pending_fees)

        return {
            "properties": len(properties),
            "fees": len(fees),
            "payments": len(payments),
            "agreements": len(agreements),
            "total_debt": total_debt,
            "pending_fees": len(pending_fees),
        }

@router.get("/owner/debt-summary")
async def get_owner_debt_summary(current_user: User = Depends(get_current_user)):
    """Get debt summary for owner"""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    # Get owner's properties
    properties = await Property.find(Property.owner.id == current_user.id).to_list()

    debt_summary = []
    total_debt = 0

    for prop in properties:
        # Get pending fees for this property
        pending_fees = await Fee.find(
            Fee.property.id == prop.id,
            Fee.status == FeeStatus.PENDING
        ).to_list()

        property_debt = sum(fee.amount for fee in pending_fees)
        total_debt += property_debt

        debt_summary.append({
            "property": {
                "id": str(prop.id),
                "villa": prop.villa,
                "row_letter": prop.row_letter,
                "number": prop.number,
                "owner_name": prop.owner_name,
            },
            "pending_fees": len(pending_fees),
            "debt_amount": property_debt,
            "fees": [
                {
                    "id": str(fee.id),
                    "amount": fee.amount,
                    "due_date": fee.due_date,
                    "month": fee.month,
                    "year": fee.year,
                }
                for fee in pending_fees
            ]
        })

    return {
        "total_debt": total_debt,
        "properties": debt_summary,
    }

@router.get("/owner/property-report")
async def get_owner_property_report(current_user: User = Depends(get_current_user)):
    """Get property report for owner"""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    # Get owner's properties
    properties = await Property.find(Property.owner.id == current_user.id).to_list()

    property_reports = []

    for prop in properties:
        # Get all fees for this property
        fees = await Fee.find(Fee.property.id == prop.id).to_list()

        # Get payments for this property's fees
        fee_ids = [str(fee.id) for fee in fees]
        payments = await Payment.find(Payment.fee_id.in_(fee_ids)).to_list()

        # Get agreements for this property
        agreements = await Agreement.find(Agreement.property.id == prop.id).to_list()

        total_fees = sum(fee.amount for fee in fees)
        total_payments = sum(payment.amount for payment in payments)
        pending_fees = [fee for fee in fees if fee.status == FeeStatus.PENDING]
        pending_amount = sum(fee.amount for fee in pending_fees)

        property_reports.append({
            "property": {
                "id": str(prop.id),
                "villa": prop.villa,
                "row_letter": prop.row_letter,
                "number": prop.number,
                "owner_name": prop.owner_name,
                "owner_phone": prop.owner_phone,
            },
            "fees_summary": {
                "total_fees": len(fees),
                "total_amount": total_fees,
                "paid_amount": total_payments,
                "pending_amount": pending_amount,
                "pending_fees": len(pending_fees),
            },
            "agreements": len(agreements),
            "payments": len(payments),
        })

    return {
        "properties": property_reports,
    }

@router.get("/owner/expenses-report")
async def get_owner_expenses_report(current_user: User = Depends(get_current_user)):
    """Get expenses report for owner (shows all expenses, as they are community-wide)"""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed for admin")

    # For now, show all approved expenses (community expenses)
    expenses = await Expense.find(Expense.status == "approved").to_list()

    # Group by type
    expense_types = {}
    total_expenses = 0

    for expense in expenses:
        exp_type = expense.expense_type
        if exp_type not in expense_types:
            expense_types[exp_type] = {
                "count": 0,
                "total_amount": 0,
                "expenses": []
            }

        expense_types[exp_type]["count"] += 1
        expense_types[exp_type]["total_amount"] += expense.amount
        total_expenses += expense.amount

        expense_types[exp_type]["expenses"].append({
            "id": str(expense.id),
            "amount": expense.amount,
            "expense_date": expense.expense_date,
            "description": expense.description,
            "beneficiary": expense.beneficiary,
        })

    return {
        "total_expenses": total_expenses,
        "expense_types": expense_types,
    }