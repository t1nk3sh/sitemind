"""Project register: the structured project data the AI features reason over."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import db
from ..schemas import ProjectIn, ProjectOut, ProjectPatch

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects() -> list[dict]:
    return db.list_projects()


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(payload: ProjectIn) -> dict:
    return db.create_project(payload.model_dump())


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str) -> dict:
    project = db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectPatch) -> dict:
    project = db.update_project(project_id, payload.model_dump(exclude_unset=True))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str) -> None:
    if not db.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
