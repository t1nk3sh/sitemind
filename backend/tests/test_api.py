"""End-to-end API tests against the deterministic demo engine."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.schemas import SafetyResult

from .conftest import PNG_BYTES


def test_health_reports_demo_mode(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ai_mode"] == "demo"
    assert len(body["features"]) == 6


def test_project_crud(client: TestClient, project: dict) -> None:
    assert project["id"].startswith("prj_")
    assert project["name"] == "Riverside Tower B"

    listed = client.get("/api/projects").json()
    assert any(item["id"] == project["id"] for item in listed)

    patched = client.patch(
        f"/api/projects/{project['id']}", json={"status": "completed"}
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "completed"

    assert client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").status_code == 404


def test_upload_rejects_non_images(client: TestClient) -> None:
    response = client.post(
        "/api/uploads", files={"file": ("notes.txt", b"hello", "text/plain")}
    )
    assert response.status_code == 415


def test_upload_rejects_spoofed_image(client: TestClient) -> None:
    response = client.post(
        "/api/uploads", files={"file": ("fake.png", b"not really a png", "image/png")}
    )
    assert response.status_code == 415


def test_upload_and_serve_image(client: TestClient, image_id: str) -> None:
    raw = client.get(f"/api/uploads/{image_id}/raw")
    assert raw.status_code == 200
    assert raw.headers["content-type"] == "image/png"
    assert raw.content == PNG_BYTES


def test_safety_analysis(client: TestClient, image_id: str, project: dict) -> None:
    response = client.post(
        "/api/analyze/safety",
        json={
            "project_id": project["id"],
            "image_upload_ids": [image_id],
            "work_type": "edge protection",
            "focus_areas": ["fall protection"],
            "notes": "Morning walk, level 4 slab.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mode"] == "demo"
    assert body["kind"] == "safety"
    assert body["warnings"], "demo responses must be labelled"

    result = SafetyResult.model_validate(body["result"])
    assert result.hazards, "a safety scan must report hazards"
    assert 0 <= result.risk_score <= 100
    assert result.overall_risk_level in {"low", "medium", "high", "critical"}


def test_safety_requires_an_image(client: TestClient) -> None:
    response = client.post("/api/analyze/safety", json={"image_upload_ids": []})
    assert response.status_code == 422


def test_safety_rejects_unknown_image(client: TestClient) -> None:
    response = client.post(
        "/api/analyze/safety", json={"image_upload_ids": ["upl_missing"]}
    )
    assert response.status_code == 404


def test_unknown_project_is_rejected(client: TestClient, image_id: str) -> None:
    response = client.post(
        "/api/analyze/cracks",
        json={"project_id": "prj_nope", "image_upload_ids": [image_id]},
    )
    assert response.status_code == 404


def test_crack_analysis(client: TestClient, image_id: str) -> None:
    body = client.post(
        "/api/analyze/cracks",
        json={
            "image_upload_ids": [image_id],
            "element_type": "concrete column",
            "scale_reference": "20 mm conduit",
        },
    ).json()
    result = body["result"]
    assert result["crack_detected"] is True
    assert result["cracks"]
    assert 0 <= result["confidence"] <= 1
    assert result["summary"]


def test_valuation_maths_is_internally_consistent(client: TestClient) -> None:
    body = client.post(
        "/api/analyze/valuation",
        json={
            "location": "Mumbai, India",
            "property_type": "apartment",
            "built_area_sqm": 120,
            "age_years": 6,
            "condition": "good",
            "amenities": ["parking", "gym"],
            "currency": "USD",
        },
    ).json()
    result = body["result"]
    low = result["value_range"]["low"]
    high = result["value_range"]["high"]
    value = result["estimated_value"]
    assert low <= value <= high
    assert abs(result["price_per_sqm"] - value / 120) < 1
    assert result["factors"]
    assert result["currency"] == "USD"


def test_planning_schedule_is_consistent(client: TestClient) -> None:
    body = client.post(
        "/api/analyze/planning",
        json={
            "project_type": "residential",
            "location": "Pune, India",
            "built_area_sqm": 1200,
            "floors": 4,
            "budget": 1500000,
            "currency": "USD",
        },
    ).json()
    result = body["result"]
    phases = result["phases"]
    assert len(phases) >= 5

    # Phases must be sequential and inside the programme.
    for previous, current in zip(phases, phases[1:]):
        assert current["start_week"] >= previous["start_week"] + previous["duration_weeks"] - 1
    last = phases[-1]
    assert last["start_week"] + last["duration_weeks"] - 1 == result["total_duration_weeks"]

    percent_total = sum(line["percent"] for line in result["cost_breakdown"])
    assert 99 <= percent_total <= 101
    assert abs(sum(line["amount"] for line in result["cost_breakdown"]) - result["estimated_cost"]) < result["estimated_cost"] * 0.02
    assert result["estimated_cost"] == 1500000
    assert result["risks"]


def test_daily_site_uses_supplied_weather(client: TestClient) -> None:
    body = client.post(
        "/api/analyze/daily-site",
        json={
            "site_name": "Riverside Tower B",
            "date": "2026-10-24",
            "planned_tasks": ["Concrete pour level 5 slab", "MEP rough-in level 3"],
            "crew_size": 42,
            "weather": {
                "condition": "heavy rain",
                "temperature_c": 26,
                "precipitation_mm": 18,
                "wind_kph": 44,
                "source": "manual",
            },
        },
    ).json()
    result = body["result"]
    advisory = result["weather_advisory"]
    assert advisory["impact_level"] in {"high", "critical"}
    assert advisory["work_restrictions"]
    joined = " ".join(advisory["work_restrictions"]).lower()
    assert "concrete" in joined
    assert result["crew_assignments"]
    assert result["inspection_checklist"]


def test_knowledge_answer(client: TestClient) -> None:
    body = client.post(
        "/api/analyze/knowledge",
        json={"question": "How long should I cure concrete in hot weather?", "discipline": "concrete"},
    ).json()
    result = body["result"]
    assert result["answer"]
    assert result["key_points"]
    assert result["confidence"] <= 0.6  # demo answers are explicitly low-confidence


def test_history_and_stats(client: TestClient, image_id: str) -> None:
    client.post("/api/analyze/cracks", json={"image_upload_ids": [image_id]})
    history = client.get("/api/analyses", params={"kind": "cracks", "limit": 5}).json()
    assert history
    assert all(item["kind"] == "cracks" for item in history)

    detail = client.get(f"/api/analyses/{history[0]['id']}").json()
    assert detail["result"]["summary"]
    assert detail["mode"] == "demo"
    assert detail["warnings"]

    stats = client.get("/api/stats").json()
    assert stats["analyses"] >= 1
    assert "cracks" in stats["by_kind"]

    assert client.get("/api/analyses/anl_missing").status_code == 404
