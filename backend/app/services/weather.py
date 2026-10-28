"""Current weather for a site location via Open-Meteo (no API key required)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WMO_CONDITIONS = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "freezing fog",
    51: "light drizzle",
    53: "drizzle",
    55: "dense drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "rain showers",
    81: "moderate showers",
    82: "violent showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "severe thunderstorm with hail",
}


def condition_from_code(code: int | None) -> str:
    if code is None:
        return "unknown"
    return WMO_CONDITIONS.get(int(code), "mixed conditions")


async def geocode(location: str) -> dict[str, Any] | None:
    params = {"name": location, "count": 1, "language": "en", "format": "json"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(GEOCODE_URL, params=params)
        response.raise_for_status()
        payload = response.json()
    results = payload.get("results") or []
    if not results:
        return None
    top = results[0]
    label = ", ".join(
        part for part in (top.get("name"), top.get("admin1"), top.get("country")) if part
    )
    return {
        "label": label,
        "latitude": top.get("latitude"),
        "longitude": top.get("longitude"),
    }


async def current_weather(
    *, latitude: float, longitude: float, location_label: str
) -> dict[str, Any]:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(FORECAST_URL, params=params)
        response.raise_for_status()
        payload = response.json()
    current = payload.get("current") or {}
    return {
        "available": True,
        "resolved_location": location_label,
        "latitude": latitude,
        "longitude": longitude,
        "condition": condition_from_code(current.get("weather_code")),
        "temperature_c": current.get("temperature_2m"),
        "precipitation_mm": current.get("precipitation"),
        "wind_kph": current.get("wind_speed_10m"),
        "humidity_percent": current.get("relative_humidity_2m"),
        "source": "open-meteo",
        "observed_at": current.get("time"),
    }


async def weather_for_location(location: str) -> dict[str, Any]:
    """Never raises: the UI falls back to manual weather entry."""
    try:
        place = await geocode(location)
        if place is None:
            return {
                "available": False,
                "reason": f"Could not resolve '{location}' to coordinates.",
                "source": "open-meteo",
            }
        return await current_weather(
            latitude=place["latitude"],
            longitude=place["longitude"],
            location_label=place["label"],
        )
    except httpx.HTTPError as exc:
        logger.warning("Weather lookup failed: %s", exc)
        return {
            "available": False,
            "reason": "The weather service is unreachable right now; enter conditions manually.",
            "source": "open-meteo",
        }
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Unexpected weather error: %s", exc)
        return {
            "available": False,
            "reason": "Weather lookup failed; enter conditions manually.",
            "source": "open-meteo",
        }
