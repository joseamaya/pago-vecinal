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
    async def test_create_duplicate_fails(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        response = await client.post(
            "/properties/",
            json={
                "row_letter": "A",
                "number": 1,
                "villa": "Villa 1",
                "owner_name": "Duplicate",
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
                "owner_name": "New",
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
            json={"owner_name": "Updated Owner"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["owner_name"] == "Updated Owner"

    @pytest.mark.asyncio
    async def test_update_property_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/properties/507f1f77bcf86cd799439999",
            json={"owner_name": "Updated"},
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
