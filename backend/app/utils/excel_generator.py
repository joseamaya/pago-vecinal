import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_property_payment_history_excel(property_data, payments_data, fees_data):
    """
    Generate an Excel report of payment history for a specific property
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Historial de Pagos"

    # Title
    ws['A1'] = "PAGO VECINAL - Historial de Pagos por Propiedad"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:G1')

    # Property information
    ws['A3'] = "Información de la Propiedad"
    ws['A3'].font = Font(size=12, bold=True)
    ws.merge_cells('A3:G3')

    property_info = [
        ["Villa:", property_data['villa']],
        ["Fila:", property_data['row_letter']],
        ["Número:", str(property_data['number'])],
        ["Propietario:", property_data['owner_name']],
        ["Teléfono:", property_data.get('owner_phone', 'N/A')]
    ]

    for i, (label, value) in enumerate(property_info, 5):
        ws[f'A{i}'] = label
        ws[f'B{i}'] = value
        ws[f'A{i}'].font = Font(bold=True)

    # Payments section
    row = 12
    if payments_data:
        ws[f'A{row}'] = "Pagos Realizados"
        ws[f'A{row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{row}:G{row}')

        headers = ["Fecha", "Monto", "Estado", "Referencia"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row+1, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for payment in payments_data:
            row += 1
            ws.cell(row=row, column=1).value = payment['payment_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=2).value = float(payment['amount'])
            ws.cell(row=row, column=2).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=3).value = payment['status']
            ws.cell(row=row, column=4).value = payment.get('reference', 'N/A')

        # Total payments
        row += 2
        total_payments = sum(p['amount'] for p in payments_data)
        ws[f'A{row}'] = "Total Pagado:"
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'B{row}'] = float(total_payments)
        ws[f'B{row}'].number_format = '"S/ "#,##0.00'
        ws[f'B{row}'].font = Font(bold=True)

    # Outstanding fees section
    if fees_data:
        row += 3
        ws[f'A{row}'] = "Cuotas Pendientes"
        ws[f'A{row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{row}:G{row}')

        headers = ["Período", "Monto", "Fecha Vencimiento", "Estado"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row+1, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")

        for fee in fees_data:
            row += 1
            ws.cell(row=row, column=1).value = f"{fee['month']}/{fee['year']}"
            ws.cell(row=row, column=2).value = float(fee['amount'])
            ws.cell(row=row, column=2).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=3).value = fee['due_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=4).value = fee['status']

        # Total outstanding
        row += 2
        total_outstanding = sum(f['amount'] for f in fees_data)
        ws[f'A{row}'] = "Total Pendiente:"
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'B{row}'] = float(total_outstanding)
        ws[f'B{row}'].number_format = '"S/ "#,##0.00'
        ws[f'B{row}'].font = Font(bold=True)

    # Footer
    row += 3
    ws[f'A{row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 15

    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_outstanding_fees_excel(fees_data):
    """
    Generate an Excel report of all outstanding fees
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Cuotas Pendientes"

    # Title
    ws['A1'] = "PAGO VECINAL - Cuotas Pendientes - Reporte General"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:F1')

    if fees_data:
        headers = ["Propiedad", "Propietario", "Período", "Monto", "Fecha Vencimiento"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, fee in enumerate(fees_data, 4):
            property_str = f"{fee['property_villa']} - {fee['property_row_letter']}{fee['property_number']}"
            ws.cell(row=row, column=1).value = property_str
            ws.cell(row=row, column=2).value = fee['property_owner_name']
            ws.cell(row=row, column=3).value = f"{fee['month']}/{fee['year']}"
            ws.cell(row=row, column=4).value = float(fee['amount'])
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = fee['due_date'].strftime("%d/%m/%Y")

        # Summary
        row = len(fees_data) + 6
        total_amount = sum(f['amount'] for f in fees_data)
        ws[f'A{row}'] = "Total Cuotas Pendientes:"
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'B{row}'] = len(fees_data)
        ws[f'B{row}'].font = Font(bold=True)

        ws[f'A{row+1}'] = "Monto Total Pendiente:"
        ws[f'A{row+1}'].font = Font(bold=True)
        ws[f'B{row+1}'] = float(total_amount)
        ws[f'B{row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{row+1}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay cuotas pendientes."

    # Footer
    footer_row = len(fees_data) + 9 if fees_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 7):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_monthly_payment_summary_excel(start_date, end_date, payments_data):
    """
    Generate an Excel summary of payments for a date range
    """
    wb = Workbook()
    ws = wb.active

    # Format dates for title
    if start_date and end_date:
        title_date = f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
        ws.title = f"Resumen {start_date.strftime('%m%Y')}-{end_date.strftime('%m%Y')}"
    elif start_date:
        title_date = f"Desde {start_date.strftime('%d/%m/%Y')}"
        ws.title = f"Resumen desde {start_date.strftime('%m%Y')}"
    elif end_date:
        title_date = f"Hasta {end_date.strftime('%d/%m/%Y')}"
        ws.title = f"Resumen hasta {end_date.strftime('%m%Y')}"
    else:
        title_date = "Período no especificado"
        ws.title = "Resumen Pagos"

    # Title
    ws['A1'] = f"PAGO VECINAL - Resumen de Pagos - {title_date}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:F1')

    if payments_data:
        headers = ["Propiedad", "Propietario", "Fecha Pago", "Monto", "Estado"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, payment in enumerate(payments_data, 4):
            property_str = f"{payment['property_villa']} - {payment['property_row_letter']}{payment['property_number']}"
            ws.cell(row=row, column=1).value = property_str
            ws.cell(row=row, column=2).value = payment['property_owner_name']
            ws.cell(row=row, column=3).value = payment['payment_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=4).value = float(payment['amount'])
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = payment['status']

        # Summary
        row = len(payments_data) + 6
        total_payments = len(payments_data)
        total_amount = sum(p['amount'] for p in payments_data)
        ws[f'A{row}'] = "Total Pagos:"
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'B{row}'] = total_payments
        ws[f'B{row}'].font = Font(bold=True)

        ws[f'A{row+1}'] = "Monto Total Recaudado:"
        ws[f'A{row+1}'].font = Font(bold=True)
        ws[f'B{row+1}'] = float(total_amount)
        ws[f'B{row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{row+1}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay pagos registrados para este período."

    # Footer
    footer_row = len(payments_data) + 9 if payments_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 7):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_expenses_excel(expenses_data):
    """
    Generate an Excel report of all administrative expenses
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Gastos Administrativos"

    # Title
    ws['A1'] = "PAGO VECINAL - Reporte de Gastos Administrativos"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:I1')

    if expenses_data:
        headers = ["Fecha Gasto", "Descripción", "Monto", "Año", "Mes"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, expense in enumerate(expenses_data, 4):
            ws.cell(row=row, column=1).value = expense['expense_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=2).value = expense['description']
            ws.cell(row=row, column=3).value = float(expense['amount'])
            ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=4).value = expense.get('year', 'N/A')
            ws.cell(row=row, column=5).value = expense.get('month', 'N/A')

        # Summary section
        summary_row = len(expenses_data) + 6
        ws[f'A{summary_row}'] = "Resumen del Reporte"
        ws[f'A{summary_row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{summary_row}:E{summary_row}')

        # Calculate total amount
        total_amount = sum(expense['amount'] for expense in expenses_data)

        # Total summary
        current_row = summary_row + 2
        ws[f'A{current_row}'] = "Total Gastos:"
        ws[f'A{current_row}'].font = Font(bold=True)
        ws[f'B{current_row}'] = len(expenses_data)
        ws[f'B{current_row}'].font = Font(bold=True)

        ws[f'A{current_row+1}'] = "Monto Total:"
        ws[f'A{current_row+1}'].font = Font(bold=True)
        ws[f'B{current_row+1}'] = float(total_amount)
        ws[f'B{current_row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+1}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay gastos administrativos registrados."

    # Footer
    footer_row = len(expenses_data) + 20 if expenses_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 6):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_all_payments_excel(payments_data):
    """
    Generate an Excel report of all payments
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Todos los Pagos"

    # Title
    ws['A1'] = "PAGO VECINAL - Reporte General de Pagos"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:H1')

    if payments_data:
        headers = ["Fecha Pago", "Propiedad", "Propietario", "Monto", "Estado", "Referencia", "Notas"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, payment in enumerate(payments_data, 4):
            property_str = f"{payment['property_villa']} - {payment['property_row_letter']}{payment['property_number']}"
            ws.cell(row=row, column=1).value = payment['payment_date'].strftime("%d/%m/%Y %H:%M")
            ws.cell(row=row, column=2).value = property_str
            ws.cell(row=row, column=3).value = payment['property_owner_name']
            ws.cell(row=row, column=4).value = float(payment['amount'])
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = payment['status']
            ws.cell(row=row, column=6).value = payment.get('fee_reference', 'N/A')
            ws.cell(row=row, column=7).value = payment.get('notes', '')

        # Summary
        summary_row = len(payments_data) + 6
        total_payments = len(payments_data)
        total_amount = sum(p['amount'] for p in payments_data)

        # Status breakdown
        status_counts = {}
        for payment in payments_data:
            status = payment['status']
            if status not in status_counts:
                status_counts[status] = 0
            status_counts[status] += 1

        ws[f'A{summary_row}'] = "Resumen General"
        ws[f'A{summary_row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{summary_row}:H{summary_row}')

        current_row = summary_row + 2
        ws[f'A{current_row}'] = "Total Pagos:"
        ws[f'A{current_row}'].font = Font(bold=True)
        ws[f'B{current_row}'] = total_payments
        ws[f'B{current_row}'].font = Font(bold=True)

        ws[f'A{current_row+1}'] = "Monto Total:"
        ws[f'A{current_row+1}'].font = Font(bold=True)
        ws[f'B{current_row+1}'] = float(total_amount)
        ws[f'B{current_row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+1}'].font = Font(bold=True)

        # Status breakdown
        current_row += 3
        for status, count in status_counts.items():
            ws[f'A{current_row}'] = f"Pagos {status.title()}:"
            ws[f'A{current_row}'].font = Font(bold=True)
            ws[f'B{current_row}'] = count
            current_row += 1
    else:
        ws['A3'] = "No hay pagos registrados."

    # Footer
    footer_row = len(payments_data) + 15 if payments_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 9):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_monthly_fees_excel(fees_data, start_year, start_month, end_year, end_month):
    """
    Generate an Excel report of monthly fees for a specific period range
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Cuotas Mensuales"

    # Title
    ws['A1'] = "PAGO VECINAL - Reporte de Cuotas Mensuales"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:F1')

    # Period information
    period_text = f"Período: {start_month:02d}/{start_year} - {end_month:02d}/{end_year}"
    ws['A3'] = period_text
    ws['A3'].font = Font(size=12, bold=True)
    ws.merge_cells('A3:F3')

    if fees_data:
        # Headers
        headers = ["Propiedad", "Propietario", "Período", "Monto", "Estado", "Fecha Vencimiento"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=5, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        # Data rows
        for row, fee in enumerate(fees_data, 6):
            property_str = f"{fee['property_villa']} - {fee['property_row_letter']}{fee['property_number']}"
            ws.cell(row=row, column=1).value = property_str
            ws.cell(row=row, column=2).value = fee['property_owner_name']
            ws.cell(row=row, column=3).value = f"{fee['month']:02d}/{fee['year']}"
            ws.cell(row=row, column=4).value = float(fee['amount'])
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = fee['status']
            ws.cell(row=row, column=6).value = fee['due_date'].strftime("%d/%m/%Y")

        # Summary section
        summary_row = len(fees_data) + 8
        ws[f'A{summary_row}'] = "Resumen del Reporte"
        ws[f'A{summary_row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{summary_row}:F{summary_row}')

        # Calculate totals by status
        status_counts = {}
        total_amount = 0
        for fee in fees_data:
            status = fee['status']
            if status not in status_counts:
                status_counts[status] = {'count': 0, 'amount': 0}
            status_counts[status]['count'] += 1
            status_counts[status]['amount'] += fee['amount']
            total_amount += fee['amount']

        # Display status summary
        current_row = summary_row + 2
        for status, data in status_counts.items():
            ws[f'A{current_row}'] = f"Cuotas {status.title()}:"
            ws[f'A{current_row}'].font = Font(bold=True)
            ws[f'B{current_row}'] = data['count']
            ws[f'C{current_row}'] = float(data['amount'])
            ws[f'C{current_row}'].number_format = '"S/ "#,##0.00'
            current_row += 1

        # Total summary
        ws[f'A{current_row}'] = "Total Cuotas:"
        ws[f'A{current_row}'].font = Font(bold=True)
        ws[f'B{current_row}'] = len(fees_data)
        ws[f'B{current_row}'].font = Font(bold=True)

        ws[f'A{current_row+1}'] = "Monto Total:"
        ws[f'A{current_row+1}'].font = Font(bold=True)
        ws[f'B{current_row+1}'] = float(total_amount)
        ws[f'B{current_row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+1}'].font = Font(bold=True)
    else:
        ws['A5'] = "No hay cuotas registradas para el período especificado."

    # Footer
    footer_row = len(fees_data) + 12 if fees_data else 7
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 7):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_filtered_fees_excel(fees_data):
    """
    Generate an Excel report of fees based on applied filters
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Cuotas Filtradas"

    # Title
    ws['A1'] = "PAGO VECINAL - Reporte de Cuotas Filtradas"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:J1')

    if fees_data:
        headers = ["Propiedad", "Propietario", "Monto Total", "Monto Pagado", "Monto Pendiente", "Año", "Mes", "Fecha Vencimiento", "Estado", "Notas"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, fee in enumerate(fees_data, 4):
            property_str = f"{fee['property_villa']} - {fee['property_row_letter']}{fee['property_number']}"
            ws.cell(row=row, column=1).value = property_str
            ws.cell(row=row, column=2).value = fee['property_owner_name']
            ws.cell(row=row, column=3).value = float(fee['amount'])
            ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=4).value = float(fee.get('paid_amount', 0))
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = float(fee.get('remaining_amount', fee['amount']))
            ws.cell(row=row, column=5).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=6).value = fee['year']
            ws.cell(row=row, column=7).value = fee['month']
            ws.cell(row=row, column=8).value = fee['due_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=9).value = fee['status']
            ws.cell(row=row, column=10).value = fee.get('notes', '')

        # Summary section
        summary_row = len(fees_data) + 6
        ws[f'A{summary_row}'] = "Resumen del Reporte"
        ws[f'A{summary_row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{summary_row}:J{summary_row}')

        # Calculate totals
        total_amount = sum(f['amount'] for f in fees_data)
        total_paid = sum(f.get('paid_amount', 0) for f in fees_data)
        total_remaining = sum(f.get('remaining_amount', f['amount']) for f in fees_data)

        current_row = summary_row + 2
        ws[f'A{current_row}'] = "Total Cuotas:"
        ws[f'A{current_row}'].font = Font(bold=True)
        ws[f'B{current_row}'] = len(fees_data)
        ws[f'B{current_row}'].font = Font(bold=True)

        ws[f'A{current_row+1}'] = "Monto Total:"
        ws[f'A{current_row+1}'].font = Font(bold=True)
        ws[f'B{current_row+1}'] = float(total_amount)
        ws[f'B{current_row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+1}'].font = Font(bold=True)

        ws[f'A{current_row+2}'] = "Total Pagado:"
        ws[f'A{current_row+2}'].font = Font(bold=True)
        ws[f'B{current_row+2}'] = float(total_paid)
        ws[f'B{current_row+2}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+2}'].font = Font(bold=True)

        ws[f'A{current_row+3}'] = "Total Pendiente:"
        ws[f'A{current_row+3}'].font = Font(bold=True)
        ws[f'B{current_row+3}'] = float(total_remaining)
        ws[f'B{current_row+3}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+3}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay cuotas que coincidan con los filtros aplicados."

    # Footer
    footer_row = len(fees_data) + 12 if fees_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 11):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_expenses_by_period_range_excel(start_year, start_month, end_year, end_month, expenses_data):
    """
    Generate an Excel report of administrative expenses for a period range
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Gastos {start_year}-{start_month:02d} a {end_year}-{end_month:02d}"

    month_names = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                   "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    start_month_name = month_names[start_month]
    end_month_name = month_names[end_month]

    # Title
    ws['A1'] = f"PAGO VECINAL - Reporte de Gastos Administrativos - {start_month_name} {start_year} a {end_month_name} {end_year}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:E1')

    if expenses_data:
        headers = ["Fecha Gasto", "Descripción", "Monto", "Año", "Mes"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, expense in enumerate(expenses_data, 4):
            ws.cell(row=row, column=1).value = expense['expense_date'].strftime("%d/%m/%Y")
            ws.cell(row=row, column=2).value = expense['description']
            ws.cell(row=row, column=3).value = float(expense['amount'])
            ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=4).value = expense['year']
            ws.cell(row=row, column=5).value = expense['month']

        # Summary section
        summary_row = len(expenses_data) + 6
        ws[f'A{summary_row}'] = "Resumen del Período"
        ws[f'A{summary_row}'].font = Font(size=12, bold=True)
        ws.merge_cells(f'A{summary_row}:E{summary_row}')

        # Calculate total amount
        total_amount = sum(expense['amount'] for expense in expenses_data)

        current_row = summary_row + 2
        ws[f'A{current_row}'] = "Total Gastos:"
        ws[f'A{current_row}'].font = Font(bold=True)
        ws[f'B{current_row}'] = len(expenses_data)
        ws[f'B{current_row}'].font = Font(bold=True)

        ws[f'A{current_row+1}'] = "Monto Total:"
        ws[f'A{current_row+1}'].font = Font(bold=True)
        ws[f'B{current_row+1}'] = float(total_amount)
        ws[f'B{current_row+1}'].number_format = '"S/ "#,##0.00'
        ws[f'B{current_row+1}'].font = Font(bold=True)
    else:
        ws['A3'] = f"No hay gastos registrados para el período {start_month_name} {start_year} a {end_month_name} {end_year}."

    # Footer
    footer_row = len(expenses_data) + 10 if expenses_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 6):
        ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_traffic_light_excel(traffic_light_data):
    """
    Generate an Excel report with traffic light system for condominium fees
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Semáforo Cuotas"

    # Define border style
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    # Title
    ws['A1'] = "Reporte Semáforo de Cuotas"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:E1')

    total_properties = len(traffic_light_data)
    mid_point = (total_properties + 1) // 2  # Ceiling division

    left_column = traffic_light_data[:mid_point]
    right_column = traffic_light_data[mid_point:]

    # Headers for left column
    ws['A3'] = "Casa"
    ws['B3'] = "Estado"
    ws['A3'].font = Font(bold=True)
    ws['B3'].font = Font(bold=True)

    # Headers for right column
    ws['D3'] = "Casa"
    ws['E3'] = "Estado"
    ws['D3'].font = Font(bold=True)
    ws['E3'].font = Font(bold=True)

    # Left column data
    for row, data in enumerate(left_column, 4):
        ws.cell(row=row, column=1).value = data['house']
        ws.cell(row=row, column=2).value = ""

        # Apply color based on status
        if data['status'] == 'ROJO':
            ws.cell(row=row, column=2).fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")
            ws.cell(row=row, column=2).font = Font(color="FFFFFF", bold=True)
        elif data['status'] == 'AMARILLO':
            ws.cell(row=row, column=2).fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
            ws.cell(row=row, column=2).font = Font(bold=True)
        elif data['status'] == 'VERDE':
            ws.cell(row=row, column=2).fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")
            ws.cell(row=row, column=2).font = Font(bold=True)

    # Right column data
    for row, data in enumerate(right_column, 4):
        ws.cell(row=row, column=4).value = data['house']
        ws.cell(row=row, column=5).value = ""

        # Apply color based on status
        if data['status'] == 'ROJO':
            ws.cell(row=row, column=5).fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")
            ws.cell(row=row, column=5).font = Font(color="FFFFFF", bold=True)
        elif data['status'] == 'AMARILLO':
            ws.cell(row=row, column=5).fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
            ws.cell(row=row, column=5).font = Font(bold=True)
        elif data['status'] == 'VERDE':
            ws.cell(row=row, column=5).fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")
            ws.cell(row=row, column=5).font = Font(bold=True)

    # Apply borders to tables
    # Left table
    for r in range(3, len(left_column) + 4):
        for c in [1, 2]:
            ws.cell(row=r, column=c).border = thin_border

    # Right table
    for r in range(3, len(right_column) + 4):
        for c in [4, 5]:
            ws.cell(row=r, column=c).border = thin_border

    # Legend
    legend_row = max(len(left_column), len(right_column)) + 6

    ws[f'A{legend_row-1}'] = "LEYENDA:"
    ws.merge_cells(f'A{legend_row-1}:C{legend_row-1}')
    ws[f'A{legend_row-1}'].font = Font(bold=True)

    # Verde
    ws.cell(row=legend_row, column=1).fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")
    ws.cell(row=legend_row, column=2).value = "VERDE: 0-1 cuotas pendientes"
    ws.merge_cells(f'B{legend_row}:E{legend_row}')

    # Amarillo
    ws.cell(row=legend_row+1, column=1).fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    ws.cell(row=legend_row+1, column=2).value = "AMARILLO: 2 cuotas pendientes"
    ws.merge_cells(f'B{legend_row+1}:E{legend_row+1}')

    # Rojo
    ws.cell(row=legend_row+2, column=1).fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")
    ws.cell(row=legend_row+2, column=2).value = "ROJO: 3 o más cuotas pendientes"
    ws.merge_cells(f'B{legend_row+2}:E{legend_row+2}')

    footer_row = legend_row + 4
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    ws.column_dimensions['A'].width = 10
    ws.column_dimensions['B'].width = 10
    ws.column_dimensions['C'].width = 5
    ws.column_dimensions['D'].width = 10
    ws.column_dimensions['E'].width = 15

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_payments_summary_excel(start_date, end_date, payments_data):
    """
    Generate an Excel report of payments summary by month
    """
    wb = Workbook()
    ws = wb.active

    # Format dates for title
    if start_date and end_date:
        title_date = f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
        ws.title = f"Resumen Pagos {start_date.strftime('%m%Y')}-{end_date.strftime('%m%Y')}"
    else:
        title_date = "Período no especificado"
        ws.title = "Resumen Pagos"

    # Title
    ws['A1'] = f"PAGO VECINAL - Resumen de Pagos - {title_date}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:E1')

    if payments_data:
        headers = ["AÑO", "MES", "CUOTA", "N° VECINOS", "INGRESO CUOTA"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        month_names = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
                      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]

        for row, data in enumerate(payments_data, 4):
            ws.cell(row=row, column=1).value = data['year']
            ws.cell(row=row, column=2).value = month_names[data['month']]
            ws.cell(row=row, column=3).value = float(data['amount'])
            ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=4).value = data['count']
            ws.cell(row=row, column=5).value = float(data['total'])
            ws.cell(row=row, column=5).number_format = '"S/ "#,##0.00'

        # Summary
        total_neighbors = sum(d['count'] for d in payments_data)
        total_income = sum(d['total'] for d in payments_data)

        summary_row = len(payments_data) + 6
        ws[f'A{summary_row}'] = "Total General:"
        ws[f'A{summary_row}'].font = Font(bold=True)
        ws[f'B{summary_row}'] = total_neighbors
        ws[f'B{summary_row}'].font = Font(bold=True)
        ws[f'C{summary_row}'] = float(total_income)
        ws[f'C{summary_row}'].number_format = '"S/ "#,##0.00'
        ws[f'C{summary_row}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay pagos registrados para el período."

    # Footer
    footer_row = len(payments_data) + 9 if payments_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 15

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_fee_payment_matrix_excel(start_year, start_month, end_year, end_month, matrix_data):
    """
    Generate an Excel matrix report of fee payments by property and month
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Matriz Pagos {start_year}-{end_year}"

    # Title
    period_text = f"{start_month:02d}/{start_year} - {end_month:02d}/{end_year}"
    ws['A1'] = f"PAGO VECINAL - Matriz de Pagos de Cuotas - {period_text}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:Z1')  # Wide merge for title

    # Prepare data
    # Sort properties by row_letter alphabetically, then by number numerically
    properties = sorted(set((d['row_letter'], d['number'], d['property']) for d in matrix_data))
    properties = [p[2] for p in properties]  # Get the property string

    months = []
    current_year = start_year
    current_month = start_month
    while (current_year < end_year) or (current_year == end_year and current_month <= end_month):
        months.append((current_year, current_month))
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1

    # Headers
    ws['A3'] = "Casa"
    ws['A3'].font = Font(bold=True)

    col = 2
    for year, month in months:
        month_names = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        cell = ws.cell(row=3, column=col)
        cell.value = f"{month_names[month]} {year}"
        cell.font = Font(bold=True)
        col += 1

    # Add "Total" header
    ws.cell(row=3, column=col).value = "Total"
    ws.cell(row=3, column=col).font = Font(bold=True)

    # Data rows
    row = 4
    month_totals = [0] * len(months)
    grand_total = 0

    for prop in properties:
        ws.cell(row=row, column=1).value = prop
        ws.cell(row=row, column=1).font = Font(bold=True)

        col = 2
        property_total = 0
        for i, (year, month) in enumerate(months):
            amount = 0
            for d in matrix_data:
                if d['property'] == prop and d['year'] == year and d['month'] == month:
                    amount = d['paid_amount']
                    break

            cell = ws.cell(row=row, column=col)
            cell.value = float(amount)
            cell.number_format = '"S/ "#,##0.00'

            # Color coding
            if amount > 0:
                cell.fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")  # Green
            else:
                cell.fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")  # Red

            property_total += amount
            month_totals[i] += amount
            col += 1

        # Property total
        cell = ws.cell(row=row, column=col)
        cell.value = float(property_total)
        cell.number_format = '"S/ "#,##0.00'
        cell.font = Font(bold=True)
        grand_total += property_total

        row += 1

    # Month totals row
    ws.cell(row=row, column=1).value = "Total por Mes"
    ws.cell(row=row, column=1).font = Font(bold=True)

    col = 2
    for total in month_totals:
        cell = ws.cell(row=row, column=col)
        cell.value = float(total)
        cell.number_format = '"S/ "#,##0.00'
        cell.font = Font(bold=True)
        col += 1

    # Grand total
    cell = ws.cell(row=row, column=col)
    cell.value = float(grand_total)
    cell.number_format = '"S/ "#,##0.00'
    cell.font = Font(bold=True)

    # Footer
    footer_row = row + 3
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, len(months) + 3):
        ws.column_dimensions[get_column_letter(col)].width = 15

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_fee_contribution_summary_excel(start_year, start_month, end_year, end_month, contribution_data):
    """
    Generate an Excel report of fee contribution summary by property
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Resumen Contribucion {start_year}-{end_year}"

    # Title
    period_text = f"{start_month:02d}/{start_year} - {end_month:02d}/{end_year}"
    ws['A1'] = f"PAGO VECINAL - Resumen de Contribución de Cuotas - {period_text}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:E1')

    if contribution_data:
        headers = ["Casa", "Cuotas Pagadas", "Cuotas No Pagadas", "Dinero Pagado", "% Aporte al Total", "Observación"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for row, data in enumerate(contribution_data, 4):
            ws.cell(row=row, column=1).value = data['property']
            ws.cell(row=row, column=1).font = Font(bold=True)
            ws.cell(row=row, column=2).value = data['paid_count']
            ws.cell(row=row, column=3).value = data['unpaid_count']
            ws.cell(row=row, column=4).value = float(data['total_paid_amount'])
            ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=5).value = data['contribution_percentage']
            ws.cell(row=row, column=5).number_format = '0.00"%"'
            ws.cell(row=row, column=6).value = data['observation']

        # Summary
        total_paid = sum(d['paid_count'] for d in contribution_data)
        total_unpaid = sum(d['unpaid_count'] for d in contribution_data)
        total_amount = sum(d['total_paid_amount'] for d in contribution_data)

        summary_row = len(contribution_data) + 6
        ws[f'A{summary_row}'] = "Total General:"
        ws[f'A{summary_row}'].font = Font(bold=True)
        ws[f'B{summary_row}'] = total_paid
        ws[f'B{summary_row}'].font = Font(bold=True)
        ws[f'C{summary_row}'] = total_unpaid
        ws[f'C{summary_row}'].font = Font(bold=True)
        ws[f'D{summary_row}'] = float(total_amount)
        ws[f'D{summary_row}'].number_format = '"S/ "#,##0.00'
        ws[f'D{summary_row}'].font = Font(bold=True)
        ws[f'E{summary_row}'] = 100.0
        ws[f'E{summary_row}'].number_format = '0.00"%"'
        ws[f'E{summary_row}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay datos de cuotas para el período."

    # Footer
    footer_row = len(contribution_data) + 9 if contribution_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 7):
        ws.column_dimensions[get_column_letter(col)].width = 20

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_paid_fees_summary_excel(start_year, start_month, end_year, end_month, paid_fees_data):
    """
    Generate an Excel report of paid fees summary by month for period range
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Resumen Cuotas Pagadas {start_year}-{end_year}"

    # Title
    period_text = f"{start_month:02d}/{start_year} - {end_month:02d}/{end_year}"
    ws['A1'] = f"PAGO VECINAL - Resumen de Cuotas Pagadas - {period_text}"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:E1')

    if paid_fees_data:
        headers = ["AÑO", "MES", "CUOTA", "N° VECINOS", "INGRESO CUOTA", "GASTOS PERIODO", "INGRESO - GASTO"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col)
            cell.value = header
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        month_names = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
                      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]

        for row, data in enumerate(paid_fees_data, 4):
            ws.cell(row=row, column=1).value = data['year']
            ws.cell(row=row, column=2).value = month_names[data['month']]
            ws.cell(row=row, column=3).value = float(data['amount'])
            ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=4).value = data['count']
            ws.cell(row=row, column=5).value = float(data['total'])
            ws.cell(row=row, column=5).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=6).value = float(data['expenses'])
            ws.cell(row=row, column=6).number_format = '"S/ "#,##0.00'
            ws.cell(row=row, column=7).value = float(data['net'])
            ws.cell(row=row, column=7).number_format = '"S/ "#,##0.00'

        # Summary
        total_neighbors = sum(d['count'] for d in paid_fees_data)
        total_income = sum(d['total'] for d in paid_fees_data)
        total_expenses = sum(d['expenses'] for d in paid_fees_data)
        total_net = total_income - total_expenses

        summary_row = len(paid_fees_data) + 6
        ws[f'A{summary_row}'] = "Total General:"
        ws[f'A{summary_row}'].font = Font(bold=True)
        ws[f'B{summary_row}'] = total_neighbors
        ws[f'B{summary_row}'].font = Font(bold=True)
        ws[f'C{summary_row}'] = float(total_net)
        ws[f'C{summary_row}'].number_format = '"S/ "#,##0.00'
        ws[f'C{summary_row}'].font = Font(bold=True)
    else:
        ws['A3'] = "No hay cuotas pagadas para el año especificado."

    # Footer
    footer_row = len(paid_fees_data) + 9 if paid_fees_data else 5
    ws[f'A{footer_row}'] = f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 6):
        ws.column_dimensions[get_column_letter(col)].width = 15

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_annual_property_statement_excel(property_data, year, fees_data, payments_data):
    """
    Generate an annual Excel statement for a property
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Estado Anual {year}"

    # Title
    ws['A1'] = "PAGO VECINAL - Estado Anual por Propiedad"
    ws['A1'].font = Font(size=16, bold=True)
    ws.merge_cells('A1:G1')

    # Property information
    ws['A3'] = "Información de la Propiedad"
    ws['A3'].font = Font(size=12, bold=True)
    ws.merge_cells('A3:G3')

    property_info = [
        ["Villa:", property_data['villa']],
        ["Fila:", property_data['row_letter']],
        ["Número:", str(property_data['number'])],
        ["Propietario:", property_data['owner_name']],
        ["Teléfono:", property_data.get('owner_phone', 'N/A')]
    ]

    for i, (label, value) in enumerate(property_info, 5):
        ws[f'A{i}'] = label
        ws[f'B{i}'] = value
        ws[f'A{i}'].font = Font(bold=True)

    # Annual summary
    row = 12
    total_fees = sum(f['amount'] for f in fees_data) if fees_data else 0
    total_payments = sum(p['amount'] for p in payments_data) if payments_data else 0
    balance = total_fees - total_payments

    summary_data = [
        ["Total Cuotas Generadas:", f"S/ {total_fees:.2f}"],
        ["Total Pagos Realizados:", f"S/ {total_payments:.2f}"],
        ["Saldo Pendiente:", f"S/ {balance:.2f}"]
    ]

    for i, (label, value) in enumerate(summary_data, row):
        ws[f'A{i}'] = label
        ws[f'A{i}'].font = Font(bold=True)
        if "S/" in value:
            ws[f'B{i}'] = float(value.replace("S/ ", ""))
            ws[f'B{i}'].number_format = '"S/ "#,##0.00'
        else:
            ws[f'B{i}'] = value
        ws[f'B{i}'].font = Font(bold=True)

    # Monthly breakdown
    row += 6
    ws[f'A{row}'] = "Detalle por Mes"
    ws[f'A{row}'].font = Font(size=12, bold=True)
    ws.merge_cells(f'A{row}:G{row}')

    monthly_headers = ["Mes", "Cuotas", "Pagos", "Saldo"]
    for col, header in enumerate(monthly_headers, 1):
        cell = ws.cell(row=row+1, column=col)
        cell.value = header
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

    # Create monthly breakdown
    monthly_data = {}
    for month in range(1, 13):
        monthly_data[month] = {'fees': 0, 'payments': 0}

    for fee in fees_data:
        if fee['month'] in monthly_data:
            monthly_data[fee['month']]['fees'] += fee['amount']

    for payment in payments_data:
        payment_month = payment['payment_date'].month
        if payment_month in monthly_data:
            monthly_data[payment_month]['payments'] += payment['amount']

    month_names = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                   "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    for month in range(1, 13):
        row += 1
        fees = monthly_data[month]['fees']
        payments = monthly_data[month]['payments']
        balance = fees - payments
        ws.cell(row=row, column=1).value = month_names[month]
        ws.cell(row=row, column=2).value = float(fees)
        ws.cell(row=row, column=2).number_format = '"S/ "#,##0.00'
        ws.cell(row=row, column=3).value = float(payments)
        ws.cell(row=row, column=3).number_format = '"S/ "#,##0.00'
        ws.cell(row=row, column=4).value = float(balance)
        ws.cell(row=row, column=4).number_format = '"S/ "#,##0.00'

    # Footer
    row += 3
    ws[f'A{row}'] = f"Estado generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    # Auto-adjust column widths
    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 15

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer