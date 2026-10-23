from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Literal, Optional
from beanie import PydanticObjectId

from ..models.owner import Owner
from ..models.property import Property
from ..models.user import User, UserRole
from ..schemas.owner import OwnerSummary
from ..schemas.property import PropertyCreate, PropertyUpdate, PropertyResponse
from ..schemas.common import PaginatedResponse, PropertyBulkImportResponse
from ..dependencies.auth import get_current_user, require_admin
from ..services.ownership_service import (
    assign_owners,
    owned_properties,
    owned_property_ids,
    resolve_owners,
    user_owns_property,
)
from ..services.property_service import bulk_import_property_rows
from ..utils.query import combine_filters, sort_spec, text_search_clauses
from ..utils.uploads import (
    validate_upload,
    EXCEL_EXTENSIONS,
    EXCEL_CONTENT_TYPES,
    MAX_EXCEL_MB,
)
import logging
import openpyxl

logger = logging.getLogger(__name__)

router = APIRouter()

PROPERTY_SORTS = {
    "villa": "villa",
    "row_letter": "row_letter",
    "number": "number",
    "owner_name": "owner_name",
}


async def _property_response(prop: Property) -> PropertyResponse:
    owner_ids = prop.owners
    owners = await Owner.find({"_id": {"$in": owner_ids}}).to_list() if owner_ids else []
    owners_by_id = {str(owner.id): owner for owner in owners}
    summaries = []
    for owner_id in owner_ids:
        owner = owners_by_id.get(str(owner_id))
        if owner:
            summaries.append(
                OwnerSummary(id=str(owner.id), full_name=owner.full_name, phone=owner.phone)
            )

    return PropertyResponse(
        id=str(prop.id),
        row_letter=prop.row_letter,
        number=prop.number,
        villa=prop.villa,
        owner_name=prop.owner_name,
        owner_phone=prop.owner_phone,
        primary_owner_id=str(prop.primary_owner) if prop.primary_owner else None,
        owners=summaries,
    )


@router.get("/", response_model=PaginatedResponse[PropertyResponse])
async def get_properties(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[Literal["villa", "row_letter", "number", "owner_name"]] = None,
    sort_dir: Optional[Literal["asc", "desc"]] = None,
    current_user: User = Depends(get_current_user)
):
    filters = []
    if current_user.role != UserRole.ADMIN:
        owned_ids = await owned_property_ids(current_user)
        if not owned_ids:
            filters.append({"_id": None})
        else:
            filters.append({"_id": {"$in": [PydanticObjectId(oid) for oid in owned_ids]}})

    search_clauses = text_search_clauses(
        search,
        ["villa", "row_letter", "owner_name", "owner_phone"],
        numeric_field="number",
    )
    if search_clauses:
        filters.append({"$or": search_clauses})

    query = combine_filters(*filters)
    property_query = Property.find(query)
    spec = sort_spec(sort_by, sort_dir, PROPERTY_SORTS)
    if spec:
        property_query = property_query.sort(spec)

    total_count = await property_query.count()
    skip = (page - 1) * limit
    properties = await property_query.skip(skip).limit(limit).to_list()
    total_pages = (total_count + limit - 1) // limit

    property_responses = [await _property_response(prop) for prop in properties]

    return PaginatedResponse[PropertyResponse](
        data=property_responses,
        pagination={
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages
        }
    )


@router.post("/", response_model=PropertyResponse)
async def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(require_admin)
):
    existing = await Property.find_one(
        Property.row_letter == property_data.row_letter,
        Property.number == property_data.number,
        Property.villa == property_data.villa
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property already exists"
        )

    try:
        owners = await resolve_owners(property_data.owner_ids)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    prop = Property(
        row_letter=property_data.row_letter,
        number=property_data.number,
        villa=property_data.villa,
        owner_name="Sin propietario",
    )
    try:
        assign_owners(prop, owners, property_data.primary_owner_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    await prop.insert()
    return await _property_response(prop)


@router.post("/bulk-import", response_model=PropertyBulkImportResponse)
async def bulk_import_properties(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin)
):
    await validate_upload(file, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, MAX_EXCEL_MB)

    try:
        workbook = openpyxl.load_workbook(file.file)
        sheet = workbook.active

        results = await bulk_import_property_rows(sheet)
        return PropertyBulkImportResponse(**results)

    except Exception:
        logger.exception("Error processing properties import file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing file"
        )


@router.get("/distinct/letters", response_model=List[str])
async def get_distinct_letters(current_user: User = Depends(get_current_user)):
    properties = await owned_properties(current_user)
    letters = list(set(prop.row_letter for prop in properties))
    return sorted(letters)


@router.get("/distinct/numbers", response_model=List[int])
async def get_distinct_numbers(current_user: User = Depends(get_current_user)):
    properties = await owned_properties(current_user)
    numbers = list(set(prop.number for prop in properties))
    return sorted(numbers)


@router.get("/by-letter-number/", response_model=PropertyResponse)
async def get_property_by_letter_number(
    row_letter: str,
    number: int,
    current_user: User = Depends(get_current_user)
):
    properties = await owned_properties(current_user)
    prop = next(
        (item for item in properties if item.row_letter == row_letter and item.number == number),
        None,
    )

    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    return await _property_response(prop)


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: str, current_user: User = Depends(get_current_user)):
    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    if not await user_owns_property(current_user, prop):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return await _property_response(prop)


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: str,
    property_update: PropertyUpdate,
    current_user: User = Depends(require_admin)
):
    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    update_data = property_update.model_dump(exclude_unset=True)
    owner_ids = update_data.pop("owner_ids", None)
    primary_owner_id = update_data.pop("primary_owner_id", None)
    owners_changed = owner_ids is not None or primary_owner_id is not None

    if owners_changed:
        try:
            if owner_ids is None:
                owner_ids = [str(owner_id) for owner_id in prop.owners]
            owners = await resolve_owners(owner_ids)
            assign_owners(prop, owners, primary_owner_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    for field, value in update_data.items():
        setattr(prop, field, value)

    await prop.save()
    return await _property_response(prop)


@router.delete("/{property_id}")
async def delete_property(property_id: str, current_user: User = Depends(require_admin)):
    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    await prop.delete()
    return {"message": "Property deleted successfully"}
