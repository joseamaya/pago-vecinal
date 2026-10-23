#!/usr/bin/env python3
"""Migrate legacy single-owner properties and normalize person names.

Usage:
    python migrate_property_owners.py            # dry run
    python migrate_property_owners.py --apply    # apply changes
"""

import argparse
import asyncio
import os

from bson import DBRef
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.utils.names import normalize_person_name, person_name_key

load_dotenv()


def normalize_name(value):
    return normalize_person_name(value or "")


async def find_or_create_owner(db, name, phone, user_ref):
    name = normalize_name(name)

    if user_ref is not None:
        owner = await db.owners.find_one({"user": user_ref})
        if owner:
            return owner["_id"], False

    key = person_name_key(name)
    async for owner in db.owners.find({}):
        if (
            person_name_key(owner.get("full_name")) == key
            and (owner.get("phone") or "") == (phone or "")
        ):
            return owner["_id"], False

    result = await db.owners.insert_one(
        {
            "full_name": name,
            "phone": phone,
            "email": None,
            "user": user_ref,
            "is_active": True,
        }
    )
    return result.inserted_id, True


async def normalize_collection(db, collection_name, field, apply):
    updated = 0
    async for document in db[collection_name].find({}):
        current = document.get(field)
        normalized = normalize_name(current)
        if current is not None and normalized != current:
            updated += 1
            if apply:
                await db[collection_name].update_one(
                    {"_id": document["_id"]},
                    {"$set": {field: normalized}},
                )
    return updated


async def normalize_names(db, apply):
    owner_names = {}
    async for owner in db.owners.find({}):
        owner_names[owner["_id"]] = normalize_name(owner.get("full_name"))

    owners_updated = await normalize_collection(db, "owners", "full_name", apply)
    users_updated = await normalize_collection(db, "users", "full_name", apply)
    treasurers_updated = await normalize_collection(db, "treasurers", "name", apply)

    properties_updated = 0
    async for prop in db.properties.find({}):
        primary_owner = prop.get("primary_owner")
        if primary_owner is None and prop.get("owners"):
            primary_owner = prop["owners"][0]

        current = prop.get("owner_name")
        if primary_owner is not None:
            normalized = owner_names.get(primary_owner)
        else:
            normalized = normalize_name(current)

        if current is not None and normalized is not None and normalized != current:
            properties_updated += 1
            if apply:
                await db.properties.update_one(
                    {"_id": prop["_id"]},
                    {"$set": {"owner_name": normalized}},
                )

    duplicate_groups = {}
    async for owner in db.owners.find({}):
        key = person_name_key(owner.get("full_name"))
        if key:
            duplicate_groups.setdefault(key, []).append(owner.get("full_name"))

    duplicates = {
        key: names for key, names in duplicate_groups.items() if len(names) > 1
    }

    print(
        "Names: "
        f"owners={owners_updated} users={users_updated} "
        f"treasurers={treasurers_updated} properties={properties_updated}"
    )
    if duplicates:
        print("Possible duplicate owners (not merged automatically):")
        for names in duplicates.values():
            print(f"  - {' | '.join(names)}")

    return {
        "owners": owners_updated,
        "users": users_updated,
        "treasurers": treasurers_updated,
        "properties": properties_updated,
        "duplicates": duplicates,
    }


async def migrate(apply: bool):
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "pago_vecinal")

    client = AsyncIOMotorClient(mongodb_url)
    db = client[database_name]

    print(f"Starting owner migration on {database_name} ({'apply' if apply else 'dry run'})...")

    migrated = 0
    skipped = 0
    created_owners = 0

    async for prop in db.properties.find({}):
        if prop.get("owners"):
            skipped += 1
            continue

        name = prop.get("owner_name") or "Sin propietario"
        phone = prop.get("owner_phone")
        legacy_owner = prop.get("owner")
        user_ref = legacy_owner if isinstance(legacy_owner, DBRef) else None

        if not apply:
            owner_id = None
            if user_ref is not None:
                owner_id = await db.owners.find_one({"user": user_ref})
            if owner_id is None:
                key = person_name_key(name)
                async for owner in db.owners.find({}):
                    if (
                        person_name_key(owner.get("full_name")) == key
                        and (owner.get("phone") or "") == (phone or "")
                    ):
                        owner_id = owner
                        break
            action = "reuse" if owner_id else "create"
            print(f"  property {prop['_id']}: {action} owner '{normalize_name(name)}'")
            migrated += 1
            continue

        owner_id, created = await find_or_create_owner(db, name, phone, user_ref)
        created_owners += int(created)

        await db.properties.update_one(
            {"_id": prop["_id"]},
            {
                "$set": {
                    "owners": [owner_id],
                    "primary_owner": owner_id,
                    "owner_name": normalize_name(name),
                    "owner_phone": phone,
                },
                "$unset": {"owner": ""},
            },
        )
        migrated += 1

    print(
        f"Property owners: migrated={migrated} skipped={skipped} "
        f"created_owners={created_owners}"
    )

    await normalize_names(db, apply)
    print("Dry run complete. Re-run with --apply to write changes." if not apply else "Migration complete.")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply the migration")
    args = parser.parse_args()
    asyncio.run(migrate(args.apply))
