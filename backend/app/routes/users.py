from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from bson import DBRef
from ..models.owner import Owner
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserResponse, PasswordChange
from ..dependencies.auth import get_current_user, require_admin, require_owner
from ..auth.utils import get_password_hash, verify_password

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(require_admin)):
    users = await User.find_all().to_list()
    return [
        UserResponse(
            id=str(user.id),
            email=user.email,
            role=user.role,
            full_name=user.full_name,
            phone=user.phone,
            is_active=user.is_active
        )
        for user in users
    ]

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
):
    existing_user = await User.find_one(User.email == user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        phone=user_data.phone,
    )
    await user.insert()
    return UserResponse(
        id=str(user.id),
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        full_name=current_user.full_name,
        phone=current_user.phone,
        is_active=current_user.is_active
    )

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    require_owner(current_user, user_id)
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UserResponse(
        id=str(user.id),
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active
    )

@router.put("/me/password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
):
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta",
        )
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres",
        )
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe ser diferente a la actual",
        )

    current_user.password_hash = get_password_hash(password_data.new_password)
    await current_user.save()
    return {"message": "Contraseña actualizada correctamente"}


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user, user_id)
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await user.save()
    return UserResponse(
        id=str(user.id),
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active
    )

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(require_admin)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    linked_owners = await Owner.find({"user": DBRef("users", user.id)}).to_list()
    for owner in linked_owners:
        owner.user = None
        await owner.save()

    await user.delete()
    return {"message": "User deleted successfully"}
