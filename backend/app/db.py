"""SQLite persistence layer: projects, uploads and AI analysis history."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_type TEXT NOT NULL DEFAULT 'residential',
    location TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL,
    built_area_sqm REAL,
    floors INTEGER,
    budget REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'planning',
    start_date TEXT,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analyses_kind ON analyses (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses (project_id, created_at DESC);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    settings.ensure_directories()
    connection = sqlite3.connect(settings.db_path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    with connect() as connection:
        connection.executescript(SCHEMA)


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------
PROJECT_FIELDS = (
    "name",
    "project_type",
    "location",
    "latitude",
    "longitude",
    "built_area_sqm",
    "floors",
    "budget",
    "currency",
    "status",
    "start_date",
    "description",
)


def create_project(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = new_id("prj")
    now = utc_now()
    values = {field: payload.get(field) for field in PROJECT_FIELDS}
    values["name"] = values["name"] or "Untitled project"
    columns = ["id", *PROJECT_FIELDS, "created_at", "updated_at"]
    placeholders = ", ".join("?" for _ in columns)
    params = [project_id, *(values[f] for f in PROJECT_FIELDS), now, now]
    with connect() as connection:
        connection.execute(
            f"INSERT INTO projects ({', '.join(columns)}) VALUES ({placeholders})",
            params,
        )
        row = connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_dict(row) or {}


def update_project(project_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_project(project_id)
    if existing is None:
        return None
    updates = {k: v for k, v in payload.items() if k in PROJECT_FIELDS and v is not None}
    if not updates:
        return existing
    assignments = ", ".join(f"{key} = ?" for key in updates)
    params = [*updates.values(), utc_now(), project_id]
    with connect() as connection:
        connection.execute(
            f"UPDATE projects SET {assignments}, updated_at = ? WHERE id = ?", params
        )
        row = connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_dict(row)


def get_project(project_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_dict(row)


def list_projects() -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM projects ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def delete_project(project_id: str) -> bool:
    with connect() as connection:
        cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return cursor.rowcount > 0


# --------------------------------------------------------------------------
# Uploads
# --------------------------------------------------------------------------
def create_upload(
    *, filename: str, mime_type: str, size_bytes: int, stored_path: str
) -> dict[str, Any]:
    upload_id = new_id("upl")
    with connect() as connection:
        connection.execute(
            "INSERT INTO uploads (id, filename, mime_type, size_bytes, stored_path, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (upload_id, filename, mime_type, size_bytes, stored_path, utc_now()),
        )
        row = connection.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
    return _row_to_dict(row) or {}


def get_upload(upload_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
    return _row_to_dict(row)


# --------------------------------------------------------------------------
# Analyses
# --------------------------------------------------------------------------
def create_analysis(
    *,
    kind: str,
    title: str,
    mode: str,
    summary: str,
    input_payload: dict[str, Any],
    output: dict[str, Any],
    project_id: str | None,
) -> dict[str, Any]:
    analysis_id = new_id("anl")
    with connect() as connection:
        connection.execute(
            "INSERT INTO analyses (id, project_id, kind, title, mode, summary, input_json,"
            " output_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                analysis_id,
                project_id,
                kind,
                title,
                mode,
                summary,
                json.dumps(input_payload, default=str),
                json.dumps(output, default=str),
                utc_now(),
            ),
        )
        row = connection.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
    return _decode_analysis(_row_to_dict(row) or {})


def _decode_analysis(row: dict[str, Any]) -> dict[str, Any]:
    row["input"] = json.loads(row.pop("input_json"))
    row["output"] = json.loads(row.pop("output_json"))
    return row


def list_analyses(
    *, kind: str | None = None, project_id: str | None = None, limit: int = 20
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    if project_id:
        clauses.append("project_id = ?")
        params.append(project_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(max(1, min(limit, 100)))
    with connect() as connection:
        rows = connection.execute(
            f"SELECT * FROM analyses {where} ORDER BY created_at DESC LIMIT ?", params
        ).fetchall()
    return [_decode_analysis(dict(row)) for row in rows]


def get_analysis(analysis_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
    decoded = _row_to_dict(row)
    return _decode_analysis(decoded) if decoded else None


def dashboard_stats() -> dict[str, Any]:
    with connect() as connection:
        totals = connection.execute(
            "SELECT (SELECT COUNT(*) FROM projects) AS projects,"
            " (SELECT COUNT(*) FROM analyses) AS analyses,"
            " (SELECT COUNT(*) FROM uploads) AS images"
        ).fetchone()
        by_kind = connection.execute(
            "SELECT kind, COUNT(*) AS count FROM analyses GROUP BY kind"
        ).fetchall()
        latest = connection.execute(
            "SELECT id, kind, title, mode, summary, project_id, created_at"
            " FROM analyses ORDER BY created_at DESC LIMIT 6"
        ).fetchall()
    return {
        "projects": totals["projects"],
        "analyses": totals["analyses"],
        "images": totals["images"],
        "by_kind": {row["kind"]: row["count"] for row in by_kind},
        "recent": [dict(row) for row in latest],
    }
