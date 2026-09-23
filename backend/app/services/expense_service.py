import logging
from datetime import datetime

from ..models.expense import Expense

logger = logging.getLogger(__name__)


async def bulk_import_expense_rows(ws):
    results = {
        "successful_imports": 0,
        "failed_imports": 0,
        "errors": []
    }

    for row_idx in range(2, ws.max_row + 1):
        try:
            expense_date_cell = ws.cell(row=row_idx, column=1).value
            description = str(ws.cell(row=row_idx, column=2).value or "").strip()
            amount = ws.cell(row=row_idx, column=3).value
            year = ws.cell(row=row_idx, column=4).value
            month = ws.cell(row=row_idx, column=5).value

            if not all([expense_date_cell is not None, description, amount is not None]):
                results["errors"].append({
                    "row": row_idx,
                    "error": "Missing required fields: Fecha de Gasto, Descripción, Monto"
                })
                results["failed_imports"] += 1
                continue

            try:
                amount = float(amount)
                if year is not None:
                    year = int(year)
                if month is not None:
                    month = int(month)

                if isinstance(expense_date_cell, datetime):
                    expense_date = expense_date_cell
                else:
                    expense_date = datetime.strptime(str(expense_date_cell), '%Y-%m-%d')

            except (ValueError, TypeError) as e:
                logger.debug("Invalid data types on row %s: %s", row_idx, e)
                results["errors"].append({"row": row_idx, "error": "Invalid data types in row"})
                results["failed_imports"] += 1
                continue

            if year is None:
                year = expense_date.year
            if month is None:
                month = expense_date.month

            if month < 1 or month > 12:
                results["errors"].append({"row": row_idx, "error": "Month must be between 1 and 12"})
                results["failed_imports"] += 1
                continue

            if amount <= 0:
                results["errors"].append({"row": row_idx, "error": "Amount must be greater than 0"})
                results["failed_imports"] += 1
                continue

            if expense_date > datetime.utcnow():
                results["errors"].append({"row": row_idx, "error": "Expense date cannot be in the future"})
                results["failed_imports"] += 1
                continue

            expense = Expense(
                expense_date=expense_date,
                description=description,
                amount=amount,
                year=year,
                month=month
            )
            await expense.insert()

            results["successful_imports"] += 1

        except Exception:
            logger.exception("Unexpected error importing expense on row %s", row_idx)
            results["errors"].append({"row": row_idx, "error": "Unexpected error processing row"})
            results["failed_imports"] += 1
            continue

    return results
