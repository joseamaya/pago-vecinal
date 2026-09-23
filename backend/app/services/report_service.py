from datetime import datetime

from beanie import PydanticObjectId

from ..models.expense import Expense
from ..models.fee import Fee, FeeStatus
from ..models.payment import Payment
from ..models.property import Property
from ..utils.report_helpers import build_period_fee_filter, build_period_expense_filter


async def get_fees_and_payments(fee_filter):
    fees = await Fee.find(fee_filter).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    fee_ids = [str(f.id) for f in fees]
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []
    return fees, payments


def build_single_property_payment_history(property_obj, fees, payments):
    property_data = {
        "villa": property_obj.villa,
        "row_letter": property_obj.row_letter,
        "number": property_obj.number,
        "owner_name": property_obj.owner_name,
        "owner_phone": property_obj.owner_phone
    }
    prop_fees = [f for f in fees if f.property]
    pending_fees = [f for f in prop_fees if f.status == FeeStatus.PENDING]
    fee_map = {str(f.id): f for f in fees}
    payments_data = [
        {
            "payment_date": p.payment_date,
            "amount": p.amount,
            "status": p.status,
            "reference": p.fee_id,
            "fee_month": fee_map[p.fee_id].month if p.fee_id in fee_map else None,
            "fee_year": fee_map[p.fee_id].year if p.fee_id in fee_map else None,
        }
        for p in payments
    ]
    fees_data = [
        {"month": f.month, "year": f.year, "amount": f.amount, "due_date": f.due_date, "status": f.status}
        for f in pending_fees
    ]
    return property_data, payments_data, fees_data


def build_all_properties_payment_history(fees, payments):
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
            "fee_month": fee.month,
            "fee_year": fee.year,
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

    return all_payments_data, all_pending_fees_data


async def get_outstanding_fees_data():
    fees = await Fee.find(Fee.status == FeeStatus.PENDING).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    return [
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


async def get_monthly_payment_summary_data(start_year, start_month, end_year, end_month):
    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    fee_ids = [str(f.id) for f in fees]

    for fee in fees:
        await fee.fetch_link(Fee.property)

    fee_map = {str(f.id): f for f in fees}
    payments = await Payment.find({"fee_id": {"$in": fee_ids}}).to_list() if fee_ids else []

    return [
        {
            "property_villa": fee_map[p.fee_id].property.villa,
            "property_row_letter": fee_map[p.fee_id].property.row_letter,
            "property_number": fee_map[p.fee_id].property.number,
            "property_owner_name": fee_map[p.fee_id].property.owner_name,
            "payment_date": p.payment_date,
            "amount": p.amount,
            "status": p.status,
            "fee_month": fee_map[p.fee_id].month,
            "fee_year": fee_map[p.fee_id].year,
        }
        for p in payments if p.fee_id in fee_map and fee_map[p.fee_id].property
    ]


async def get_payments_summary_data(start_year, start_month, end_year, end_month):
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

    return sorted(
        [{'year': y, 'month': m, 'amount': a, 'count': d['count'], 'total': d['total']}
         for (y, m, a), d in monthly_summary.items()],
        key=lambda x: (x['year'], x['month'])
    )


async def get_fee_contribution_summary_data(start_year, start_month, end_year, end_month):
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
    return [
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


async def get_fee_payment_matrix_data(start_year, start_month, end_year, end_month):
    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    return [
        {
            'property': f"{fee.property.row_letter}{fee.property.number}",
            'row_letter': fee.property.row_letter,
            'number': fee.property.number,
            'year': fee.year,
            'month': fee.month,
            'paid_amount': fee.paid_amount,
            'amount': fee.amount,
            'status': fee.status.value,
        }
        for fee in fees if fee.property
    ]


async def get_paid_fees_summary_data(start_year, start_month, end_year, end_month):
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

    return sorted(
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


async def get_monthly_fees_data(start_year, start_month, end_year, end_month):
    fees = await Fee.find(build_period_fee_filter(start_year, start_month, end_year, end_month)).to_list()
    for fee in fees:
        await fee.fetch_link(Fee.property)

    return sorted(
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


async def get_all_properties_annual_statement_data(year):
    all_props = await Property.find_all().to_list()
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

    return all_properties_data


async def get_single_property_annual_statement_data(property_obj, year):
    fees = await Fee.find(
        Fee.property.id == property_obj.id, Fee.year == year
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

    fee_map = {str(f.id): f for f in fees}
    fees_data = [{"month": f.month, "year": f.year, "amount": f.amount} for f in fees]
    payments_data = [
        {
            "payment_date": p.payment_date,
            "amount": p.amount,
            "fee_month": fee_map[p.fee_id].month if p.fee_id in fee_map else None,
            "fee_year": fee_map[p.fee_id].year if p.fee_id in fee_map else None,
        }
        for p in payments
    ]

    return property_data, fees_data, payments_data


async def get_all_payments_data():
    payments = await Payment.find_all().to_list()
    for payment in payments:
        await payment.fetch_link(Payment.fee)
        if payment.fee:
            await payment.fee.fetch_link(Fee.property)

    return sorted(
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
                "fee_month": p.fee.month if p.fee else None,
                "fee_year": p.fee.year if p.fee else None,
            }
            for p in payments if p.fee
        ],
        key=lambda x: x['payment_date'], reverse=True
    )


async def get_all_expenses_data():
    expenses = await Expense.find_all().to_list()
    return sorted(
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


async def get_filtered_fees_data(year, month, status, property_id):
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

    return sorted(
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


async def get_traffic_light_data():
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

    return traffic_light_data


async def get_expenses_by_period_range_data(start_year, start_month, end_year, end_month):
    expenses = await Expense.find(
        build_period_expense_filter(start_year, start_month, end_year, end_month)
    ).to_list()

    return sorted(
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


async def get_detailed_expenses_data(start_year, start_month, end_year, end_month):
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

    return sorted(
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
