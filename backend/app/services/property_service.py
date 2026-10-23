import logging

from ..models.owner import Owner
from ..models.property import Property
from ..services.ownership_service import assign_owners
from ..utils.names import normalize_person_name, person_name_key

logger = logging.getLogger(__name__)


async def _find_or_create_owner(full_name: str, phone: str | None) -> Owner:
    name = normalize_person_name(str(full_name))
    key = person_name_key(name)
    candidates = await Owner.find_all().to_list()

    for owner in candidates:
        if (
            person_name_key(owner.full_name) == key
            and (owner.phone or "") == (phone or "")
        ):
            return owner

    owner = Owner(full_name=name, phone=phone)
    await owner.insert()
    return owner


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

        owner = await _find_or_create_owner(str(owner_name), owner_phone)

        existing = await Property.find_one(
            Property.row_letter == row_letter.upper(),
            Property.number == number,
            Property.villa == villa
        )
        if existing:
            owners = (
                await Owner.find({"_id": {"$in": existing.owners}}).to_list()
                if existing.owners
                else []
            )
            if not any(str(item.id) == str(owner.id) for item in owners):
                owners.append(owner)
            assign_owners(existing, owners, str(owner.id))
            await existing.save()
            updated += 1
        else:
            prop = Property(
                row_letter=row_letter.upper(),
                number=number,
                villa=villa,
                owner_name="Sin propietario",
            )
            assign_owners(prop, [owner], str(owner.id))
            await prop.insert()
            imported += 1

    return {"imported": imported, "updated": updated, "errors": errors}
