from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List
from pydantic import BaseModel
from ..models.property import Property, PropertyCreate, PropertyUpdate, PropertyResponse
from ..models.user import User, UserRole
from ..routes.auth import get_current_user
import openpyxl

class BulkImportResponse(BaseModel):
    imported: int
    errors: List[str]

router = APIRouter()

@router.get("/", response_model=List[PropertyResponse])
async def get_properties(current_user: User = Depends(get_current_user)):
    properties = await Property.find_all().to_list()
    return [
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

        imported = 0
        errors = []

        # Skip header row
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

            # Check if property already exists
            existing = await Property.find_one(
                Property.row_letter == row_letter.upper(),
                Property.number == number,
                Property.villa == villa
            )
            if existing:
                errors.append(f"Row {row_idx}: Property already exists")
                continue

            prop = Property(
                row_letter=row_letter.upper(),
                number=number,
                villa=villa,
                owner_name=owner_name,
                owner_phone=owner_phone
            )
            await prop.insert()
            imported += 1

        return BulkImportResponse(imported=imported, errors=errors)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing file: {str(e)}"
        )