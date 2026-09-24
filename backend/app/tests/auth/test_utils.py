import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from app.auth.utils import (
    verify_password, get_password_hash, create_access_token,
    verify_token, authenticate_user, get_current_user
)


class TestPasswordHashing:
    def test_hash_produces_different_string(self):
        password = "my-password"
        hashed = get_password_hash(password)
        assert hashed != password
        assert hashed.startswith("$2b$")

    def test_verify_correct_password(self):
        password = "correct-password"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_different_salts_produce_different_hashes(self):
        hashed1 = get_password_hash("same-password")
        hashed2 = get_password_hash("same-password")
        assert hashed1 != hashed2
        assert verify_password("same-password", hashed1)
        assert verify_password("same-password", hashed2)


class TestJWT:
    def test_create_token_returns_string(self):
        token = create_access_token(data={"sub": "test@example.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_valid_token(self):
        token = create_access_token(data={"sub": "user@example.com"})
        email = verify_token(token)
        assert email == "user@example.com"

    def test_verify_tampered_token(self):
        token = create_access_token(data={"sub": "user@example.com"})
        header, payload, _ = token.split(".")
        tampered = f"{header}.{payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        result = verify_token(tampered)
        assert result is None

    def test_verify_none_token(self):
        result = verify_token("not.a.valid.token")
        assert result is None


class TestAuthenticateUser:
    @pytest.mark.asyncio
    async def test_valid_credentials_returns_user(self, mock_user):
        with patch("app.auth.utils.User") as MockUser:
            MockUser.find_one = AsyncMock(return_value=mock_user)
            user = await authenticate_user(mock_user.email, "test-password")
            assert user is not None
            assert user.email == mock_user.email

    @pytest.mark.asyncio
    async def test_nonexistent_email_returns_none(self):
        with patch("app.auth.utils.User") as MockUser:
            MockUser.find_one = AsyncMock(return_value=None)
            user = await authenticate_user("noone@test.com", "any")
            assert user is None

    @pytest.mark.asyncio
    async def test_wrong_password_returns_none(self, mock_user):
        with patch("app.auth.utils.User") as MockUser:
            MockUser.find_one = AsyncMock(return_value=mock_user)
            with patch("app.auth.utils.verify_password", return_value=False):
                user = await authenticate_user(mock_user.email, "wrong")
                assert user is None


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self, mock_user):
        with patch("app.auth.utils.User") as MockUser:
            MockUser.find_one = AsyncMock(return_value=mock_user)
            token = create_access_token(data={"sub": mock_user.email})
            user = await get_current_user(token)
            assert user == mock_user

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            await get_current_user("invalid-token")
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_token_but_user_not_found_raises_401(self, mock_user):
        with patch("app.auth.utils.User") as MockUser:
            MockUser.find_one = AsyncMock(return_value=None)
            token = create_access_token(data={"sub": mock_user.email})
            with pytest.raises(HTTPException) as exc:
                await get_current_user(token)
            assert exc.value.status_code == 401
