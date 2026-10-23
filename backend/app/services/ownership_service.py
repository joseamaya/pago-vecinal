from typing import Iterable, List, Optional

from bson import DBRef
from beanie import PydanticObjectId

from ..models.owner import Owner
from ..models.property import Property
from ..models.user import User, UserRole
from ..utils.links import link_id

NO_OWNER_NAME = "Sin propietario"


def _user_ref(user_id) -> DBRef:
    return DBRef("users", PydanticObjectId(str(user_id)))


async def owners_for_user(user: User) -> List[Owner]:
    return await Owner.find({"user": _user_ref(user.id)}).to_list()


async def owned_properties(user: User) -> List[Property]:
    if user.role == UserRole.ADMIN:
        return await Property.find_all().to_list()

    owners = await owners_for_user(user)
    if not owners:
        return []

    owner_ids = [owner.id for owner in owners]
    return await Property.find({"owners": {"$in": owner_ids}}).to_list()


async def owned_property_ids(user: User) -> set[str]:
    properties = await owned_properties(user)
    return {str(prop.id) for prop in properties}


async def user_owns_property(user: User, prop: Optional[Property]) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if prop is None or not prop.owners:
        return False

    owners = await Owner.find({"_id": {"$in": prop.owners}}).to_list()
    user_id = str(user.id)
    return any(link_id(owner.user) == user_id for owner in owners)


async def resolve_owners(owner_ids: Optional[Iterable[str]]) -> List[Owner]:
    resolved: List[Owner] = []
    seen = set()

    for owner_id in owner_ids or []:
        if not owner_id or owner_id in seen:
            continue
        seen.add(owner_id)
        owner = await Owner.get(owner_id)
        if not owner:
            raise ValueError("Propietario no encontrado")
        resolved.append(owner)

    return resolved


def assign_owners(prop: Property, owners: List[Owner], primary_owner_id: Optional[str] = None) -> None:
    owner_ids = [str(owner.id) for owner in owners]

    if primary_owner_id and primary_owner_id not in owner_ids:
        raise ValueError("El propietario principal debe estar entre los propietarios")

    primary = None
    if primary_owner_id:
        primary = next(owner for owner in owners if str(owner.id) == primary_owner_id)
    elif owners:
        primary = owners[0]

    prop.owners = [owner.id for owner in owners]
    prop.primary_owner = primary.id if primary else None
    prop.owner_name = primary.full_name if primary else NO_OWNER_NAME
    prop.owner_phone = primary.phone if primary else None


async def primary_user_for_property(prop: Property) -> Optional[User]:
    primary_id = prop.primary_owner
    if primary_id is None and prop.owners:
        primary_id = prop.owners[0]

    owner = await Owner.get(primary_id) if primary_id else None
    if not owner or not owner.user:
        return None

    return await User.get(link_id(owner.user))


async def validate_user_link(owner: Owner, user: User) -> None:
    if user.role != UserRole.OWNER:
        raise ValueError("El usuario seleccionado no es propietario")

    existing = await Owner.find_one({"user": _user_ref(user.id)})
    if existing and str(existing.id) != str(owner.id):
        raise ValueError("El usuario ya está ligado a otro propietario")


async def sync_owner_cache(owner: Owner) -> None:
    properties = await Property.find({"primary_owner": owner.id}).to_list()
    for prop in properties:
        prop.owner_name = owner.full_name
        prop.owner_phone = owner.phone
        await prop.save()
