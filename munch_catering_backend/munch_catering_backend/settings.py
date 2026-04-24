import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")


class Settings:
    def __init__(self) -> None:
        self.APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
        self.DEBUG = self._as_bool(os.getenv("DEBUG", "false"))
        self.MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
        self.DB_NAME = os.getenv("DB_NAME", "munch_catering")
        self.PROJECT_ROOT = PROJECT_ROOT
        self.PORTFOLIO_DIR = PROJECT_ROOT / "portfolio_images"
        self.CORS_ORIGINS = self._split_csv(
            os.getenv(
                "CORS_ORIGINS",
                "http://localhost:8081,http://localhost:19006,http://127.0.0.1:19006,http://localhost:3000",
            )
        )
        self.SECRET_KEY = os.getenv("SECRET_KEY", "")
        self.ALGORITHM = os.getenv("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        self.ENABLE_ADMIN_ROUTES = self._as_bool(
            os.getenv("ENABLE_ADMIN_ROUTES", "true" if self.is_development else "false")
        )
        self.DEFAULT_PAGE_SIZE = int(os.getenv("DEFAULT_PAGE_SIZE", "25"))
        self.MAX_PAGE_SIZE = int(os.getenv("MAX_PAGE_SIZE", "100"))
        self.MAX_MESSAGE_PAGE_SIZE = int(os.getenv("MAX_MESSAGE_PAGE_SIZE", "100"))
        self.MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
        self.PAYMENT_PROVIDER = os.getenv(
            "PAYMENT_PROVIDER",
            "test" if self.is_development else "mpesa",
        ).strip().lower()
        self.MPESA_CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "")
        self.MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "")
        self.MPESA_SHORTCODE = os.getenv("MPESA_SHORTCODE", "")
        self.MPESA_PASSKEY = os.getenv("MPESA_PASSKEY", "")
        self.MPESA_ENV = os.getenv("MPESA_ENV", "sandbox").strip().lower()
        self.MPESA_BASE_URL = os.getenv(
            "MPESA_BASE_URL",
            "https://sandbox.safaricom.co.ke" if self.MPESA_ENV != "live" else "https://api.safaricom.co.ke",
        ).rstrip("/")
        self.MPESA_CALLBACK_URL = os.getenv("MPESA_CALLBACK_URL", "http://localhost:8000/mpesa/callback")

    @property
    def is_development(self) -> bool:
        return self.APP_ENV in {"dev", "development", "local", "test", "testing"}

    def validate(self) -> None:
        if not self.SECRET_KEY:
            if self.is_development:
                self.SECRET_KEY = "dev-insecure-secret-key"
            else:
                raise RuntimeError("SECRET_KEY must be configured outside development environments.")

        if self.SECRET_KEY == "change-me-in-production" and not self.is_development:
            raise RuntimeError("Refusing to start with insecure default SECRET_KEY outside development.")

        if self.DEFAULT_PAGE_SIZE < 1 or self.MAX_PAGE_SIZE < self.DEFAULT_PAGE_SIZE:
            raise RuntimeError("Pagination settings are invalid.")

        if self.MAX_UPLOAD_BYTES <= 0:
            raise RuntimeError("MAX_UPLOAD_BYTES must be positive.")

        if self.PAYMENT_PROVIDER not in {"test", "mpesa"}:
            raise RuntimeError("PAYMENT_PROVIDER must be either 'test' or 'mpesa'.")

        if self.PAYMENT_PROVIDER == "test":
            return

        if self.MPESA_ENV not in {"sandbox", "live"}:
            raise RuntimeError("MPESA_ENV must be either 'sandbox' or 'live'.")

        self._validate_mpesa_callback_url()

        missing_mpesa = [
            name
            for name, value in {
                "MPESA_CONSUMER_KEY": self.MPESA_CONSUMER_KEY,
                "MPESA_CONSUMER_SECRET": self.MPESA_CONSUMER_SECRET,
                "MPESA_SHORTCODE": self.MPESA_SHORTCODE,
                "MPESA_PASSKEY": self.MPESA_PASSKEY,
                "MPESA_CALLBACK_URL": self.MPESA_CALLBACK_URL,
            }.items()
            if not value
        ]
        if missing_mpesa:
            raise RuntimeError(f"Missing required MPESA settings: {', '.join(missing_mpesa)}")

    def _validate_mpesa_callback_url(self) -> None:
        callback_url = (self.MPESA_CALLBACK_URL or "").strip()
        parsed = urlparse(callback_url)
        hostname = (parsed.hostname or "").strip().lower()
        if not parsed.scheme or not parsed.netloc:
            raise RuntimeError("MPESA_CALLBACK_URL must be a valid absolute URL.")
        if hostname in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            raise RuntimeError("MPESA_CALLBACK_URL must be publicly reachable. Localhost callback URLs will not work with Daraja.")

    @staticmethod
    def _as_bool(value: str) -> bool:
        return value.strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _split_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]


settings = Settings()
