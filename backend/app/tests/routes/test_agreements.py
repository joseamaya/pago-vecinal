import io
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta
from app.main import app


@pytest.fixture
async def client():
    with patch("app.main.init_db", new_callable=AsyncMock):
        with patch("app.main.create_initial_admin", new_callable=AsyncMock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


@pytest.fixture
async def test_agreement(mongomock_db, test_property, test_fee, test_user):
    from app.models.agreement import Agreement

    agreement = Agreement(
        property=test_property,
        fees=[test_fee],
        user=test_user,
        total_debt=150.0,
        monthly_amount=50.0,
        installments_count=3,
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=90),
        agreement_number="AGR-2026-00001",
    )
    await agreement.insert()
    return agreement


@pytest.fixture
async def test_agreement_installment(mongomock_db, test_agreement):
    from app.models.agreement import AgreementInstallment

    inst = AgreementInstallment(
        agreement=test_agreement,
        installment_number=1,
        amount=50.0,
        due_date=datetime.utcnow() + timedelta(days=30),
    )
    await inst.insert()
    return inst


@pytest.fixture
def resolve_agreement_links(test_property, test_fee, test_user, test_agreement):
    from app.models.agreement import Agreement, AgreementInstallment
    from app.models.fee import Fee

    async def fake_fee_fetch_link(self, link_field, fetch_links=False):
        name = str(link_field)
        if name == "property":
            self.property = test_property

    async def fake_agreement_fetch_link(self, link_field, fetch_links=False):
        name = str(link_field)
        if name == "property":
            self.property = test_property
        elif name == "user":
            self.user = test_user
        elif name == "fees":
            self.fees = [test_fee]

    async def fake_inst_fetch_link(self, link_field, fetch_links=False):
        name = str(link_field)
        if name == "agreement":
            self.agreement = test_agreement

    with patch.object(Fee, "fetch_link", fake_fee_fetch_link), patch.object(
        Agreement, "fetch_link", fake_agreement_fetch_link
    ), patch.object(AgreementInstallment, "fetch_link", fake_inst_fetch_link):
        yield


class TestGetAgreements:
    @pytest.mark.asyncio
    async def test_lists_all_for_admin(
        self, client, mongomock_db, test_agreement, auth_headers_admin, resolve_agreement_links
    ):
        response = await client.get("/agreements/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["agreement_number"] == "AGR-2026-00001"

    @pytest.mark.asyncio
    async def test_owner_forbidden_query_empty(
        self, client, mongomock_db, test_agreement, auth_headers_owner, resolve_agreement_links
    ):
        response = await client.get("/agreements/", headers=auth_headers_owner)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_invalid_property_id_returns_400(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get(
            "/agreements/?property_id=not-an-object-id", headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestAgreementFilters:
    """Verify link filters target the DBRef `$id` path (mongomock can't match these)."""

    @pytest.mark.asyncio
    async def test_owner_filter_targets_link_id(self, mongomock_db):
        from types import SimpleNamespace
        from beanie import PydanticObjectId
        from app.models.user import UserRole
        from app.models.agreement import Agreement
        from app.routes.agreements import _build_agreement_filters

        oid = PydanticObjectId()
        user = SimpleNamespace(role=UserRole.OWNER, id=oid)

        filters = _build_agreement_filters(user)
        assert Agreement.find(*filters).get_filter_query() == {"user.$id": oid}

    @pytest.mark.asyncio
    async def test_property_filter_targets_link_id(self, mongomock_db):
        from types import SimpleNamespace
        from beanie import PydanticObjectId
        from app.models.user import UserRole
        from app.models.agreement import Agreement
        from app.routes.agreements import _build_agreement_filters

        oid = PydanticObjectId()
        user = SimpleNamespace(role=UserRole.ADMIN, id=PydanticObjectId())

        filters = _build_agreement_filters(user, property_id=str(oid))
        assert Agreement.find(*filters).get_filter_query() == {"property.$id": oid}


class TestGetAgreement:
    @pytest.mark.asyncio
    async def test_gets_agreement(
        self, client, mongomock_db, test_agreement, auth_headers_admin, resolve_agreement_links
    ):
        response = await client.get(f"/agreements/{test_agreement.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_agreement.id)
        assert data["total_debt"] == 150.0

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/agreements/507f1f77bcf86cd799439999", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestCreateAgreement:
    @pytest.mark.asyncio
    async def test_creates_agreement(
        self, client, mongomock_db, test_property, test_fee, auth_headers_admin,
        resolve_agreement_links,
    ):
        payload = {
            "property_id": str(test_property.id),
            "fee_ids": [str(test_fee.id)],
            "monthly_amount": 50.0,
            "installments_count": 3,
            "start_date": datetime.utcnow().isoformat(),
        }
        with patch(
            "app.services.agreement_service.generate_agreement_pdf",
            return_value=io.BytesIO(b"%PDF-1.4 mock"),
        ):
            with patch("builtins.open", return_value=MagicMock()):
                response = await client.post("/agreements/", json=payload, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["agreement_number"].startswith("AGR-")
        assert data["installments_count"] == 3
        assert len(data["installments"]) == 3

    @pytest.mark.asyncio
    async def test_admin_creation_assigns_property_owner(
        self, client, mongomock_db, test_property, test_owner_user, test_fee,
        auth_headers_admin, resolve_agreement_links,
    ):
        from app.models.agreement import Agreement

        test_property.owner = test_owner_user
        await test_property.save()

        payload = {
            "property_id": str(test_property.id),
            "fee_ids": [str(test_fee.id)],
            "monthly_amount": 50.0,
            "installments_count": 3,
            "start_date": datetime.utcnow().isoformat(),
        }
        with patch(
            "app.services.agreement_service.generate_agreement_pdf",
            return_value=io.BytesIO(b"%PDF-1.4 mock"),
        ):
            with patch("builtins.open", return_value=MagicMock()):
                response = await client.post("/agreements/", json=payload, headers=auth_headers_admin)
        assert response.status_code == 200

        agreement = await Agreement.find_one(
            Agreement.agreement_number == response.json()["agreement_number"]
        )
        assert str(agreement.user.ref.id) == str(test_owner_user.id)

    @pytest.mark.asyncio
    async def test_property_not_found(
        self, client, mongomock_db, test_fee, auth_headers_admin
    ):
        payload = {
            "property_id": "507f1f77bcf86cd799439999",
            "fee_ids": [str(test_fee.id)],
            "monthly_amount": 50.0,
            "installments_count": 3,
            "start_date": datetime.utcnow().isoformat(),
        }
        response = await client.post("/agreements/", json=payload, headers=auth_headers_admin)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_no_fees(
        self, client, mongomock_db, test_property, auth_headers_admin
    ):
        payload = {
            "property_id": str(test_property.id),
            "fee_ids": [],
            "monthly_amount": 50.0,
            "installments_count": 3,
            "start_date": datetime.utcnow().isoformat(),
        }
        response = await client.post("/agreements/", json=payload, headers=auth_headers_admin)
        assert response.status_code == 400


class TestUpdateAgreement:
    @pytest.mark.asyncio
    async def test_updates_agreement(
        self, client, mongomock_db, test_agreement, auth_headers_admin, resolve_agreement_links
    ):
        response = await client.put(
            f"/agreements/{test_agreement.id}",
            json={"monthly_amount": 75.0},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["monthly_amount"] == 75.0

    @pytest.mark.asyncio
    async def test_owner_forbidden(
        self, client, mongomock_db, test_agreement, auth_headers_owner
    ):
        response = await client.put(
            f"/agreements/{test_agreement.id}",
            json={"monthly_amount": 75.0},
            headers=auth_headers_owner,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.put(
            "/agreements/507f1f77bcf86cd799439999",
            json={"monthly_amount": 75.0},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestDeleteAgreement:
    @pytest.mark.asyncio
    async def test_deletes_agreement(
        self, client, mongomock_db, test_agreement, test_fee, auth_headers_admin,
        resolve_agreement_links,
    ):
        response = await client.delete(f"/agreements/{test_agreement.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json()["message"] == "Agreement deleted successfully"

    @pytest.mark.asyncio
    async def test_owner_forbidden(
        self, client, mongomock_db, test_agreement, auth_headers_owner
    ):
        response = await client.delete(f"/agreements/{test_agreement.id}", headers=auth_headers_owner)
        assert response.status_code == 403


class TestDownloadAgreementPdf:
    @pytest.mark.asyncio
    async def test_downloads_pdf(
        self, client, mongomock_db, test_agreement, auth_headers_admin, tmp_path,
        resolve_agreement_links,
    ):
        from app.models.agreement import Agreement

        pdf_file = tmp_path / "agreement.pdf"
        pdf_file.write_bytes(b"%PDF-1.4 fake")
        test_agreement.pdf_file = str(pdf_file)
        await test_agreement.save()

        with patch.object(Agreement, "get", new_callable=AsyncMock, return_value=test_agreement):
            response = await client.get(
                f"/agreements/{test_agreement.id}/download-pdf", headers=auth_headers_admin
            )
        assert response.status_code == 200
        assert response.content[:4] == b"%PDF"

    @pytest.mark.asyncio
    async def test_pdf_not_generated(self, client, mongomock_db, test_agreement, auth_headers_admin):
        response = await client.get(
            f"/agreements/{test_agreement.id}/download-pdf", headers=auth_headers_admin
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_agreement_not_found(self, client, mongomock_db, auth_headers_admin):
        response = await client.get(
            "/agreements/507f1f77bcf86cd799439999/download-pdf", headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestCreateInstallmentPayment:
    @pytest.mark.asyncio
    async def test_creates_installment(
        self, client, mongomock_db, test_agreement, auth_headers_admin, resolve_agreement_links
    ):
        payload = {
            "installment_number": 4,
            "amount": 50.0,
            "due_date": (datetime.utcnow() + timedelta(days=120)).isoformat(),
        }
        response = await client.post(
            f"/agreements/{test_agreement.id}/installments/",
            json=payload,
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["installment_number"] == 4

    @pytest.mark.asyncio
    async def test_agreement_not_found(self, client, mongomock_db, auth_headers_admin):
        payload = {
            "installment_number": 1,
            "amount": 50.0,
            "due_date": datetime.utcnow().isoformat(),
        }
        response = await client.post(
            "/agreements/507f1f77bcf86cd799439999/installments/",
            json=payload,
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestGetNextPendingInstallment:
    @pytest.mark.asyncio
    async def test_no_agreements_returns_null(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.get("/agreements/installments/next-pending", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.asyncio
    async def test_no_pending_installments_returns_null(
        self, client, mongomock_db, test_agreement, auth_headers_admin
    ):
        response = await client.get("/agreements/installments/next-pending", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() is None


class TestPayNextInstallment:
    @pytest.mark.asyncio
    async def test_no_pending_returns_404(self, client, mongomock_db, auth_headers_admin):
        response = await client.post(
            "/agreements/installments/pay-next",
            data={"amount": "50.0"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_pays_next_with_receipt_file(
        self, client, mongomock_db, test_agreement, test_agreement_installment,
        auth_headers_admin, resolve_agreement_links,
    ):
        from app.schemas.agreement import AgreementInstallmentResponse

        fake_next = {
            "installment": AgreementInstallmentResponse(
                id=str(test_agreement_installment.id),
                agreement_id=str(test_agreement.id),
                installment_number=1,
                amount=50.0,
                due_date=datetime.utcnow() + timedelta(days=30),
                status="pending",
            ),
            "agreement": {
                "id": str(test_agreement.id),
                "agreement_number": "AGR-2026-00001",
            },
        }
        with patch(
            "app.routes.agreements.get_next_pending_installment",
            new_callable=AsyncMock,
            return_value=fake_next,
        ):
            with patch("app.routes.agreements.os.makedirs"), patch(
                "builtins.open", MagicMock()
            ):
                response = await client.post(
                    "/agreements/installments/pay-next",
                    data={"amount": "50.0"},
                    files={"receipt_file": ("recibo.pdf", b"%PDF-1.4", "application/pdf")},
                    headers=auth_headers_admin,
                )
        assert response.status_code == 200
        assert response.json()["message"] == "Installment payment processed successfully"

    @pytest.mark.asyncio
    async def test_reconciles_fees_when_receipt_generation_fails(
        self, client, mongomock_db, test_agreement, test_fee, test_agreement_installment,
        auth_headers_admin, resolve_agreement_links,
    ):
        from app.schemas.agreement import AgreementInstallmentResponse
        from app.models.fee import Fee, FeeStatus

        fake_next = {
            "installment": AgreementInstallmentResponse(
                id=str(test_agreement_installment.id),
                agreement_id=str(test_agreement.id),
                installment_number=1,
                amount=50.0,
                due_date=datetime.utcnow() + timedelta(days=30),
                status="pending",
            ),
            "agreement": {
                "id": str(test_agreement.id),
                "agreement_number": "AGR-2026-00001",
            },
        }
        with patch(
            "app.routes.agreements.get_next_pending_installment",
            new_callable=AsyncMock,
            return_value=fake_next,
        ), patch(
            "app.services.receipt_service.generate_correlative_number",
            new_callable=AsyncMock,
            side_effect=Exception("correlative failed"),
        ):
            response = await client.post(
                "/agreements/installments/pay-next",
                data={"amount": "50.0"},
                headers=auth_headers_admin,
            )

        assert response.status_code == 200
        assert response.json()["receipt_created"] is False

        # Reconciliation still ran: the fee moved from PENDING to AGREEMENT
        # even though receipt generation failed.
        updated_fee = await Fee.get(test_fee.id)
        assert updated_fee.status == FeeStatus.AGREEMENT

        # An empty installment query must not complete the agreement.
        from app.models.agreement import Agreement, AgreementStatus

        updated_agreement = await Agreement.get(test_agreement.id)
        assert updated_agreement.status != AgreementStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_missing_agreement_does_not_mark_installment_paid(
        self, client, mongomock_db, test_agreement, test_agreement_installment,
        auth_headers_admin,
    ):
        from app.models.agreement import (
            Agreement, AgreementInstallment, AgreementInstallmentStatus,
        )
        from app.schemas.agreement import AgreementInstallmentResponse

        fake_next = {
            "installment": AgreementInstallmentResponse(
                id=str(test_agreement_installment.id),
                agreement_id=str(test_agreement.id),
                installment_number=1,
                amount=50.0,
                due_date=datetime.utcnow() + timedelta(days=30),
                status="pending",
            ),
            "agreement": {
                "id": str(test_agreement.id),
                "agreement_number": "AGR-2026-00001",
            },
        }
        with patch(
            "app.routes.agreements.get_next_pending_installment",
            new_callable=AsyncMock,
            return_value=fake_next,
        ), patch.object(Agreement, "get", new_callable=AsyncMock, return_value=None):
            response = await client.post(
                "/agreements/installments/pay-next",
                data={"amount": "50.0"},
                headers=auth_headers_admin,
            )

        assert response.status_code == 404

        reloaded = await AgreementInstallment.get(test_agreement_installment.id)
        assert reloaded.status != AgreementInstallmentStatus.PAID


class TestUpdateInstallmentPayment:
    @pytest.mark.asyncio
    async def test_updates_installment(
        self, client, mongomock_db, test_agreement, test_agreement_installment,
        auth_headers_admin, resolve_agreement_links,
    ):
        response = await client.put(
            f"/agreements/{test_agreement.id}/installments/{test_agreement_installment.id}",
            json={"payment_reference": "REF-001", "status": "paid"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payment_reference"] == "REF-001"

    @pytest.mark.asyncio
    async def test_agreement_not_found(
        self, client, mongomock_db, auth_headers_admin
    ):
        response = await client.put(
            "/agreements/507f1f77bcf86cd799439999/installments/507f1f77bcf86cd799439998",
            json={"payment_reference": "REF-001"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404
