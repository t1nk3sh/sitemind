"""Test fixtures: isolated data directory and deterministic demo AI mode."""

from __future__ import annotations

import base64
import os
import tempfile
from pathlib import Path

import pytest

# Must be set before the app package is imported (settings are cached).
_TMP_DATA = tempfile.mkdtemp(prefix="construction-intel-test-")
os.environ["DATA_DIR"] = _TMP_DATA
os.environ["GEMINI_API_KEY"] = ""
os.environ["REQUIRE_LIVE_AI"] = "false"
os.environ["MAX_UPLOAD_MB"] = "2"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# A 1x1 transparent PNG.
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def image_id(client: TestClient) -> str:
    response = client.post(
        "/api/uploads",
        files={"file": ("site-photo.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.fixture()
def project(client: TestClient) -> dict:
    response = client.post(
        "/api/projects",
        json={
            "name": "Riverside Tower B",
            "project_type": "commercial",
            "location": "Mumbai, India",
            "built_area_sqm": 8400,
            "floors": 12,
            "budget": 9200000,
            "currency": "USD",
            "status": "in_progress",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def data_dir() -> Path:
    return Path(_TMP_DATA)
