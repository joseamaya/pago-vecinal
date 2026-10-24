import pytest
from bson import DBRef, ObjectId
from mongomock_motor import AsyncMongoMockClient

from migrate_property_owners import find_or_create_owner, normalize_names


@pytest.fixture
def db():
    client = AsyncMongoMockClient()
    return client.test_migration


class TestFindOrCreateOwner:
    @pytest.mark.asyncio
    async def test_reused_owner_gets_legacy_user_link(self, db):
        owner_id = ObjectId()
        user_ref = DBRef("users", ObjectId())
        await db.owners.insert_one(
            {
                "_id": owner_id,
                "full_name": "Jose Perez",
                "phone": "555-111",
                "user": None,
                "is_active": True,
            }
        )

        returned_id, created = await find_or_create_owner(
            db, "JOSE PEREZ", "555-111", user_ref
        )

        assert returned_id == owner_id
        assert created is False
        owner = await db.owners.find_one({"_id": owner_id})
        assert owner["user"] == user_ref

    @pytest.mark.asyncio
    async def test_placeholder_name_uses_linked_user_name(self, db):
        user_ref = DBRef("users", ObjectId())

        owner_id, created = await find_or_create_owner(
            db, "Sin propietario", None, user_ref, "MARÍA LÓPEZ"
        )

        assert created is True
        owner = await db.owners.find_one({"_id": owner_id})
        assert owner["full_name"] == "María López"
        assert owner["user"] == user_ref


class TestNormalizeNames:
    @pytest.mark.asyncio
    async def test_repairs_primary_owner_and_property_cache(self, db):
        owner_id = ObjectId()
        property_id = ObjectId()
        await db.owners.insert_one(
            {
                "_id": owner_id,
                "full_name": "JOSE PEREZ",
                "phone": "555-111",
                "is_active": True,
            }
        )
        await db.properties.insert_one(
            {
                "_id": property_id,
                "villa": "Villa 1",
                "owners": [owner_id],
                "owner_name": "JOSE PEREZ",
            }
        )

        result = await normalize_names(db, apply=True)

        property_doc = await db.properties.find_one({"_id": property_id})
        owner = await db.owners.find_one({"_id": owner_id})
        assert owner["full_name"] == "Jose Perez"
        assert property_doc["primary_owner"] == owner_id
        assert property_doc["owner_name"] == "Jose Perez"
        assert result["owners"] == 1
        assert result["properties"] == 1
