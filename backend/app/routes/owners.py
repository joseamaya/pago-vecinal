from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional

from ..models.owner import Owner
from ..models.property import Property
from ..models.user import User, UserRole
from ..schemas.owner import OwnerCreate, OwnerUpdate, OwnerResponse
from ..dependencies.auth import require_admin
from ..services.ownership_service import sync_owner_cache, validate_user_link
from ..utils.links import link_id
from ..utils.names import person_name_key

router = APIRouter()


def _owner_response(owner: Owner) -> OwnerResponse:
    return OwnerResponse(
        id=str(owner.id),
        full_name=owner.full_name,
        phone=owner.phone,
        email=owner.email,
        user_id=link_id(owner.user),
        is_active=owner.is_active,
    )


async def _get_owner(owner_id: str) -> Owner:
    owner = await Owner.get(owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )
    return owner


async def _get_linkable_user(user_id: str) -> User:
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no encontrado",
        )
    if user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario seleccionado no es propietario",
        )
    return user


@router.get("/", response_model=List[OwnerResponse])
async def get_owners(
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
):
    owners = await Owner.find_all().to_list()

    if search:
        term = search.strip().lower()
        name_term = person_name_key(search)
        owners = [
            owner
            for owner in owners
            if name_term in person_name_key(owner.full_name)
            or term in (owner.phone or "").lower()
            or term in (str(owner.email) if owner.email else "").lower()
        ]

    return [_owner_response(owner) for owner in owners]


@router.post("/", response_model=OwnerResponse, status_code=status.HTTP_201_CREATED)
async def create_owner(
    owner_data: OwnerCreate,
    current_user: User = Depends(require_admin),
):
    owner = Owner(
        full_name=owner_data.full_name,
        phone=owner_data.phone,
        email=owner_data.email,
    )

    if owner_data.user_id:
        user = await _get_linkable_user(owner_data.user_id)
        try:
            await validate_user_link(owner, user)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        owner.user = user

    await owner.insert()
    return _owner_response(owner)


@router.get("/{owner_id}", response_model=OwnerResponse)
async def get_owner(
    owner_id: str,
    current_user: User = Depends(require_admin),
):
    return _owner_response(await _get_owner(owner_id))


@router.put("/{owner_id}", response_model=OwnerResponse)
async def update_owner(
    owner_id: str,
    owner_update: OwnerUpdate,
    current_user: User = Depends(require_admin),
):
    owner = await _get_owner(owner_id)
    update_data = owner_update.model_dump(exclude_unset=True)

    if "user_id" in update_data:
        user_id = update_data.pop("user_id")
        if user_id:
            user = await _get_linkable_user(user_id)
            try:
                await validate_user_link(owner, user)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                )
            owner.user = user
        else:
            owner.user = None

    for field, value in update_data.items():
        setattr(owner, field, value)

    await owner.save()
    await sync_owner_cache(owner)
    return _owner_response(owner)


@router.delete("/{owner_id}")
async def delete_owner(
    owner_id: str,
    current_user: User = Depends(require_admin),
):
    owner = await _get_owner(owner_id)
    linked_properties = await Property.find(
        {"$or": [{"owners": owner.id}, {"primary_owner": owner.id}]}
    ).count()
    if linked_properties:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El propietario está ligado a una o más propiedades",
        )

    await owner.delete()
    return {"message": "Propietario eliminado correctamente"}
