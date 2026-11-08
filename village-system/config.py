import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = ROOT / "instance" / "smartgram.db"


def default_database_uri():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url
    sqlite_path = Path(os.environ.get("SMARTGRAM_DATABASE", DEFAULT_SQLITE_PATH)).resolve()
    return f"sqlite:///{sqlite_path.as_posix()}"


class BaseConfig:
    SECRET_KEY = os.environ.get("SMARTGRAM_SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = default_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    PANCHAYAT_CSV = Path(os.environ.get(
        "SMARTGRAM_PANCHAYAT_CSV",
        ROOT / "data" / "karnataka_gram_panchayats.csv",
    ))
    UPLOAD_FOLDER = Path(os.environ.get(
        "SMARTGRAM_UPLOAD_FOLDER",
        ROOT / "instance" / "uploads",
    ))
    MAX_IMAGE_BYTES = 5 * 1024 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    MAX_CONTENT_LENGTH = MAX_IMAGE_BYTES + 256 * 1024


class DevelopmentConfig(BaseConfig):
    SECRET_KEY = BaseConfig.SECRET_KEY or "local-development-key-change-before-deployment"
    DEBUG = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}


class TestingConfig(BaseConfig):
    TESTING = True
    SECRET_KEY = BaseConfig.SECRET_KEY or "test-only-smartgram-secret"
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    SECRET_KEY = BaseConfig.SECRET_KEY


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def selected_config():
    environment = os.environ.get("SMARTGRAM_ENV", "development").lower()
    try:
        return CONFIGS[environment]
    except KeyError as exc:
        raise RuntimeError(
            "SMARTGRAM_ENV must be one of: development, testing, production."
        ) from exc
