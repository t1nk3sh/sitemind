"""Image uploads for the vision features."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .. import db
from ..config import get_settings
from ..schemas import UploadOut

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_TYPES = {
    "image/jpeg": (".jpg", (b"\xff\xd8\xff",)),
    "image/png": (".png", (b"\x89PNG\r\n\x1a\n",)),
    "image/webp": (".webp", (b"RIFF",)),
}


@router.post("", response_model=UploadOut, status_code=201)
async def upload_image(file: UploadFile) -> UploadOut:
    settings = get_settings()
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG or WebP images are accepted.",
        )

    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Images must be {settings.max_upload_mb} MB or smaller.",
        )

    extension, signatures = ALLOWED_TYPES[content_type]
    if not any(data.startswith(signature) for signature in signatures):
        raise HTTPException(status_code=415, detail="File contents do not match the image type.")

    upload_id = db.new_id("upl")
    stored = settings.upload_dir / f"{upload_id}{extension}"
    stored.write_bytes(data)

    record = db.create_upload(
        filename=Path(file.filename or f"{upload_id}{extension}").name[:200],
        mime_type=content_type,
        size_bytes=len(data),
        stored_path=str(stored),
    )
    return UploadOut(
        id=record["id"],
        filename=record["filename"],
        mime_type=record["mime_type"],
        size_bytes=record["size_bytes"],
        url=f"/api/uploads/{record['id']}/raw",
        created_at=record["created_at"],
    )


@router.get("/{upload_id}/raw", response_class=FileResponse)
async def get_image(upload_id: str) -> FileResponse:
    record = db.get_upload(upload_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Image not found.")
    path = Path(record["stored_path"])
    if not path.is_file():
        raise HTTPException(status_code=410, detail="The stored image is no longer available.")
    return FileResponse(path, media_type=record["mime_type"], filename=record["filename"])


def load_image_bytes(upload_ids: list[str]) -> list[tuple[bytes, str]]:
    """Resolve upload ids into (bytes, mime) pairs for the vision model."""
    loaded: list[tuple[bytes, str]] = []
    for upload_id in upload_ids:
        record = db.get_upload(upload_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"Image {upload_id} not found.")
        path = Path(record["stored_path"])
        if not path.is_file():
            raise HTTPException(status_code=410, detail=f"Image {upload_id} is unavailable.")
        loaded.append((path.read_bytes(), record["mime_type"]))
    return loaded
