from fastapi import APIRouter, Depends, HTTPException, status
from ..models.treasurer import Treasurer, TreasurerCreate, TreasurerUpdate, TreasurerResponse
from ..models.user import User, UserRole
from ..routes.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=TreasurerResponse)
async def get_treasurer(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurer = await Treasurer.find_one()
    if not treasurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treasurer not configured"
        )

    return TreasurerResponse(
        id=str(treasurer.id),
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

    # Check if treasurer already exists
    existing_treasurer = await Treasurer.find_one()
    if existing_treasurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Treasurer already configured. Use PUT to update."
        )

    treasurer = Treasurer(
        name=treasurer_data.name,
        signature=treasurer_data.signature
    )
    await treasurer.insert()

    return TreasurerResponse(
        id=str(treasurer.id),
        name=treasurer.name,
        signature=treasurer.signature
    )

@router.put("/", response_model=TreasurerResponse)
async def update_treasurer(
    treasurer_data: TreasurerUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    treasurer = await Treasurer.find_one()
    if not treasurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treasurer not configured"
        )

    # Update fields
    update_data = treasurer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(treasurer, field, value)

    await treasurer.save()

    return TreasurerResponse(
        id=str(treasurer.id),
        name=treasurer.name,
        signature=treasurer.signature
    )