import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


class TestCreateOwner:
    @pytest.mark.asyncio
    async def test_admin_can_create(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/owners/",
            json={"full_name": "Ana Perez", "phone": "555-1111"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["full_name"] == "Ana Perez"
        assert data["phone"] == "555-1111"
        assert data["user_id"] is None

    @pytest.mark.asyncio
    async def test_admin_can_link_user(
        self, client, mongomock_db, test_owner_user, auth_headers_admin
    ):
        response = await client.post(
            "/owners/",
            json={"full_name": "Ana Perez", "user_id": str(test_owner_user.id)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 201
        assert response.json()["user_id"] == str(test_owner_user.id)

    @pytest.mark.asyncio
    async def test_cannot_link_non_owner_user(
        self, client, mongomock_db, test_user, auth_headers_admin
    ):
        response = await client.post(
            "/owners/",
            json={"full_name": "Ana Perez", "user_id": str(test_user.id)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400
        assert "propietario" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_owner_cannot_create(self, client, mongomock_db, auth_headers_owner):
        response = await client.post(
            "/owners/",
            json={"full_name": "Ana Perez"},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403


class TestUpdateOwner:
    @pytest.mark.asyncio
    async def test_updates_data_and_syncs_property_cache(
        self, client, mongomock_db, test_owner, auth_headers_admin
    ):
        from app.models.property import Property

        prop = Property(
            row_letter="A",
            number=1,
            villa="Villa 1",
            owner_name=test_owner.full_name,
            owner_phone=test_owner.phone,
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        )
        await prop.insert()

        response = await client.put(
            f"/owners/{test_owner.id}",
            json={"full_name": "Owner Renamed", "phone": "555-9999"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200

        refreshed = await Property.get(prop.id)
        assert refreshed.owner_name == "Owner Renamed"
        assert refreshed.owner_phone == "555-9999"

    @pytest.mark.asyncio
    async def test_cannot_link_user_already_linked_to_other_owner(
        self, client, mongomock_db, test_owner, test_owner_user, auth_headers_admin
    ):
        from app.models.owner import Owner

        other = Owner(full_name="Other Owner")
        await other.insert()

        response = await client.put(
            f"/owners/{other.id}",
            json={"user_id": str(test_owner_user.id)},
            headers=auth_headers_admin,
        )
        assert response.status_code == 400
        assert "ligado" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_can_unlink_user(
        self, client, mongomock_db, test_owner, auth_headers_admin
    ):
        response = await client.put(
            f"/owners/{test_owner.id}",
            json={"user_id": None},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.json()["user_id"] is None


class TestDeleteOwner:
    @pytest.mark.asyncio
    async def test_cannot_delete_linked_owner(
        self, client, mongomock_db, test_owner, auth_headers_admin
    ):
        from app.models.property import Property

        await Property(
            row_letter="A",
            number=1,
            villa="Villa 1",
            owner_name=test_owner.full_name,
            owners=[test_owner.id],
            primary_owner=test_owner.id,
        ).insert()

        response = await client.delete(
            f"/owners/{test_owner.id}", headers=auth_headers_admin
        )
        assert response.status_code == 400
        assert "propiedades" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_deletes_unlinked_owner(
        self, client, mongomock_db, auth_headers_admin
    ):
        from app.models.owner import Owner

        owner = Owner(full_name="Temporal")
        await owner.insert()

        response = await client.delete(f"/owners/{owner.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        assert await Owner.get(owner.id) is None
