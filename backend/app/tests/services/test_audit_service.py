from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestRecordRequestAudit:
    @pytest.mark.asyncio
    async def test_skips_non_mutating_methods(self):
        from app.services.audit_service import record_request_audit

        request = MagicMock()
        request.method = "GET"

        with patch("app.services.audit_service.AuditLog") as mock_log:
            await record_request_audit(request, 200, "rid")

        mock_log.assert_not_called()

    @pytest.mark.asyncio
    async def test_records_mutating_request_with_user(self):
        from app.services.audit_service import record_request_audit

        request = MagicMock()
        request.method = "POST"
        request.url.path = "/payments/"
        request.headers = {"Authorization": "Bearer tok"}
        request.client.host = "1.2.3.4"

        with patch("app.services.audit_service.verify_token", return_value="u@example.com") as verify, \
                patch("app.services.audit_service.AuditLog") as mock_log:
            instance = mock_log.return_value
            instance.insert = AsyncMock()

            await record_request_audit(request, 201, "rid")

        verify.assert_called_once_with("tok")
        instance.insert.assert_awaited_once()
        kwargs = mock_log.call_args.kwargs
        assert kwargs["method"] == "POST"
        assert kwargs["path"] == "/payments/"
        assert kwargs["status_code"] == 201
        assert kwargs["user_email"] == "u@example.com"
        assert kwargs["client_ip"] == "1.2.3.4"
        assert kwargs["request_id"] == "rid"

    @pytest.mark.asyncio
    async def test_anonymous_mutating_request_has_no_user(self):
        from app.services.audit_service import record_request_audit

        request = MagicMock()
        request.method = "DELETE"
        request.url.path = "/x"
        request.headers = {}
        request.client = None

        with patch("app.services.audit_service.AuditLog") as mock_log:
            mock_log.return_value.insert = AsyncMock()
            await record_request_audit(request, 204, "rid")

        assert mock_log.call_args.kwargs["user_email"] is None
        assert mock_log.call_args.kwargs["client_ip"] is None

    @pytest.mark.asyncio
    async def test_swallows_insert_errors(self):
        from app.services.audit_service import record_request_audit

        request = MagicMock()
        request.method = "PUT"
        request.url.path = "/x"
        request.headers = {}
        request.client = None

        with patch("app.services.audit_service.AuditLog") as mock_log:
            mock_log.return_value.insert = AsyncMock(side_effect=RuntimeError("db down"))
            await record_request_audit(request, 200, "rid")
