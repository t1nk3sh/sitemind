"""System endpoints: health, weather lookup, history and dashboard stats."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..ai.engine import DEMO_WARNING
from ..config import get_settings
from ..schemas import AnalysisOut
from ..services.weather import weather_for_location

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.api_version,
        "ai_mode": settings.ai_mode,
        "model": settings.gemini_model if settings.ai_mode == "live" else "demo-engine",
        "features": [
            "safety",
            "cracks",
            "valuation",
            "planning",
            "daily_site",
            "knowledge",
        ],
    }


@router.get("/weather")
async def weather(location: str = Query(min_length=2, max_length=120)) -> dict[str, Any]:
    return await weather_for_location(location)


@router.get("/analyses")
async def list_analyses(
    kind: str | None = None,
    project_id: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict[str, Any]]:
    records = db.list_analyses(kind=kind, project_id=project_id, limit=limit)
    return [
        {
            "id": record["id"],
            "kind": record["kind"],
            "title": record["title"],
            "mode": record["mode"],
            "summary": record["summary"],
            "project_id": record["project_id"],
            "created_at": record["created_at"],
        }
        for record in records
    ]


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
async def get_analysis(analysis_id: str) -> AnalysisOut:
    record = db.get_analysis(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return AnalysisOut(
        id=record["id"],
        kind=record["kind"],
        title=record["title"],
        mode=record["mode"],
        summary=record["summary"],
        project_id=record["project_id"],
        created_at=record["created_at"],
        result=record["output"],
        warnings=[] if record["mode"] == "live" else [DEMO_WARNING],
    )


@router.get("/stats")
async def stats() -> dict[str, Any]:
    return db.dashboard_stats()
