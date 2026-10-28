"""Analysis orchestrator: prompt -> (live | demo) -> validated JSON contract."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, get_args, get_origin

from pydantic import BaseModel, ValidationError

from ..config import get_settings
from ..schemas import (
    CrackResult,
    DailySiteResult,
    KnowledgeResult,
    PlanningResult,
    SafetyResult,
    ValuationResult,
)
from . import demo
from .gemini import AIProviderError, GeminiClient, schema_for
from .prompts import build_prompt

logger = logging.getLogger(__name__)

CONTRACTS: dict[str, type[BaseModel]] = {
    "safety": SafetyResult,
    "cracks": CrackResult,
    "valuation": ValuationResult,
    "planning": PlanningResult,
    "daily_site": DailySiteResult,
    "knowledge": KnowledgeResult,
}

KIND_LABELS = {
    "safety": "Site safety",
    "cracks": "Crack analysis",
    "valuation": "Valuation",
    "planning": "Project plan",
    "daily_site": "Daily briefing",
    "knowledge": "Knowledge",
}

DEMO_WARNING = (
    "Demo mode: this result was generated locally without a language model. "
    "Set GEMINI_API_KEY to enable live multimodal analysis."
)

# Common model spellings that do not match the contract's literals.
_LITERAL_ALIASES = {
    "medium": {"moderate", "normal", "average", "med"},
    "high": {"severe", "serious", "significant", "elevated"},
    "critical": {"extreme", "fatal", "catastrophic", "very high"},
    "low": {"minor", "negligible", "slight", "trivial"},
    "unclear": {"unknown", "indeterminate", "n/a", "cannot tell"},
    "not_applicable": {"n/a", "none", "not applicable"},
    "non_compliant": {"noncompliant", "non-compliant", "non compliant", "missing"},
    "compliant": {"yes", "ok", "pass"},
    "partial": {"partially compliant", "some", "mixed"},
    "immediate": {"immediately", "emergency"},
    "urgent": {"soon"},
    "schedule": {"scheduled", "plan", "planned"},
    "monitor": {"monitoring", "watch"},
    "positive": {"benefit", "up", "good"},
    "negative": {"detriment", "down", "bad", "risk"},
    "neutral": {"none", "flat"},
    "excellent": {"very good", "superior"},
    "good": {"fair to good", "decent"},
    "fair": {"average"},
    "poor": {"bad", "degraded"},
}
_ALIAS_LOOKUP = {
    alias: canonical for canonical, aliases in _LITERAL_ALIASES.items() for alias in aliases
}


def _coerce_scalar(value: Any, annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin is not None and str(origin).endswith("Literal"):
        allowed = [str(item) for item in get_args(annotation)]
        text = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        if text in allowed:
            return text
        alias = _ALIAS_LOOKUP.get(text)
        if alias in allowed:
            return alias
        # Fall back to the closest allowed value by prefix match.
        for option in allowed:
            if text.startswith(option[:4]):
                return option
        return allowed[0]
    if annotation is bool and isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "1", "y"}
    if annotation is int and isinstance(value, (str, float)) and not isinstance(value, bool):
        try:
            return round(float(value))
        except (TypeError, ValueError):
            return value
    if annotation is float and isinstance(value, (int, str)) and not isinstance(value, bool):
        try:
            return float(value)
        except (TypeError, ValueError):
            return value
    return value


def _repair(model_cls: type[BaseModel], raw: Any) -> Any:
    """Best-effort coercion of a model response into the declared contract."""
    if not isinstance(raw, dict):
        return raw
    repaired: dict[str, Any] = {}
    for name, field in model_cls.model_fields.items():
        if name not in raw:
            continue
        value = raw[name]
        annotation = field.annotation
        origin = get_origin(annotation)

        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            repaired[name] = _repair(annotation, value)
        elif origin in (list,) and get_args(annotation):
            inner = get_args(annotation)[0]
            if isinstance(value, list):
                if isinstance(inner, type) and issubclass(inner, BaseModel):
                    repaired[name] = [
                        _repair(inner, item) if isinstance(item, dict) else item for item in value
                    ]
                else:
                    repaired[name] = [_coerce_scalar(item, inner) for item in value]
            else:
                repaired[name] = [value]
        else:
            repaired[name] = _coerce_scalar(value, annotation)
    return repaired


def _validate(contract: type[BaseModel], raw: dict[str, Any]) -> BaseModel:
    try:
        return contract.model_validate(raw)
    except ValidationError as first_error:
        try:
            return contract.model_validate(_repair(contract, raw))
        except ValidationError:
            rejected = [
                str(error["loc"][0]) if error.get("loc") else "root"
                for error in first_error.errors()[:5]
            ]
            raise AIProviderError(
                "The model response did not match the required data contract. "
                f"Fields rejected: {', '.join(rejected)}"
            ) from first_error


def build_title(kind: str, payload: dict[str, Any]) -> str:
    if kind == "safety":
        work = payload.get("work_type") or "site walk"
        return f"Safety scan — {work}"
    if kind == "cracks":
        return f"Crack analysis — {payload.get('element_type') or 'concrete element'}"
    if kind == "valuation":
        area = payload.get("built_area_sqm") or 0
        return f"Valuation — {payload.get('location')} · {area:g} sqm"
    if kind == "planning":
        area = payload.get("built_area_sqm") or 0
        return f"Programme — {payload.get('project_type')} · {area:g} sqm"
    if kind == "daily_site":
        when = payload.get("date") or date.today().isoformat()
        return f"Daily briefing — {when}"
    if kind == "knowledge":
        question = str(payload.get("question") or "").strip()
        return question if len(question) <= 90 else f"{question[:90].rstrip()}…"
    return KIND_LABELS.get(kind, kind)


async def analyse(
    *,
    kind: str,
    payload: dict[str, Any],
    images: list[tuple[bytes, str]] | None = None,
    project: dict[str, Any] | None = None,
) -> tuple[BaseModel, str, list[str]]:
    """Run one analysis and return (validated result, mode, warnings)."""
    contract = CONTRACTS.get(kind)
    if contract is None:
        raise ValueError(f"Unknown analysis kind: {kind}")

    settings = get_settings()
    settings.ensure_directories()

    if settings.ai_mode == "live":
        prompt = build_prompt(kind, payload, project)
        raw = await GeminiClient().generate_json(
            prompt=prompt, schema=schema_for(contract), images=images
        )
        result = _validate(contract, raw)
        return result, "live", []

    if settings.require_live_ai:
        raise AIProviderError("Live AI is required but GEMINI_API_KEY is not configured.", status_code=503)

    raw = demo.generate(kind, payload)
    result = _validate(contract, raw)
    return result, "demo", [DEMO_WARNING]
