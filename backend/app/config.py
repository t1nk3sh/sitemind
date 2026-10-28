"""Runtime configuration for the Multimodal Construction Intelligence Platform."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    """Minimal .env loader so the app works without extra dependencies."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(ROOT_DIR / ".env")
_load_env_file(ROOT_DIR / "backend" / ".env")


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """Everything the backend needs to boot."""

    app_name = "Multimodal Construction Intelligence Platform"
    api_version = "1.0.0"

    def __init__(self) -> None:
        # --- AI provider -------------------------------------------------
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
        self.gemini_api_base = os.getenv(
            "GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta"
        ).rstrip("/")
        self.ai_timeout_seconds = float(os.getenv("AI_TIMEOUT_SECONDS", "120"))
        self.require_live_ai = _as_bool(os.getenv("REQUIRE_LIVE_AI"), False)

        # --- Storage -----------------------------------------------------
        self.data_dir = Path(os.getenv("DATA_DIR", str(ROOT_DIR / "data")))
        self.upload_dir = self.data_dir / "uploads"
        self.db_path = self.data_dir / "construction_intel.db"
        self.max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "8"))

        # --- HTTP --------------------------------------------------------
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,"
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]

    @property
    def ai_mode(self) -> str:
        """`live` when a Gemini key is configured, otherwise deterministic `demo`."""
        return "live" if self.gemini_api_key else "demo"

    def ensure_directories(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
