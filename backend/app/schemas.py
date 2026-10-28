"""Strict JSON data contracts shared by the AI layer, the API and the React client.

Every AI response is validated against one of these Pydantic models before it is
persisted or returned, so the frontend can rely on a stable shape regardless of
what the model produced.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["low", "medium", "high", "critical"]
ImpactKind = Literal["positive", "neutral", "negative"]
Confidence = float


class Contract(BaseModel):
    """Base class: tolerant of extra keys, strict about declared ones."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# Uploads
# ---------------------------------------------------------------------------
class UploadOut(Contract):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    url: str
    created_at: str


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
ProjectStatus = Literal["planning", "in_progress", "on_hold", "completed"]


class ProjectIn(Contract):
    name: str = Field(min_length=1, max_length=160)
    project_type: str = "residential"
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    built_area_sqm: Optional[float] = Field(default=None, ge=0)
    floors: Optional[int] = Field(default=None, ge=0)
    budget: Optional[float] = Field(default=None, ge=0)
    currency: str = "USD"
    status: ProjectStatus = "planning"
    start_date: Optional[str] = None
    description: str = ""


class ProjectPatch(Contract):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    project_type: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    built_area_sqm: Optional[float] = Field(default=None, ge=0)
    floors: Optional[int] = Field(default=None, ge=0)
    budget: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    status: Optional[ProjectStatus] = None
    start_date: Optional[str] = None
    description: Optional[str] = None


class ProjectOut(Contract):
    id: str
    name: str
    project_type: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    built_area_sqm: Optional[float] = None
    floors: Optional[int] = None
    budget: Optional[float] = None
    currency: str
    status: str
    start_date: Optional[str] = None
    description: str
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# 1. Construction site safety monitoring
# ---------------------------------------------------------------------------
class PpeCompliance(Contract):
    helmets: Literal["compliant", "partial", "non_compliant", "unclear"] = "unclear"
    high_visibility_vests: Literal["compliant", "partial", "non_compliant", "unclear"] = "unclear"
    fall_protection: Literal["compliant", "partial", "non_compliant", "unclear", "not_applicable"] = (
        "unclear"
    )
    footwear: Literal["compliant", "partial", "non_compliant", "unclear"] = "unclear"
    observations: list[str] = Field(default_factory=list)


class SafetyHazard(Contract):
    hazard_type: str = "unspecified hazard"
    severity: Severity = "medium"
    description: str = ""
    location_hint: str = "not localised"
    recommendation: str = ""


class SafetyResult(Contract):
    overall_risk_level: Severity = "medium"
    risk_score: int = Field(default=50, ge=0, le=100)
    ppe_compliance: PpeCompliance = Field(default_factory=PpeCompliance)
    hazards: list[SafetyHazard] = Field(default_factory=list)
    unsafe_observations: list[str] = Field(default_factory=list)
    housekeeping_rating: int = Field(default=3, ge=1, le=5)
    confidence: float = Field(default=0.6, ge=0, le=1)
    immediate_actions: list[str] = Field(default_factory=list)
    summary: str = ""


class SafetyRequest(Contract):
    project_id: Optional[str] = None
    image_upload_ids: list[str] = Field(min_length=1, max_length=3)
    work_type: str = ""
    focus_areas: list[str] = Field(default_factory=list)
    notes: str = ""


# ---------------------------------------------------------------------------
# 2. Structural crack detection and analysis
# ---------------------------------------------------------------------------
class CrackFinding(Contract):
    crack_id: str = "C1"
    crack_type: str = "unspecified"
    orientation: str = "unknown"
    estimated_width_mm: float = Field(default=0.0, ge=0)
    estimated_length_m: float = Field(default=0.0, ge=0)
    severity: Severity = "medium"
    likely_cause: str = ""
    recommended_repair: str = ""
    urgency: Literal["monitor", "schedule", "urgent", "immediate"] = "schedule"
    notes: str = ""


class CrackResult(Contract):
    crack_detected: bool = False
    overall_severity: Severity = "low"
    structural_concern: bool = False
    cracks: list[CrackFinding] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    monitoring_advice: str = ""
    confidence: float = Field(default=0.6, ge=0, le=1)
    summary: str = ""


class CrackRequest(Contract):
    project_id: Optional[str] = None
    image_upload_ids: list[str] = Field(min_length=1, max_length=3)
    element_type: str = "concrete wall"
    scale_reference: str = ""
    notes: str = ""


# ---------------------------------------------------------------------------
# 3. Real estate valuation
# ---------------------------------------------------------------------------
class ValuationRange(Contract):
    low: float = 0.0
    high: float = 0.0


class ValuationFactor(Contract):
    factor: str = ""
    impact: ImpactKind = "neutral"
    note: str = ""


class ValuationResult(Contract):
    estimated_value: float = 0.0
    currency: str = "USD"
    value_range: ValuationRange = Field(default_factory=ValuationRange)
    price_per_sqm: float = 0.0
    confidence: float = Field(default=0.6, ge=0, le=1)
    factors: list[ValuationFactor] = Field(default_factory=list)
    comparable_notes: list[str] = Field(default_factory=list)
    market_outlook: str = ""
    assumptions: list[str] = Field(default_factory=list)
    summary: str = ""


class ValuationRequest(Contract):
    project_id: Optional[str] = None
    location: str = Field(min_length=1)
    property_type: str = "apartment"
    built_area_sqm: float = Field(gt=0)
    land_area_sqm: Optional[float] = Field(default=None, ge=0)
    age_years: int = Field(default=0, ge=0)
    condition: Literal["excellent", "good", "fair", "poor"] = "good"
    floors: int = Field(default=1, ge=1)
    unit_count: int = Field(default=1, ge=1)
    amenities: list[str] = Field(default_factory=list)
    currency: str = "USD"
    notes: str = ""


# ---------------------------------------------------------------------------
# 4. Construction project planning
# ---------------------------------------------------------------------------
class Phase(Contract):
    name: str = ""
    start_week: int = Field(default=1, ge=0)
    duration_weeks: int = Field(default=1, ge=0)
    key_tasks: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    crew_size: int = Field(default=0, ge=0)
    equipment: list[str] = Field(default_factory=list)


class Milestone(Contract):
    name: str = ""
    week: int = Field(default=1, ge=0)
    deliverable: str = ""


class CostLine(Contract):
    category: str = ""
    percent: float = Field(default=0.0, ge=0, le=100)
    amount: float = Field(default=0.0, ge=0)


class RiskItem(Contract):
    risk: str = ""
    likelihood: Severity = "medium"
    impact: Severity = "medium"
    mitigation: str = ""


class PlanningResult(Contract):
    total_duration_weeks: int = Field(default=12, ge=0)
    estimated_cost: float = Field(default=0.0, ge=0)
    currency: str = "USD"
    phases: list[Phase] = Field(default_factory=list)
    milestones: list[Milestone] = Field(default_factory=list)
    critical_path: list[str] = Field(default_factory=list)
    cost_breakdown: list[CostLine] = Field(default_factory=list)
    risks: list[RiskItem] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    summary: str = ""


class PlanningRequest(Contract):
    project_id: Optional[str] = None
    project_type: str = "residential"
    location: str = Field(min_length=1)
    built_area_sqm: float = Field(gt=0)
    floors: int = Field(default=1, ge=1)
    budget: Optional[float] = Field(default=None, ge=0)
    currency: str = "USD"
    start_date: Optional[str] = None
    constraints: list[str] = Field(default_factory=list)
    priorities: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 5. Daily site assistance and weather advisory
# ---------------------------------------------------------------------------
class WeatherSnapshot(Contract):
    condition: str = "clear"
    temperature_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_kph: Optional[float] = None
    humidity_percent: Optional[float] = None
    source: str = "manual"


class WeatherAdvisory(Contract):
    condition_summary: str = ""
    impact_level: Severity = "low"
    work_restrictions: list[str] = Field(default_factory=list)
    scheduling_advice: list[str] = Field(default_factory=list)
    safety_notes: list[str] = Field(default_factory=list)


class CrewTask(Contract):
    task: str = ""
    crew: str = "general crew"
    notes: str = ""


class DailySiteResult(Contract):
    briefing: str = ""
    priorities: list[str] = Field(default_factory=list)
    weather_advisory: WeatherAdvisory = Field(default_factory=WeatherAdvisory)
    crew_assignments: list[CrewTask] = Field(default_factory=list)
    inspection_checklist: list[str] = Field(default_factory=list)
    summary: str = ""


class DailySiteRequest(Contract):
    project_id: Optional[str] = None
    site_name: str = ""
    date: Optional[str] = None
    planned_tasks: list[str] = Field(default_factory=list)
    crew_size: int = Field(default=0, ge=0)
    notes: str = ""
    weather: Optional[WeatherSnapshot] = None


# ---------------------------------------------------------------------------
# 6. Construction knowledge assistant
# ---------------------------------------------------------------------------
class KnowledgeResult(Contract):
    answer: str = ""
    key_points: list[str] = Field(default_factory=list)
    related_topics: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.6, ge=0, le=1)
    summary: str = ""


class KnowledgeRequest(Contract):
    question: str = Field(min_length=3, max_length=4000)
    project_id: Optional[str] = None
    discipline: str = ""
    image_upload_ids: list[str] = Field(default_factory=list, max_length=2)


# ---------------------------------------------------------------------------
# Envelopes
# ---------------------------------------------------------------------------
class AnalysisOut(Contract):
    """Response envelope for every AI feature."""

    id: str
    kind: str
    title: str
    mode: Literal["live", "demo"]
    summary: str
    project_id: Optional[str] = None
    created_at: str
    result: dict
    warnings: list[str] = Field(default_factory=list)
