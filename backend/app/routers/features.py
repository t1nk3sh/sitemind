"""The six AI feature endpoints. Every response is a validated JSON contract."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from .. import db
from ..ai.engine import analyse, build_title
from ..ai.gemini import AIProviderError
from ..schemas import (
    AnalysisOut,
    CrackRequest,
    DailySiteRequest,
    KnowledgeRequest,
    PlanningRequest,
    SafetyRequest,
    ValuationRequest,
)
from .uploads import load_image_bytes

router = APIRouter(prefix="/api/analyze", tags=["analysis"])


async def _run(
    *,
    kind: str,
    payload: dict[str, Any],
    project_id: str | None,
    image_ids: list[str] | None = None,
) -> AnalysisOut:
    project = None
    if project_id:
        project = db.get_project(project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found.")

    images = load_image_bytes(image_ids or [])

    try:
        result, mode, warnings = await analyse(
            kind=kind, payload=payload, images=images, project=project
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    output = result.model_dump()
    record = db.create_analysis(
        kind=kind,
        title=build_title(kind, payload),
        mode=mode,
        summary=str(output.get("summary", ""))[:600],
        input_payload=payload,
        output=output,
        project_id=project_id,
    )

    return AnalysisOut(
        id=record["id"],
        kind=kind,
        title=record["title"],
        mode=mode,
        summary=record["summary"],
        project_id=project_id,
        created_at=record["created_at"],
        result=output,
        warnings=warnings,
    )


@router.post("/safety", response_model=AnalysisOut)
async def analyse_safety(request: SafetyRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id", "image_upload_ids"})
    return await _run(
        kind="safety",
        payload=payload,
        project_id=request.project_id,
        image_ids=request.image_upload_ids,
    )


@router.post("/cracks", response_model=AnalysisOut)
async def analyse_cracks(request: CrackRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id", "image_upload_ids"})
    return await _run(
        kind="cracks",
        payload=payload,
        project_id=request.project_id,
        image_ids=request.image_upload_ids,
    )


@router.post("/valuation", response_model=AnalysisOut)
async def analyse_valuation(request: ValuationRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id"})
    return await _run(kind="valuation", payload=payload, project_id=request.project_id)


@router.post("/planning", response_model=AnalysisOut)
async def analyse_planning(request: PlanningRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id"})
    return await _run(kind="planning", payload=payload, project_id=request.project_id)


@router.post("/daily-site", response_model=AnalysisOut)
async def analyse_daily_site(request: DailySiteRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id"})
    return await _run(kind="daily_site", payload=payload, project_id=request.project_id)


@router.post("/knowledge", response_model=AnalysisOut)
async def analyse_knowledge(request: KnowledgeRequest) -> AnalysisOut:
    payload = request.model_dump(exclude={"project_id", "image_upload_ids"})
    return await _run(
        kind="knowledge",
        payload=payload,
        project_id=request.project_id,
        image_ids=request.image_upload_ids,
    )
