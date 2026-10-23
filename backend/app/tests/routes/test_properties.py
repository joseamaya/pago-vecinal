import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies.auth import get_current_user


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


@pytest.fixture
def override_auth_as_admin(mock_user):
    async def override():
        return mock_user

    app.dependency_overrides[get_current_user] = override
    yield
    app.dependency_overrides.clear()


class TestListProperties:
    @pytest.mark.asyncio
    async def test_returns_paginated_properties(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.get("/properties/?page=1&limit=20", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["row_letter"] == "A"


    @pytest.mark.asyncio
    async def test_owner_only_sees_own_properties(
        self, client, mongomock_db, test_property, test_owner, test_other_owner, auth_headers_owner
    ):
        from app.models.property import Property

        own_property = Property(
            row_letter="B",
            number=2,
            villa="Villa 2",
            owner_name="Owner User",
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        )
        await own_property.insert()
        other_property = Property(
            row_letter="C",
            number=3,
            villa="Villa 3",
            owner_name="Other Owner",
            owners=[test_other_owner.id],
            primary_owner=test_other_owner.id,
        )
        await other_property.insert()

        response = await client.get("/properties/?page=1&limit=20", headers=auth_headers_owner)
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["row_letter"] == "B"
        assert data[0]["primary_owner_id"] == str(test_owner.id)
        assert data[0]["owners"][0]["id"] == str(test_owner.id)

    @pytest.mark.asyncio
    async def test_multiple_owners_can_see_the_property(
        self, client, mongomock_db, test_owner, test_other_owner,
        auth_headers_owner, auth_headers_other_owner,
    ):
        from app.models.property import Property

        prop = Property(
            row_letter="B",
            number=2,
            villa="Villa Compartida",
            owner_name=test_owner.full_name,
            owners=[test_owner.id, test_other_owner.id],
            primary_owner=test_owner.id,
        )
        await prop.insert()

        for headers in (auth_headers_owner, auth_headers_other_owner):
            response = await client.get(
                "/properties/?page=1&limit=20", headers=headers
            )
            assert response.status_code == 200
            assert [item["id"] for item in response.json()["data"]] == [str(prop.id)]

    @pytest.mark.asyncio
    async def test_search_matches_owner_and_villa(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.get(
            "/properties/?search=property%20owner", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert len(response.json()["data"]) == 1

        response = await client.get("/properties/?search=Villa%201", headers=auth_headers_admin)
        assert response.status_code == 200
        assert len(response.json()["data"]) == 1

        response = await client.get("/properties/?search=missing", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json()["data"] == []

    @pytest.mark.asyncio
    async def test_search_matches_number_and_sorts(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        from app.models.property import Property

        await Property(
            row_letter="B",
            number=2,
            villa="Villa 2",
            owner_name="Second Owner",
        ).insert()

        response = await client.get("/properties/?search=2", headers=auth_headers_admin)
        assert response.status_code == 200
        assert [item["number"] for item in response.json()["data"]] == [2]

        response = await client.get(
            "/properties/?sort_by=number&sort_dir=desc", headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert [item["number"] for item in response.json()["data"]] == [2, 1]

    @pytest.mark.asyncio
    async def test_owner_search_keeps_owner_scoping(
        self,
        client,
        mongomock_db,
        test_property,
        test_owner,
        test_other_owner,
        auth_headers_owner,
    ):
        from app.models.property import Property

        own_property = Property(
            row_letter="B",
            number=2,
            villa="Villa Shared",
            owner_name="Owner User",
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        )
        await own_property.insert()
        await Property(
            row_letter="C",
            number=3,
            villa="Villa Shared",
            owner_name="Other Owner",
            owners=[test_other_owner.id],
            primary_owner=test_other_owner.id,
        ).insert()

        response = await client.get(
            "/properties/?search=Villa%20Shared", headers=auth_headers_owner
        )
        assert response.status_code == 200
        assert [item["id"] for item in response.json()["data"]] == [str(own_property.id)]

    @pytest.mark.asyncio
    async def test_invalid_sort_is_rejected(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/properties/?sort_by=unknown", headers=auth_headers_admin
        )
        assert response.status_code == 422


class TestCreateProperty:
    @pytest.mark.asyncio
    async def test_creates_property(self, client, mongomock_db, auth_headers_admin):
        from app.models.property import Property

        response = await client.post(
            "/properties/",
            json={
                "row_letter": "B",
                "number": 2,
                "villa": "Villa 2",
                "owner_name": "New Owner",
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["row_letter"] == "B"
        assert data["villa"] == "Villa 2"

        props = await Property.find_all().to_list()
        assert len(props) == 1

    @pytest.mark.asyncio
    async def test_creates_property_with_owner(
        self, client, mongomock_db, test_owner, auth_headers_admin
    ):
        from app.models.property import Property

        response = await client.post(
            "/properties/",
            json={
                "row_letter": "D",
                "number": 4,
                "villa": "Villa 4",
                "owner_ids": [str(test_owner.id)],
                "primary_owner_id": str(test_owner.id),
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["primary_owner_id"] == str(test_owner.id)
        assert data["owner_name"] == test_owner.full_name

        prop = await Property.find_one(Property.row_letter == "D")
        assert prop.owners == [test_owner.id]
        assert prop.primary_owner == test_owner.id

    @pytest.mark.asyncio
    async def test_creates_property_with_multiple_owners(
        self, client, mongomock_db, test_owner, test_other_owner, auth_headers_admin
    ):
        from app.models.property import Property

        response = await client.post(
            "/properties/",
            json={
                "row_letter": "H",
                "number": 8,
                "villa": "Villa 8",
                "owner_ids": [str(test_owner.id), str(test_other_owner.id)],
                "primary_owner_id": str(test_other_owner.id),
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["primary_owner_id"] == str(test_other_owner.id)
        assert data["owner_name"] == test_other_owner.full_name
        assert {owner["id"] for owner in data["owners"]} == {
            str(test_owner.id),
            str(test_other_owner.id),
        }

        prop = await Property.find_one(Property.row_letter == "H")
        assert prop.owners == [test_owner.id, test_other_owner.id]

    @pytest.mark.asyncio
    async def test_primary_owner_must_be_selected(
        self, client, mongomock_db, test_owner, test_other_owner, auth_headers_admin
    ):
        response = await client.post(
            "/properties/",
            json={
                "row_letter": "I",
                "number": 9,
                "villa": "Villa 9",
                "owner_ids": [str(test_owner.id)],
                "primary_owner_id": str(test_other_owner.id),
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_create_with_unknown_owner_fails(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.post(
            "/properties/",
            json={
                "row_letter": "E",
                "number": 5,
                "villa": "Villa 5",
                "owner_ids": ["507f1f77bcf86cd799439999"],
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 400
        assert "propietario" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_duplicate_fails(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.post(
            "/properties/",
            json={
                "row_letter": "A",
                "number": 1,
                "villa": "Villa 1",
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_owner_cannot_create(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/properties/",
            json={
                "row_letter": "B",
                "number": 2,
                "villa": "Villa 2",
            },
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestGetProperty:
    @pytest.mark.asyncio
    async def test_returns_single_property(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        prop_id = str(test_property.id)
        response = await client.get(f"/properties/{prop_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == prop_id
        assert data["row_letter"] == "A"

    @pytest.mark.asyncio
    async def test_get_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/properties/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestUpdateProperty:
    @pytest.mark.asyncio
    async def test_updates_property(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        prop_id = str(test_property.id)
        response = await client.put(
            f"/properties/{prop_id}",
            json={"villa": "Villa Updated"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["villa"] == "Villa Updated"

    @pytest.mark.asyncio
    async def test_assigns_owner(
        self, client, mongomock_db, test_property, test_owner, auth_headers_admin
    ):
        from app.models.property import Property

        response = await client.put(
            f"/properties/{test_property.id}",
            json={"owner_ids": [str(test_owner.id)], "primary_owner_id": str(test_owner.id)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.json()["primary_owner_id"] == str(test_owner.id)

        prop = await Property.get(test_property.id)
        assert prop.owners == [test_owner.id]
        assert prop.primary_owner == test_owner.id

    @pytest.mark.asyncio
    async def test_clears_owner(
        self, client, mongomock_db, test_owner, auth_headers_admin
    ):
        from app.models.property import Property

        prop = Property(
            row_letter="G",
            number=7,
            villa="Villa 7",
            owner_name=test_owner.full_name,
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        )
        await prop.insert()

        response = await client.put(
            f"/properties/{prop.id}",
            json={"owner_ids": []},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["primary_owner_id"] is None
        assert data["owner_name"] == "Sin propietario"

    @pytest.mark.asyncio
    async def test_update_with_unknown_owner_fails(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.put(
            f"/properties/{test_property.id}",
            json={"owner_ids": ["507f1f77bcf86cd799439999"]},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/properties/507f1f77bcf86cd799439999",
            json={"villa": "Updated"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_update(self, client, mongomock_db, test_property, auth_headers_owner):
        response = await client.put(
            f"/properties/{test_property.id}",
            json={"owner_name": "Hack"},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestDeleteProperty:
    @pytest.mark.asyncio
    async def test_admin_can_delete(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        from app.models.property import Property

        prop_id = str(test_property.id)
        response = await client.delete(f"/properties/{prop_id}", headers=auth_headers_admin)
        assert response.status_code == 200

        remaining = await Property.find_all().to_list()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_delete_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.delete(
            "/properties/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_cannot_delete(self, client, mongomock_db, test_property, auth_headers_owner):
        response = await client.delete(
            f"/properties/{test_property.id}", headers=auth_headers_owner
        )
        assert response.status_code == 403


class TestDistinctLetters:
    @pytest.mark.asyncio
    async def test_returns_distinct_letters(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.get("/properties/distinct/letters", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "A" in data


class TestDistinctNumbers:
    @pytest.mark.asyncio
    async def test_returns_distinct_numbers(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.get("/properties/distinct/numbers", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert 1 in data


class TestGetByLetterNumber:
    @pytest.mark.asyncio
    async def test_finds_by_letter_number(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.get(
            "/properties/by-letter-number/?row_letter=A&number=1",
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["villa"] == "Villa 1"

    @pytest.mark.asyncio
    async def test_by_letter_number_not_found(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/properties/by-letter-number/?row_letter=Z&number=99",
            headers=auth_headers_admin,
        )
        assert response.status_code == 404
