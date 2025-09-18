import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def generate_receipt_pdf(receipt_data):
    """
    Generate a PDF receipt for a payment
    """
    buffer = io.BytesIO()

    # Create the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    normal_style = styles['Normal']
    normal_style.fontSize = 10

    # Build the PDF content
    content = []

    # Header
    content.append(Paragraph("PAGO VECINAL", title_style))
    content.append(Paragraph("Sistema de Gestión de Cuotas de Condominio", subtitle_style))
    content.append(Spacer(1, 20))

    # Receipt info
    receipt_info = [
        ["Número de Recibo:", receipt_data['correlative_number']],
        ["Fecha de Emisión:", receipt_data['issue_date'].strftime("%d/%m/%Y %H:%M")],
        ["Período:", receipt_data.get('fee_period', 'N/A')]
    ]

    receipt_table = Table(receipt_info, colWidths=[2*inch, 4*inch])
    receipt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(receipt_table)
    content.append(Spacer(1, 20))

    # Property information
    content.append(Paragraph("Información de la Propiedad", styles['Heading3']))
    property_info = [
        ["Villa:", receipt_data['property_details']['villa']],
        ["Fila:", receipt_data['property_details']['row_letter']],
        ["Número:", str(receipt_data['property_details']['number'])],
        ["Propietario:", receipt_data['property_details']['owner_name']],
        ["Teléfono:", receipt_data['property_details'].get('owner_phone', 'N/A')]
    ]

    property_table = Table(property_info, colWidths=[2*inch, 4*inch])
    property_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(property_table)
    content.append(Spacer(1, 20))

    # Payment details
    content.append(Paragraph("Detalles del Pago", styles['Heading3']))
    payment_info = [
        ["Fecha del Pago:", receipt_data['payment_date'].strftime("%d/%m/%Y")],
        ["Monto Pagado:", f"S/ {receipt_data['total_amount']:.2f}"],
        ["Estado:", "COMPLETADO"],
        ["Referencia:", receipt_data.get('reference', 'N/A')]
    ]

    payment_table = Table(payment_info, colWidths=[2*inch, 4*inch])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgreen),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(payment_table)
    content.append(Spacer(1, 20))

    # Notes
    if receipt_data.get('notes'):
        content.append(Paragraph("Notas:", styles['Heading4']))
        content.append(Paragraph(receipt_data['notes'], normal_style))
        content.append(Spacer(1, 10))

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph("¡Gracias por su pago!", subtitle_style))
    content.append(Paragraph("Este recibo es válido como comprobante de pago.", normal_style))

    # Build the PDF
    doc.build(content)

    buffer.seek(0)
    return buffer


def generate_property_payment_history_pdf(property_data, payments_data, fees_data):
    """
    Generate a PDF report of payment history for a specific property
    """
    buffer = io.BytesIO()

    # Create the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    normal_style = styles['Normal']
    normal_style.fontSize = 10

    # Build the PDF content
    content = []

    # Header
    content.append(Paragraph("PAGO VECINAL", title_style))
    content.append(Paragraph("Historial de Pagos por Propiedad", subtitle_style))
    content.append(Spacer(1, 20))

    # Property information
    content.append(Paragraph("Información de la Propiedad", styles['Heading3']))
    property_info = [
        ["Villa:", property_data['villa']],
        ["Fila:", property_data['row_letter']],
        ["Número:", str(property_data['number'])],
        ["Propietario:", property_data['owner_name']],
        ["Teléfono:", property_data.get('owner_phone', 'N/A')]
    ]

    property_table = Table(property_info, colWidths=[2*inch, 4*inch])
    property_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(property_table)
    content.append(Spacer(1, 20))

    # Payments table
    if payments_data:
        content.append(Paragraph("Pagos Realizados", styles['Heading3']))
        payment_headers = ["Fecha", "Monto", "Estado", "Referencia"]
        payment_rows = [payment_headers]

        for payment in payments_data:
            payment_rows.append([
                payment['payment_date'].strftime("%d/%m/%Y"),
                f"S/ {payment['amount']:.2f}",
                payment['status'],
                payment.get('reference', 'N/A')
            ])

        payments_table = Table(payment_rows, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 2*inch])
        payments_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(payments_table)
        content.append(Spacer(1, 10))

        # Total payments
        total_payments = sum(p['amount'] for p in payments_data)
        content.append(Paragraph(f"Total Pagado: S/ {total_payments:.2f}", styles['Heading4']))
        content.append(Spacer(1, 20))

    # Outstanding fees
    if fees_data:
        content.append(Paragraph("Cuotas Pendientes", styles['Heading3']))
        fee_headers = ["Período", "Monto", "Fecha Vencimiento", "Estado"]
        fee_rows = [fee_headers]

        for fee in fees_data:
            fee_rows.append([
                f"{fee['month']}/{fee['year']}",
                f"S/ {fee['amount']:.2f}",
                fee['due_date'].strftime("%d/%m/%Y"),
                fee['status']
            ])

        fees_table = Table(fee_rows, colWidths=[1.5*inch, 1.5*inch, 2*inch, 1.5*inch])
        fees_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightcoral),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(fees_table)
        content.append(Spacer(1, 10))

        # Total outstanding
        total_outstanding = sum(f['amount'] for f in fees_data)
        content.append(Paragraph(f"Total Pendiente: S/ {total_outstanding:.2f}", styles['Heading4']))

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph(f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_style))

    # Build the PDF
    doc.build(content)

    buffer.seek(0)
    return buffer


def generate_agreement_pdf(agreement, property_data, fees_data, installments_data):
    """
    Generate a PDF agreement document
    """
    buffer = io.BytesIO()

    # Create the PDF document
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=24,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading3'],
        fontSize=14,
        spaceAfter=15
    )

    normal_style = styles['Normal']
    normal_style.fontSize = 10

    # Build the PDF content
    content = []

    # Header
    content.append(Paragraph("CONVENIO DE PAGO", title_style))
    content.append(Paragraph("Sistema de Gestión de Cuotas de Condominio", subtitle_style))
    content.append(Spacer(1, 20))

    # Agreement info
    content.append(Paragraph("Información del Convenio", section_style))
    agreement_info = [
        ["Número de Convenio:", agreement.agreement_number],
        ["Fecha de Creación:", agreement.created_at.strftime("%d/%m/%Y %H:%M")],
        ["Estado:", agreement.status.value.upper()],
        ["Fecha de Inicio:", agreement.start_date.strftime("%d/%m/%Y")],
        ["Fecha de Fin:", agreement.end_date.strftime("%d/%m/%Y")]
    ]

    agreement_table = Table(agreement_info, colWidths=[3*inch, 3*inch])
    agreement_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(agreement_table)
    content.append(Spacer(1, 20))

    # Property information
    content.append(Paragraph("Información de la Propiedad", section_style))
    property_info = [
        ["Villa:", property_data.villa],
        ["Fila:", property_data.row_letter],
        ["Número:", str(property_data.number)],
        ["Propietario:", property_data.owner_name],
        ["Teléfono:", property_data.owner_phone or "N/A"]
    ]

    property_table = Table(property_info, colWidths=[2*inch, 4*inch])
    property_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(property_table)
    content.append(Spacer(1, 20))

    # Debt summary
    content.append(Paragraph("Resumen de la Deuda", section_style))
    debt_info = [
        ["Deuda Total:", f"S/ {agreement.total_debt:.2f}"],
        ["Monto Mensual:", f"S/ {agreement.monthly_amount:.2f}"],
        ["Número de Cuotas:", str(agreement.installments_count)],
        ["Período del Convenio:", f"{agreement.start_date.strftime('%d/%m/%Y')} - {agreement.end_date.strftime('%d/%m/%Y')}"]
    ]

    debt_table = Table(debt_info, colWidths=[3*inch, 3*inch])
    debt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(debt_table)
    content.append(Spacer(1, 20))

    # Fees covered by agreement
    if fees_data:
        content.append(Paragraph("Cuotas Incluidas en el Convenio", section_style))
        fee_headers = ["Período", "Monto", "Fecha Vencimiento"]
        fee_rows = [fee_headers]

        for fee in fees_data:
            fee_rows.append([
                f"{fee.month}/{fee.year}",
                f"S/ {fee.amount:.2f}",
                fee.due_date.strftime("%d/%m/%Y")
            ])

        fees_table = Table(fee_rows, colWidths=[1.5*inch, 1.5*inch, 2*inch])
        fees_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(fees_table)
        content.append(Spacer(1, 10))

    # Installment schedule
    if installments_data:
        content.append(Paragraph("Cronograma de Pagos", section_style))
        installment_headers = ["Cuota", "Monto", "Fecha Vencimiento", "Estado"]
        installment_rows = [installment_headers]

        for installment in installments_data:
            installment_rows.append([
                str(installment.installment_number),
                f"S/ {installment.amount:.2f}",
                installment.due_date.strftime("%d/%m/%Y"),
                installment.status.value.upper()
            ])

        installments_table = Table(installment_rows, colWidths=[1*inch, 1.5*inch, 2*inch, 1.5*inch])
        installments_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(installments_table)
        content.append(Spacer(1, 20))

    # Terms and conditions
    content.append(Paragraph("Términos y Condiciones", section_style))
    terms = [
        "1. El propietario se compromete a pagar las cuotas mensuales según el cronograma establecido.",
        "2. Los pagos deben realizarse antes de la fecha de vencimiento de cada cuota.",
        "3. En caso de retraso en el pago, se aplicarán intereses moratorios.",
        "4. El convenio queda sin efecto si se incumple con 2 cuotas consecutivas.",
        "5. Una vez completado el pago de todas las cuotas, las deudas originales quedan canceladas.",
        "6. Este documento es válido como comprobante del acuerdo establecido."
    ]

    for term in terms:
        content.append(Paragraph(term, normal_style))
        content.append(Spacer(1, 5))

    content.append(Spacer(1, 30))

    # Notes
    if agreement.notes:
        content.append(Paragraph("Notas Adicionales:", styles['Heading4']))
        content.append(Paragraph(agreement.notes, normal_style))
        content.append(Spacer(1, 20))

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph("Este convenio ha sido generado automáticamente por el sistema.", normal_style))
    content.append(Paragraph(f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_style))

    # Build the PDF
    doc.build(content)

    buffer.seek(0)
    return buffer


def generate_outstanding_fees_pdf(fees_data):
    """
    Generate a PDF report of all outstanding fees
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    content = []

    # Header
    content.append(Paragraph("PAGO VECINAL", title_style))
    content.append(Paragraph("Cuotas Pendientes - Reporte General", subtitle_style))
    content.append(Spacer(1, 20))

    if fees_data:
        # Outstanding fees table
        headers = ["Propiedad", "Propietario", "Período", "Monto", "Fecha Vencimiento"]
        rows = [headers]

        for fee in fees_data:
            property_str = f"{fee['property_villa']} - {fee['property_row_letter']}{fee['property_number']}"
            rows.append([
                property_str,
                fee['property_owner_name'],
                f"{fee['month']}/{fee['year']}",
                f"S/ {fee['amount']:.2f}",
                fee['due_date'].strftime("%d/%m/%Y")
            ])

        table = Table(rows, colWidths=[2*inch, 2*inch, 1*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightcoral),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(table)
        content.append(Spacer(1, 10))

        # Summary
        total_amount = sum(f['amount'] for f in fees_data)
        content.append(Paragraph(f"Total Cuotas Pendientes: {len(fees_data)}", styles['Heading4']))
        content.append(Paragraph(f"Monto Total Pendiente: S/ {total_amount:.2f}", styles['Heading4']))
    else:
        content.append(Paragraph("No hay cuotas pendientes.", styles['Normal']))

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph(f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))

    doc.build(content)

    buffer.seek(0)
    return buffer


def generate_monthly_payment_summary_pdf(year, month, payments_data):
    """
    Generate a PDF summary of payments for a specific month
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    content = []

    # Header
    content.append(Paragraph("PAGO VECINAL", title_style))
    content.append(Paragraph(f"Resumen de Pagos - {month:02d}/{year}", subtitle_style))
    content.append(Spacer(1, 20))

    if payments_data:
        # Payments table
        headers = ["Propiedad", "Propietario", "Fecha Pago", "Monto", "Estado"]
        rows = [headers]

        for payment in payments_data:
            property_str = f"{payment['property_villa']} - {payment['property_row_letter']}{payment['property_number']}"
            rows.append([
                property_str,
                payment['property_owner_name'],
                payment['payment_date'].strftime("%d/%m/%Y"),
                f"S/ {payment['amount']:.2f}",
                payment['status']
            ])

        table = Table(rows, colWidths=[2*inch, 2*inch, 1.5*inch, 1.5*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(table)
        content.append(Spacer(1, 10))

        # Summary
        total_payments = len(payments_data)
        total_amount = sum(p['amount'] for p in payments_data)
        content.append(Paragraph(f"Total Pagos: {total_payments}", styles['Heading4']))
        content.append(Paragraph(f"Monto Total Recaudado: S/ {total_amount:.2f}", styles['Heading4']))
    else:
        content.append(Paragraph("No hay pagos registrados para este período.", styles['Normal']))

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph(f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))

    doc.build(content)

    buffer.seek(0)
    return buffer


def generate_annual_property_statement_pdf(property_data, year, fees_data, payments_data):
    """
    Generate an annual statement for a property showing all fees and payments
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20
    )

    content = []

    # Header
    content.append(Paragraph("PAGO VECINAL", title_style))
    content.append(Paragraph(f"Estado Anual {year} - Propiedad", subtitle_style))
    content.append(Spacer(1, 20))

    # Property information
    content.append(Paragraph("Información de la Propiedad", styles['Heading3']))
    property_info = [
        ["Villa:", property_data['villa']],
        ["Fila:", property_data['row_letter']],
        ["Número:", str(property_data['number'])],
        ["Propietario:", property_data['owner_name']],
        ["Teléfono:", property_data.get('owner_phone', 'N/A')]
    ]

    property_table = Table(property_info, colWidths=[2*inch, 4*inch])
    property_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(property_table)
    content.append(Spacer(1, 20))

    # Annual summary
    total_fees = sum(f['amount'] for f in fees_data) if fees_data else 0
    total_payments = sum(p['amount'] for p in payments_data) if payments_data else 0
    balance = total_fees - total_payments

    summary_data = [
        ["Total Cuotas Generadas:", f"S/ {total_fees:.2f}"],
        ["Total Pagos Realizados:", f"S/ {total_payments:.2f}"],
        ["Saldo Pendiente:", f"S/ {balance:.2f}"]
    ]

    summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(summary_table)
    content.append(Spacer(1, 20))

    # Detailed breakdown by month
    content.append(Paragraph("Detalle por Mes", styles['Heading3']))

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

    # Monthly table
    monthly_headers = ["Mes", "Cuotas", "Pagos", "Saldo"]
    monthly_rows = [monthly_headers]

    month_names = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                   "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    for month in range(1, 13):
        fees = monthly_data[month]['fees']
        payments = monthly_data[month]['payments']
        balance = fees - payments
        monthly_rows.append([
            month_names[month],
            f"S/ {fees:.2f}",
            f"S/ {payments:.2f}",
            f"S/ {balance:.2f}"
        ])

    monthly_table = Table(monthly_rows, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    monthly_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(monthly_table)

    # Footer
    content.append(Spacer(1, 30))
    content.append(Paragraph(f"Estado generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))

    doc.build(content)

    buffer.seek(0)
    return buffer