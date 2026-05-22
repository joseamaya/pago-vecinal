import pytest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from app.dependencies.auth import oauth2_scheme, get_current_user, require_admin


class TestOAuth2Scheme:
    def test_token_url_is_correct(self):
        assert oauth2_scheme.model.flows.password.tokenUrl == "auth/login"


class TestRequireAdmin:
    @pytest.mark.asyncio
    async def test_admin_passes(self, mock_user):
        result = await require_admin(mock_user)
        assert result == mock_user

    @pytest.mark.asyncio
    async def test_owner_raises_403(self, mock_owner_user):
        with pytest.raises(HTTPException) as exc:
            await require_admin(mock_owner_user)
        assert exc.value.status_code == 403
        assert "Admin" in exc.value.detail
