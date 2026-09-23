from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from ..models.property import Property
from ..schemas.property import PropertyCreate, PropertyUpdate, PropertyResponse
from ..models.user import User, UserRole
from ..dependencies.auth import get_current_user, require_admin
from ..services.property_service import bulk_import_property_rows
import logging
import openpyxl

logger = logging.getLogger(__name__)

class BulkImportResponse(BaseModel):
    imported: int
    updated: int
    errors: List[str]

class PaginatedPropertyResponse(BaseModel):
    data: List[PropertyResponse]
    pagination: dict

router = APIRouter()

@router.get("/", response_model=PaginatedPropertyResponse)
async def get_properties(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    # Build query
    query = {}
    if current_user.role != UserRole.ADMIN:
        # Owners can only see their own properties
        query["owner.id"] = current_user.id

    # Get total count
    total_count = await Property.find(query).count()

    # Calculate skip
    skip = (page - 1) * limit

    # Get paginated results
    properties = await Property.find(query).skip(skip).limit(limit).to_list()

    # Calculate total pages
    total_pages = (total_count + limit - 1) // limit

    property_responses = [
        PropertyResponse(
            id=str(prop.id),
            row_letter=prop.row_letter,
            number=prop.number,
            villa=prop.villa,
            owner_name=prop.owner_name,
            owner_phone=prop.owner_phone,
            owner_id=str(prop.owner.id) if prop.owner else None
        )
        for prop in properties
    ]

    return PaginatedPropertyResponse(
        data=property_responses,
        pagination={
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages
        }
    )

@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: str, current_user: User = Depends(get_current_user)):
    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    return PropertyResponse(
        id=str(prop.id),
        row_letter=prop.row_letter,
        number=prop.number,
        villa=prop.villa,
        owner_name=prop.owner_name,
        owner_phone=prop.owner_phone,
        owner_id=str(prop.owner.id) if prop.owner else None
    )

@router.post("/", response_model=PropertyResponse)
async def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if property already exists
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

    prop = Property(
        row_letter=property_data.row_letter,
        number=property_data.number,
        villa=property_data.villa,
        owner_name=property_data.owner_name,
        owner_phone=property_data.owner_phone
    )
    await prop.insert()
    return PropertyResponse(
        id=str(prop.id),
        row_letter=prop.row_letter,
        number=prop.number,
        villa=prop.villa,
        owner_name=prop.owner_name,
        owner_phone=prop.owner_phone
    )

@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: str,
    property_update: PropertyUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Update fields
    update_data = property_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prop, field, value)

    await prop.save()
    return PropertyResponse(
        id=str(prop.id),
        row_letter=prop.row_letter,
        number=prop.number,
        villa=prop.villa,
        owner_name=prop.owner_name,
        owner_phone=prop.owner_phone,
        owner_id=str(prop.owner.id) if prop.owner else None
    )

@router.delete("/{property_id}")
async def delete_property(property_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    prop = await Property.get(property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    await prop.delete()
    return {"message": "Property deleted successfully"}

@router.get("/distinct/letters", response_model=List[str])
async def get_distinct_letters(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        # Owners can only see their own properties
        properties = await Property.find(Property.owner.id == current_user.id).to_list()
    else:
        properties = await Property.find_all().to_list()

    letters = list(set(prop.row_letter for prop in properties))
    return sorted(letters)

@router.get("/distinct/numbers", response_model=List[int])
async def get_distinct_numbers(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        # Owners can only see their own properties
        properties = await Property.find(Property.owner.id == current_user.id).to_list()
    else:
        properties = await Property.find_all().to_list()

    numbers = list(set(prop.number for prop in properties))
    return sorted(numbers)

@router.get("/by-letter-number/", response_model=PropertyResponse)
async def get_property_by_letter_number(
    row_letter: str,
    number: int,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        prop = await Property.find_one(
            Property.row_letter == row_letter,
            Property.number == number,
            Property.owner.id == current_user.id
        )
    else:
        prop = await Property.find_one(
            Property.row_letter == row_letter,
            Property.number == number
        )

    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    return PropertyResponse(
        id=str(prop.id),
        row_letter=prop.row_letter,
        number=prop.number,
        villa=prop.villa,
        owner_name=prop.owner_name,
        owner_phone=prop.owner_phone,
        owner_id=str(prop.owner.id) if prop.owner else None
    )

@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_properties(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )

    try:
        workbook = openpyxl.load_workbook(file.file)
        sheet = workbook.active

        results = await bulk_import_property_rows(sheet)
        return BulkImportResponse(**results)

    except Exception:
        logger.exception("Error processing properties import file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing file"
        )