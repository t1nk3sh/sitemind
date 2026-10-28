"""FastAPI entrypoint for the Multimodal Construction Intelligence Platform."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .ai.gemini import AIProviderError
from .config import ROOT_DIR, get_settings
from .routers import features, projects, system, uploads

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("construction-intel")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    db.init_db()
    logger.info(
        "Started %s v%s in %s mode",
        settings.app_name,
        settings.api_version,
        settings.ai_mode,
    )
    if settings.ai_mode == "demo":
        logger.info("No GEMINI_API_KEY found: running the deterministic demo engine.")
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    description=(
        "Multimodal decision support for construction: site safety, crack analysis, "
        "valuation, project planning, daily briefings and knowledge assistance. "
        "Every AI response is validated against a strict JSON contract."
    ),
    version=settings.api_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AIProviderError)
async def ai_error_handler(_: Request, exc: AIProviderError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(projects.router)
app.include_router(uploads.router)
app.include_router(features.router)
app.include_router(system.router)


@app.get("/api", tags=["system"])
async def api_root() -> dict[str, Any]:
    return {
        "service": settings.app_name,
        "version": settings.api_version,
        "ai_mode": settings.ai_mode,
        "docs": "/docs",
    }


# Single-port deployment: serve the built React app when it exists.
# Render and similar hosts run from the repo root, so this mount path
# matches frontend/dist produced by scripts/build.sh.
_dist = ROOT_DIR / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
    logger.info("Serving built frontend from %s", _dist)
