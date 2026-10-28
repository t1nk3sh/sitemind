"""Unit tests for the JSON-schema bridge and contract repair layer."""

from __future__ import annotations

import pytest

from app.ai.engine import _repair, _validate
from app.ai.gemini import AIProviderError, _parse_json, schema_for
from app.schemas import SafetyResult, ValuationResult


def _walk(node: object) -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in {"$defs", "$ref", "anyOf", "oneOf", "additionalProperties", "title", "default"}:
                found.append(key)
            found.extend(_walk(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_walk(item))
    return found


@pytest.mark.parametrize("model", [SafetyResult, ValuationResult])
def test_schema_is_gemini_safe(model: type) -> None:
    schema = schema_for(model)
    assert schema["type"] == "object"
    assert _walk(schema) == []
    assert "properties" in schema


def test_schema_inlines_nested_contracts() -> None:
    schema = schema_for(SafetyResult)
    ppe = schema["properties"]["ppe_compliance"]
    assert "properties" in ppe, "nested models must be inlined, not referenced"
    hazards = schema["properties"]["hazards"]
    assert hazards["type"] == "array"
    assert "properties" in hazards["items"]


def test_repair_coerces_aliases_and_numbers() -> None:
    raw = {
        "overall_risk_level": "Moderate",
        "risk_score": "72",
        "housekeeping_rating": 3.7,
        "confidence": "0.81",
        "ppe_compliance": {"helmets": "Non-Compliant", "footwear": "unknown"},
        "hazards": [
            {
                "hazard_type": "Open edge",
                "severity": "SEVERE",
                "description": "d",
                "location_hint": "l",
                "recommendation": "r",
            }
        ],
        "unexpected_field": "ignored",
    }
    result = _validate(SafetyResult, raw)
    assert isinstance(result, SafetyResult)
    assert result.overall_risk_level == "medium"
    assert result.risk_score == 72
    assert result.housekeeping_rating == 4
    assert result.ppe_compliance.helmets == "non_compliant"
    assert result.ppe_compliance.footwear == "unclear"
    assert result.hazards[0].severity == "high"


def test_validate_rejects_non_objects() -> None:
    with pytest.raises(AIProviderError):
        _validate(SafetyResult, ["not", "an", "object"])  # type: ignore[arg-type]


def test_repair_fills_missing_defaults() -> None:
    repaired = _repair(SafetyResult, {"summary": "Only a summary."})
    result = SafetyResult.model_validate(repaired)
    assert result.summary == "Only a summary."
    assert result.hazards == []


def test_parse_json_handles_fenced_and_noisy_output() -> None:
    assert _parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert _parse_json('Here you go: {"a": 2} thanks') == {"a": 2}


def test_parse_json_rejects_prose() -> None:
    with pytest.raises(AIProviderError):
        _parse_json("I cannot help with that.")
