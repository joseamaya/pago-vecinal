import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List
import os
import shutil
from ..models.treasurer import Treasurer
from ..schemas.treasurer import TreasurerCreate, TreasurerUpdate, TreasurerResponse

logger = logging.getLogger(__name__)
from ..models.user import User, UserRole
from ..dependencies.auth import get_current_user, require_admin

router = APIRouter()

@router.get("/", response_model=List[TreasurerResponse])
async def get_treasurers(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurers = await Treasurer.find_all().to_list()
    return [
        TreasurerResponse(
            id=str(treasurer.id),
            villa=treasurer.villa,
            name=treasurer.name,
            signature=treasurer.signature
        )
        for treasurer in treasurers
    ]

@router.get("/{villa}", response_model=TreasurerResponse)
async def get_treasurer_by_villa(
    villa: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurer = await Treasurer.find_one(Treasurer.villa == villa)
    if not treasurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Treasurer not configured for villa {villa}"
        )

    return TreasurerResponse(
        id=str(treasurer.id),
        villa=treasurer.villa,
        name=treasurer.name,
        signature=treasurer.signature
    )

@router.post("/", response_model=TreasurerResponse)
async def create_treasurer(
    treasurer_data: TreasurerCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Check if treasurer already exists for this villa
    existing_treasurer = await Treasurer.find_one(Treasurer.villa == treasurer_data.villa)
    if existing_treasurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Treasurer already configured for villa {treasurer_data.villa}. Use PUT to update."
        )

    treasurer = Treasurer(
        villa=treasurer_data.villa,
        name=treasurer_data.name,
        signature=treasurer_data.signature
    )
    await treasurer.insert()

    return TreasurerResponse(
        id=str(treasurer.id),
        villa=treasurer.villa,
        name=treasurer.name,
        signature=treasurer.signature
    )

@router.put("/{villa}", response_model=TreasurerResponse)
async def update_treasurer(
    villa: str,
    treasurer_data: TreasurerUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurer = await Treasurer.find_one(Treasurer.villa == villa)
    if not treasurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Treasurer not configured for villa {villa}"
        )

    # Update fields
    update_data = treasurer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(treasurer, field, value)

    await treasurer.save()

    return TreasurerResponse(
        id=str(treasurer.id),
        villa=treasurer.villa,
        name=treasurer.name,
        signature=treasurer.signature
    )

@router.delete("/{villa}")
async def delete_treasurer(
    villa: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurer = await Treasurer.find_one(Treasurer.villa == villa)
    if not treasurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Treasurer not found for villa {villa}"
        )

    # Delete signature file if exists
    if treasurer.signature and os.path.exists(treasurer.signature):
        try:
            os.remove(treasurer.signature)
        except Exception as e:
            logger.error("Error deleting signature file %s: %s", treasurer.signature, e)

    await treasurer.delete()
    return {"message": f"Treasurer for villa {villa} deleted successfully"}

@router.post("/upload-signature")
async def upload_signature(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Ensure signatures directory exists
    signatures_dir = os.path.join("static", "signatures")
    os.makedirs(signatures_dir, exist_ok=True)

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Save file
    file_path = os.path.join(signatures_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"file_path": file_path}