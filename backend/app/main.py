"""
AI Body Analyzer — FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.api import auth, users, images, analysis, assistant

# Import models so they are registered with Base.metadata
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev convenience — use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    yield


app = FastAPI(
    title="AI Body Analyzer",
    description="Аналіз фізичної форми за фотографією з використанням комп'ютерного зору та AI",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded images) ───────────────────────────
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# ── API Routes ────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(images.router)
app.include_router(analysis.router)
app.include_router(assistant.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
