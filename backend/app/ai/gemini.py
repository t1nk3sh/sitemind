"""Thin, dependency-light client for the Gemini multimodal Interactions API.

Docs: POST {base}/interactions with `input` content blocks. Images are sent as
base64 `{"type": "image", "data": ..., "mime_type": ...}` blocks, and structured
output is requested through `response_format`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

# Gemini accepts a subset of JSON Schema. Anything else is stripped.
_ALLOWED_KEYWORDS = {
    "type",
    "description",
    "enum",
    "items",
    "properties",
    "required",
    "format",
    "minimum",
    "maximum",
    "nullable",
    "minItems",
    "maxItems",
}


class AIProviderError(RuntimeError):
    """Raised when the upstream model cannot produce a usable answer."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalise_schema(node: Any, defs: dict[str, Any]) -> Any:
    """Inline $refs and keep only keywords Gemini understands."""
    if isinstance(node, list):
        return [_normalise_schema(item, defs) for item in node]

    if not isinstance(node, dict):
        return node

    if "$ref" in node:
        ref_name = str(node["$ref"]).split("/")[-1]
        target = dict(defs.get(ref_name, {}))
        siblings = {k: v for k, v in node.items() if k != "$ref"}
        return _normalise_schema({**target, **siblings}, defs)

    if "anyOf" in node or "oneOf" in node:
        branches = node.get("anyOf") or node.get("oneOf") or []
        nullable = any(isinstance(b, dict) and b.get("type") == "null" for b in branches)
        concrete = [
            b for b in branches if not (isinstance(b, dict) and b.get("type") == "null")
        ]
        merged: dict[str, Any] = {}
        if concrete:
            first = _normalise_schema(concrete[0], defs)
            if isinstance(first, dict):
                merged.update(first)
        if nullable:
            merged["nullable"] = True
        for key, value in node.items():
            if key in {"anyOf", "oneOf"}:
                continue
            if key == "description":
                merged.setdefault("description", value)
        return merged

    cleaned: dict[str, Any] = {}
    for key, value in node.items():
        if key in {"$defs", "definitions", "additionalProperties", "title", "default", "examples"}:
            continue
        if key not in _ALLOWED_KEYWORDS:
            continue
        if key == "properties" and isinstance(value, dict):
            cleaned[key] = {name: _normalise_schema(sub, defs) for name, sub in value.items()}
        elif key == "items":
            cleaned[key] = _normalise_schema(value, defs)
        else:
            cleaned[key] = value
    return cleaned


def schema_for(model_cls: type) -> dict[str, Any]:
    raw = model_cls.model_json_schema()
    defs = raw.get("$defs", {})
    return _normalise_schema(raw, defs)


def _extract_text(payload: dict[str, Any]) -> str:
    """Pull the assistant text out of an Interaction resource."""
    chunks: list[str] = []
    for step in payload.get("steps") or []:
        if not isinstance(step, dict):
            continue
        if step.get("type") not in {"model_output", None}:
            continue
        for block in step.get("content") or []:
            if isinstance(block, dict) and block.get("type", "text") == "text":
                text = block.get("text")
                if isinstance(text, str):
                    chunks.append(text)
    if not chunks:
        for key in ("output_text", "text"):
            value = payload.get(key)
            if isinstance(value, str):
                chunks.append(value)
    return "".join(chunks).strip()


def _parse_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    text = text.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise AIProviderError("The model did not return JSON.") from None
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"The model returned malformed JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise AIProviderError("The model returned JSON that is not an object.")
    return parsed


class GeminiClient:
    """Minimal async wrapper around the Interactions endpoint."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def enabled(self) -> bool:
        return bool(self.settings.gemini_api_key)

    async def generate_json(
        self,
        *,
        prompt: str,
        schema: dict[str, Any],
        images: list[tuple[bytes, str]] | None = None,
    ) -> dict[str, Any]:
        if not self.enabled:
            raise AIProviderError("No Gemini API key configured.", status_code=503)

        parts: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for data, mime_type in images or []:
            import base64

            parts.append(
                {
                    "type": "image",
                    "data": base64.b64encode(data).decode("ascii"),
                    "mime_type": mime_type,
                }
            )

        body: dict[str, Any] = {
            "model": self.settings.gemini_model,
            "input": parts,
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": schema,
            },
        }
        return await self._post(body, prompt=prompt, allow_schema_retry=True)

    async def _post(
        self, body: dict[str, Any], *, prompt: str, allow_schema_retry: bool
    ) -> dict[str, Any]:
        url = f"{self.settings.gemini_api_base}/interactions"
        headers = {
            "x-goog-api-key": self.settings.gemini_api_key,
            "Content-Type": "application/json",
            "Api-Revision": "2026-05-20",
        }
        timeout = httpx.Timeout(self.settings.ai_timeout_seconds, connect=15.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=headers, json=body)
        except httpx.TimeoutException as exc:
            raise AIProviderError(
                "The AI provider timed out. Try again, or simplify the request.", status_code=504
            ) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError(f"Could not reach the AI provider: {exc}") from exc

        if response.status_code >= 400:
            detail = _error_detail(response)
            if (
                allow_schema_retry
                and response.status_code == 400
                and any(word in detail.lower() for word in ("schema", "response_format", "format"))
            ):
                logger.warning("Gemini rejected the JSON schema, retrying in prompt-only mode")
                retry_body = dict(body)
                retry_body.pop("response_format", None)
                retry_body["input"] = [
                    {
                        "type": "text",
                        "text": prompt
                        + "\n\nReturn ONLY a single JSON object. No prose, no markdown fences.",
                    }
                ] + [part for part in body["input"] if part.get("type") != "text"]
                return await self._post(retry_body, prompt=prompt, allow_schema_retry=False)
            raise AIProviderError(f"AI provider error ({response.status_code}): {detail}")

        try:
            payload = response.json()
        except ValueError as exc:
            raise AIProviderError("The AI provider returned a non-JSON response.") from exc

        text = _extract_text(payload)
        if not text:
            raise AIProviderError("The AI provider returned an empty response.")
        return _parse_json(text)


def _error_detail(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:400] or "unknown error"
    error = data.get("error") if isinstance(data, dict) else None
    if isinstance(error, dict):
        return str(error.get("message") or error)[:400]
    return str(data)[:400]
