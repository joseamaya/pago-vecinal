import logging

from ..models.property import Property

logger = logging.getLogger(__name__)


async def bulk_import_property_rows(sheet):
    imported = 0
    updated = 0
    errors = []

    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        villa, row_letter, number, owner_name, owner_phone = row[:5]

        if not all([villa, row_letter, number, owner_name]):
            errors.append(f"Row {row_idx}: Missing required fields")
            continue

        try:
            number = int(number)
        except ValueError:
            errors.append(f"Row {row_idx}: Invalid number")
            continue

        existing = await Property.find_one(
            Property.row_letter == row_letter.upper(),
            Property.number == number,
            Property.villa == villa
        )
        if existing:
            existing.owner_name = owner_name
            existing.owner_phone = owner_phone
            await existing.save()
            updated += 1
        else:
            prop = Property(
                row_letter=row_letter.upper(),
                number=number,
                villa=villa,
                owner_name=owner_name,
                owner_phone=owner_phone
            )
            await prop.insert()
            imported += 1

    return {"imported": imported, "updated": updated, "errors": errors}
