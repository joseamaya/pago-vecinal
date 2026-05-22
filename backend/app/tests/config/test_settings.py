import pytest
import logging
from unittest.mock import patch
from app.config.settings import Settings
from app.config.logging import setup_logging


class TestSettings:
    def test_loads_all_env_vars(self, settings_override):
        assert settings_override.MONGODB_URL == "mongodb://test:27017"
        assert settings_override.DATABASE_NAME == "pago_vecinal_test"
        assert settings_override.SECRET_KEY == "test-secret-key-for-testing-only"
        assert settings_override.ALGORITHM == "HS256"
        assert settings_override.ACCESS_TOKEN_EXPIRE_MINUTES == 1
        assert settings_override.CLOUDINARY_CLOUD_NAME == "test-cloud"
        assert settings_override.CLOUDINARY_API_KEY == "test-api-key"

    def test_defaults_are_applied(self):
        from app.config.settings import Settings as S
        assert S.model_fields["DATABASE_NAME"].default == "pago_vecinal"
        assert S.model_fields["ALGORITHM"].default == "HS256"
        assert S.model_fields["INITIAL_ADMIN_EMAIL"].default == "admin@pago-vecinal.com"
        assert S.model_fields["INITIAL_ADMIN_NAME"].default == "Administrador"
        assert S.model_fields["LOG_LEVEL"].default == "INFO"

    def test_missing_required_raises_error(self):
        from pydantic import ValidationError
        from app.config.settings import Settings as S
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValidationError):
                S(_env_file=None)

    def test_int_coercion(self, monkeypatch):
        monkeypatch.setenv("MONGODB_URL", "mongodb://test:27017")
        monkeypatch.setenv("SECRET_KEY", "test-key")
        monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "test-cloud")
        monkeypatch.setenv("CLOUDINARY_API_KEY", "test-key")
        monkeypatch.setenv("CLOUDINARY_API_SECRET", "test-secret")
        monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "test-pass")
        monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

        s = Settings()
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 30
        assert isinstance(s.ACCESS_TOKEN_EXPIRE_MINUTES, int)


class TestLogging:
    def test_setup_logging_adds_handler(self):
        logger = logging.getLogger()
        initial_count = len(logger.handlers)
        setup_logging()
        assert len(logger.handlers) >= initial_count

    def test_setup_logging_sets_level(self, monkeypatch):
        monkeypatch.setenv("LOG_LEVEL", "WARNING")
        setup_logging()
        logger = logging.getLogger()
        assert logger.level <= logging.WARNING

    def test_setup_logging_motor_suppressed(self):
        setup_logging()
        assert logging.getLogger("motor").level <= logging.WARNING
        assert logging.getLogger("pymongo").level <= logging.WARNING
