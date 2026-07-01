"""
AI Body Analyzer — Application Settings.
Reads from environment variables with sensible defaults for local development.
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./body_analyzer.db"

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── LLM ───────────────────────────────────────────────────
    LLM_PROVIDER: str = "gemini"  # "openai" | "gemini"
    LLM_API_KEY: str = "AQ.Ab8RN6Lafhbv75ppI0EiQtT98UokujjryZ7P_ITxd8RKoPY7dQ"
    LLM_MODEL: str = "gemini-3.5-flash"

    # ── File Storage ──────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10 MB

    # ── SMTP (Email Verification) ────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "aibodyanalyzer@gmail.com"
    SMTP_PASSWORD: str = "tcetimjmjpxzgktq"
    SMTP_FROM_NAME: str = "AI Body Analyzer"
    FRONTEND_URL: str = "http://localhost:3000"
    EMAIL_VERIFY_TOKEN_EXPIRE_HOURS: int = 24

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def llm_api_keys(self) -> list[str]:
        # Try to read from gemini_keys.txt in the project root
        root_dir = Path(__file__).parent.parent.parent
        keys_file = root_dir / "gemini_keys.txt"
        if keys_file.exists():
            try:
                content = keys_file.read_text(encoding="utf-8")
                # Split by commas or newlines and clean
                keys = []
                for line in content.replace("\n", ",").split(","):
                    k = line.strip()
                    if k:
                        keys.append(k)
                if keys:
                    return keys
            except Exception:
                pass
        
        # Fallback to .env variable
        return [k.strip() for k in self.LLM_API_KEY.split(",") if k.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
