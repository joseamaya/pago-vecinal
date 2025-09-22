from datetime import datetime
import os
from ..models.receipt import Receipt
from ..models.payment import Payment
from ..models.treasurer import Treasurer
from ..config.database import database
from ..utils.pdf_generator import generate_receipt_pdf

async def generate_automatic_receipt(payment: Payment) -> str:
    """
    Generate a receipt automatically when payment is approved
    Returns the file path of the generated PDF
    """
    print(f"Starting receipt generation for payment {payment.id}")

    # Fetch linked documents
    await payment.fetch_link(Payment.fee)
    await payment.fetch_link(Payment.user)

    print(f"Payment fee: {payment.fee}")
    print(f"Payment user: {payment.user}")

    # Fetch property and fee_schedule from fee
    if payment.fee:
        await payment.fee.fetch_link('property')
        await payment.fee.fetch_link('fee_schedule')
        print(f"Fee property: {payment.fee.property}")
        print(f"Fee property type: {type(payment.fee.property)}")
        print(f"Fee schedule: {payment.fee.fee_schedule}")
        if hasattr(payment.fee.property, 'id'):
            print(f"Property ID: {payment.fee.property.id}")
    else:
        raise Exception("Payment has no associated fee")

    # Generate correlative number - fee payments use CUOT
    from ..routes.receipts import generate_correlative_number
    correlative_number = await generate_correlative_number(payment.payment_date.year, "CUOT")

    # Create property and owner details snapshot
    if not payment.fee.property:
        # If no property linked, create default details
        print("Warning: Fee has no associated property, using default details")
        property_details = {
            "villa": "N/A",
            "row_letter": "N/A",
            "number": 0,
            "owner_name": "Propietario no registrado",
            "owner_phone": "N/A"
        }
        owner_details = {
            "name": "Propietario no registrado",
            "phone": "N/A"
        }
    else:
        print(f"Creating property details for property: {payment.fee.property}")
        property_details = {
            "villa": getattr(payment.fee.property, 'villa', 'N/A'),
            "row_letter": getattr(payment.fee.property, 'row_letter', 'N/A'),
            "number": getattr(payment.fee.property, 'number', 0),
            "owner_name": getattr(payment.fee.property, 'owner_name', 'Propietario no registrado'),
            "owner_phone": getattr(payment.fee.property, 'owner_phone', 'N/A') or "N/A"
        }

        owner_details = {
            "name": getattr(payment.fee.property, 'owner_name', 'Propietario no registrado'),
            "phone": getattr(payment.fee.property, 'owner_phone', 'N/A') or "N/A"
        }

    print(f"Property details: {property_details}")

    # Get treasurer data
    treasurer = await Treasurer.find_one()
    treasurer_details = {
        "name": treasurer.name if treasurer else "Tesorero no configurado",
        "signature": treasurer.signature if treasurer else None
    }

    # Create receipt record
    receipt = Receipt(
        correlative_number=correlative_number,
        payment=payment,
        issue_date=payment.payment_date,
        total_amount=payment.amount,
        property_details=property_details,
        owner_details=owner_details,
        fee_period=f"{payment.fee.month}/{payment.fee.year}",
        notes=f"Recibo generado automáticamente al aprobar el pago",
        treasurer_details=treasurer_details
    )

    await receipt.insert()

    print(f"Receipt created in database with ID: {receipt.id}")

    # Generate PDF receipt
    try:
        # Prepare data for PDF generation
        pdf_data = {
            "correlative_number": correlative_number,
            "issue_date": receipt.issue_date,
            "payment_date": payment.payment_date,
            "total_amount": payment.amount,
            "property_details": property_details,
            "reference": payment.fee_id,
            "fee_period": f"{payment.fee.month}/{payment.fee.year}",
            "notes": f"Recibo generado automáticamente al aprobar el pago",
            "treasurer_details": treasurer_details
        }

        pdf_buffer = generate_receipt_pdf(pdf_data)

        # Generate filename similar to existing pattern
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        pdf_filename = f"recibo_{correlative_number}_{timestamp}.pdf"
        pdf_path = os.path.join("static", "receipts", pdf_filename)

        # Save PDF to file
        with open(pdf_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        print(f"PDF receipt saved to: {pdf_path}")
        return pdf_path

    except Exception as e:
        print(f"Error generating PDF receipt: {e}")
        import traceback
        traceback.print_exc()
        return None