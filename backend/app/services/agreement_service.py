import logging
import os
from datetime import datetime

from dateutil.relativedelta import relativedelta

from ..models.agreement import Agreement, AgreementInstallment
from ..models.fee import FeeStatus
from ..models.treasurer import Treasurer
from ..schemas.agreement import AgreementResponse, AgreementInstallmentResponse
from ..utils.pdf_generator import generate_agreement_pdf

logger = logging.getLogger(__name__)


def build_installment_response(installment) -> AgreementInstallmentResponse:
    return AgreementInstallmentResponse(
        id=str(installment.id),
        agreement_id=str(installment.agreement.id),
        installment_number=installment.installment_number,
        amount=installment.amount,
        due_date=installment.due_date,
        paid_date=installment.paid_date,
        status=installment.status,
        payment_reference=installment.payment_reference,
        notes=installment.notes,
    )


async def fetch_agreement_installments(agreement_id):
    installments = await AgreementInstallment.find(
        AgreementInstallment.agreement.id == agreement_id
    ).to_list()
    for inst in installments:
        await inst.fetch_link(AgreementInstallment.agreement)
    return installments


async def build_agreement_response(agreement, installments=None) -> AgreementResponse:
    if installments is None:
        installments = await fetch_agreement_installments(agreement.id)
    return AgreementResponse(
        id=str(agreement.id),
        property_id=str(agreement.property.id),
        property_villa=agreement.property.villa,
        property_row_letter=agreement.property.row_letter,
        property_number=agreement.property.number,
        property_owner_name=agreement.property.owner_name,
        fee_ids=[str(fee.id) for fee in agreement.fees],
        user_id=str(agreement.user.id),
        total_debt=agreement.total_debt,
        monthly_amount=agreement.monthly_amount,
        installments_count=agreement.installments_count,
        start_date=agreement.start_date,
        end_date=agreement.end_date,
        status=agreement.status,
        agreement_number=agreement.agreement_number,
        pdf_file=agreement.pdf_file,
        notes=agreement.notes,
        created_at=agreement.created_at,
        updated_at=agreement.updated_at,
        installments=[build_installment_response(inst) for inst in installments],
    )


async def generate_agreement_number() -> str:
    current_year = datetime.utcnow().year
    last_agreement = await Agreement.find(
        {"agreement_number": {"$regex": f"^AGR-{current_year}"}}
    ).sort([("agreement_number", -1)]).first_or_none()

    if last_agreement:
        parts = last_agreement.agreement_number.split("-")
        if len(parts) == 3:
            new_number = int(parts[2]) + 1
        else:
            new_number = 1
    else:
        new_number = 1

    return f"AGR-{current_year}-{new_number:05d}"


async def create_agreement_with_installments(prop, fees, agreement_data, owner):
    total_debt = sum(fee.amount for fee in fees)
    end_date = agreement_data.start_date + relativedelta(months=agreement_data.installments_count)
    agreement_number = await generate_agreement_number()

    agreement = Agreement(
        property=prop,
        fees=fees,
        user=owner,
        total_debt=total_debt,
        monthly_amount=agreement_data.monthly_amount,
        installments_count=agreement_data.installments_count,
        start_date=agreement_data.start_date,
        end_date=end_date,
        agreement_number=agreement_number,
        notes=agreement_data.notes,
    )
    await agreement.insert()

    for fee in fees:
        fee.status = FeeStatus.AGREEMENT
        await fee.save()

    installments = []
    for i in range(1, agreement_data.installments_count + 1):
        due_date = agreement_data.start_date + relativedelta(months=i)
        installment = AgreementInstallment(
            agreement=agreement,
            installment_number=i,
            amount=agreement_data.monthly_amount,
            due_date=due_date,
        )
        await installment.insert()
        installments.append(installment)

    for inst in installments:
        await inst.fetch_link(AgreementInstallment.agreement)

    treasurer = await Treasurer.find_one(Treasurer.villa == prop.villa)
    treasurer_details = None
    if treasurer:
        treasurer_details = {
            "name": treasurer.name,
            "signature": treasurer.signature,
            "villa": treasurer.villa,
        }

    try:
        pdf_buffer = generate_agreement_pdf(agreement, prop, fees, installments, treasurer_details)
        pdf_filename = f"agreement_{agreement_number}.pdf"
        pdf_path = f"static/agreements/{pdf_filename}"
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)

        with open(pdf_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        agreement.pdf_file = pdf_path
        await agreement.save()
    except Exception:
        logger.exception("Error generating agreement PDF for %s", agreement_number)

    return agreement, installments
