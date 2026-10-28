"""Deterministic offline results used when no Gemini API key is configured.

The generators derive their numbers from the actual request (area, location,
weather, planned tasks) so the product is fully demoable and testable without a
key. Every response produced here is tagged ``mode="demo"`` by the engine.
"""

from __future__ import annotations

import hashlib
import json
import random
from typing import Any

SAFETY_HAZARDS = [
    {
        "hazard_type": "Unprotected floor opening",
        "severity": "critical",
        "description": "An open slab penetration near the working edge has no cover or guard rail.",
        "location_hint": "foreground, left of the access stair",
        "recommendation": "Install fitted plywood covers fixed with battens and a toe board, or a 1.1 m guard rail with mid-rail before work resumes.",
    },
    {
        "hazard_type": "Missing fall protection",
        "severity": "high",
        "description": "Workers are visible within 2 m of an unguarded edge without harnesses or anchor points.",
        "location_hint": "upper deck, right side of frame",
        "recommendation": "Stop edge work, install perimeter guard rails, and require harnesses on a certified anchor line for anyone inside 2 m of the edge.",
    },
    {
        "hazard_type": "Head protection non-compliance",
        "severity": "high",
        "description": "Two workers are not wearing hard hats inside the active work zone.",
        "location_hint": "mid-ground, near the material stack",
        "recommendation": "Hold a toolbox talk on PPE, issue helmets at the gate, and make the gate marshal responsible for entry checks.",
    },
    {
        "hazard_type": "Blocked access route",
        "severity": "medium",
        "description": "Stacked formwork narrows the walkway to under 600 mm and obstructs the emergency egress.",
        "location_hint": "corridor between the tower crane base and the site office",
        "recommendation": "Relocate formwork to the designated lay-down area and mark a 1.2 m clear walkway with barrier tape.",
    },
    {
        "hazard_type": "Poor housekeeping",
        "severity": "medium",
        "description": "Offcuts, binding wire and packaging are scattered across the working platform.",
        "location_hint": "scaffold platform, level 2",
        "recommendation": "Assign an end-of-shift clean-up rota and place a waste bin on every second platform lift.",
    },
    {
        "hazard_type": "Unsafe ladder use",
        "severity": "high",
        "description": "A ladder is set at a shallow angle and not tied off at the top.",
        "location_hint": "against the blockwork wall, centre of frame",
        "recommendation": "Use the 4:1 rule, tie the stiles at the top, and provide a second person to foot the ladder or switch to a mobile tower.",
    },
    {
        "hazard_type": "Electrical cable across walkway",
        "severity": "medium",
        "description": "A temporary power cable runs unprotected across a pedestrian route.",
        "location_hint": "entrance to the rebar yard",
        "recommendation": "Route the cable overhead or in a cable ramp, and fit an RCD-protected distribution board.",
    },
    {
        "hazard_type": "Unsecured material stack",
        "severity": "high",
        "description": "Rebar bundles are stacked above shoulder height without chocks or bindings.",
        "location_hint": "lay-down area, background",
        "recommendation": "De-stack to below 1.5 m, fit spacers and chocks, and keep the bundles tied until lifting.",
    },
]

CRACK_CAUSES = {
    "wall": ("shrinkage or differential settlement", "Polymer-modified repair mortar after routing the crack into a V-groove; monitor for 8 weeks."),
    "column": ("axial overload or reinforcement corrosion", "Structural review, half-cell potential testing, then epoxy injection under a specialist's specification."),
    "beam": ("flexural cracking or shear distress", "Structural assessment; epoxy injection for flexural cracks, immediate propping if shear pattern is confirmed."),
    "slab": ("shrinkage, early loading or flexural action", "Crack stitching with helical ties and a cementitious overlay; verify slab deflection against design."),
    "foundation": ("settlement or soil movement", "Underpinning assessment by a geotechnical engineer; install crack gauges before any repair."),
    "pavement": ("thermal movement or sub-base failure", "Rout, clean and seal with a hot-pour bituminous sealant; repair the sub-base if pumping is visible."),
}

GENERIC_HINTS = {
    "concrete": "Keep the water-cement ratio at or below 0.45, cure for at least 7 days (10-14 for hot weather), and verify cover with a cover meter before casting.",
    "rebar": "Confirm bar diameter, spacing and lap lengths against the bar bending schedule, and photograph the reinforcement before the pre-pour inspection.",
    "curing": "Start curing as soon as the surface can take it; wet hessian or a curing compound both work, but the surface must stay moist, not just damp once a day.",
    "formwork": "Check prop spacing, striking times and the alignment of joints; a 3 mm joint gap is enough to lose grout and create honeycombing.",
    "safety": "Hierarchy of controls: eliminate the exposure, then guard it, then manage the residual risk with PPE. PPE is the last line, never the plan.",
    "waterproofing": "Surface preparation decides the result. Use a primed, dust-free substrate, two coats at right angles, and a flood test before covering.",
    "cost": "Track committed cost against earned value weekly; a 5% variance caught at 20% completion is cheap to fix, at 80% it is not.",
}


def _seed(payload: dict[str, Any]) -> int:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    return int(digest[:8], 16)


def _round(value: float, digits: int = 1) -> float:
    return round(float(value), digits)


def _safety(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    focus = {f.lower() for f in payload.get("focus_areas") or []}
    work = (payload.get("work_type") or "").lower()
    pool = list(SAFETY_HAZARDS)
    if "fall" in focus or "edge" in work or "height" in work:
        pool.sort(key=lambda h: "fall" not in h["hazard_type"].lower())
    count = rng.randint(3, min(5, len(pool)))
    hazards = rng.sample(pool, count)
    score = rng.randint(46, 86)
    level = "critical" if score >= 80 else "high" if score >= 66 else "medium" if score >= 45 else "low"
    ppe = {
        "helmets": rng.choice(["partial", "non_compliant", "compliant"]),
        "high_visibility_vests": rng.choice(["partial", "compliant"]),
        "fall_protection": rng.choice(["non_compliant", "partial", "not_applicable"]),
        "footwear": rng.choice(["compliant", "partial"]),
        "observations": [
            "PPE checks are inconsistent at the site gate.",
            "Visibility vests are worn but several are dirty and hard to see.",
        ],
    }
    return {
        "overall_risk_level": level,
        "risk_score": score,
        "ppe_compliance": ppe,
        "hazards": hazards,
        "unsafe_observations": [
            "Supervision is concentrated at one work front while two others are unattended.",
            "Housekeeping deteriorates towards the end of the shift.",
        ],
        "housekeeping_rating": rng.randint(2, 4),
        "confidence": _round(rng.uniform(0.62, 0.82), 2),
        "immediate_actions": [
            "Stop work at the affected front and brief the crew on the top two hazards.",
            "Close out all critical and high findings before the next shift starts.",
            "Photograph each corrective action for the safety register.",
        ],
        "summary": (
            f"Visual review of {count} active work fronts identified {count} reportable hazards, "
            f"with an overall risk score of {score}/100 ({level}). The dominant exposure is "
            f"{hazards[0]['hazard_type'].lower()}."
        ),
    }


def _cracks(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    element = (payload.get("element_type") or "concrete wall").lower()
    key = next((k for k in CRACK_CAUSES if k in element), "wall")
    cause, repair = CRACK_CAUSES[key]
    width = rng.choice([0.08, 0.12, 0.18, 0.25, 0.4, 0.75, 1.3])
    severity = "critical" if width >= 1.0 else "high" if width >= 0.4 else "medium" if width >= 0.15 else "low"
    urgency = "immediate" if width >= 1.0 else "urgent" if width >= 0.4 else "schedule" if width >= 0.15 else "monitor"
    patterns = {
        "wall": ["diagonal stair-step", "vertical shrinkage"],
        "column": ["vertical splitting", "diagonal shear"],
        "beam": ["flexural (vertical)", "shear (diagonal)"],
        "slab": ["map cracking", "flexural (parallel to support)"],
        "foundation": ["diagonal settlement", "horizontal movement"],
        "pavement": ["transverse thermal", "alligator"],
    }[key]
    count = 2 if width >= 0.4 else 1
    cracks = []
    for index in range(count):
        cracks.append(
            {
                "crack_id": f"C{index + 1}",
                "crack_type": patterns[index % len(patterns)],
                "orientation": rng.choice(["diagonal", "vertical", "horizontal"]),
                "estimated_width_mm": width if index == 0 else _round(width * 0.6, 2),
                "estimated_length_m": _round(rng.uniform(0.4, 2.6), 1),
                "severity": severity,
                "likely_cause": cause,
                "recommended_repair": repair,
                "urgency": urgency,
                "notes": "Width estimated visually; confirm with a crack comparator or microscope.",
            }
        )
    structural = width >= 0.6 or key in {"column", "beam"} and width >= 0.4
    return {
        "crack_detected": True,
        "overall_severity": severity,
        "structural_concern": structural,
        "cracks": cracks,
        "recommended_actions": [
            "Record the crack on the defect register with a dated photograph and a scale reference.",
            "Install tell-tales or a crack gauge across the widest point and read weekly for 4 weeks.",
            "Do not plaster over the crack until movement has stabilised.",
        ],
        "monitoring_advice": (
            "Monitor weekly for the first month, then monthly. Movement beyond 0.3 mm in a month, "
            "or any change in crack width during loading, needs an engineer's review."
        ),
        "confidence": _round(rng.uniform(0.6, 0.85), 2),
        "summary": (
            f"A {patterns[0]} crack of approximately {width} mm was identified on the {element}. "
            f"Likely cause: {cause}. "
            + ("Structural review is recommended before repair." if structural else "No immediate structural concern, but movement should be monitored.")
        ),
    }


RATE_BY_CITY = {
    "mumbai": 1850,
    "bengaluru": 1520,
    "bangalore": 1520,
    "delhi": 1400,
    "pune": 1300,
    "chennai": 1350,
    "hyderabad": 1280,
    "dubai": 3300,
    "riyadh": 2400,
    "doha": 2800,
    "london": 8600,
    "manchester": 4200,
    "new york": 11500,
    "san francisco": 12200,
    "austin": 5200,
    "singapore": 14500,
    "sydney": 9800,
    "toronto": 7200,
    "berlin": 6400,
    "nairobi": 1150,
}


def _valuation(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    location = str(payload.get("location") or "").lower()
    area = float(payload.get("built_area_sqm") or 100)
    condition = str(payload.get("condition") or "good").lower()
    age = int(payload.get("age_years") or 0)
    ptype = str(payload.get("property_type") or "apartment").lower()
    amenities = payload.get("amenities") or []

    base = next((rate for city, rate in RATE_BY_CITY.items() if city in location), 1650)
    type_mult = {"apartment": 1.0, "villa": 1.18, "townhouse": 1.1, "commercial": 1.28, "retail": 1.3, "industrial": 0.78, "plot": 0.7}.get(ptype, 1.0)
    condition_mult = {"excellent": 1.12, "good": 1.0, "fair": 0.88, "poor": 0.72}.get(condition, 1.0)
    age_mult = max(0.58, 1 - 0.011 * age)
    amenity_mult = min(1.12, 1 + 0.012 * len(amenities))
    floors = max(1, int(payload.get("floors") or 1))
    floor_mult = 1 + min(0.05, (floors - 1) * 0.01)

    rate = base * type_mult * condition_mult * age_mult * amenity_mult * floor_mult
    value = area * rate
    value = _round(value, -3)
    low = _round(value * rng.uniform(0.9, 0.94), -3)
    high = _round(value * rng.uniform(1.08, 1.14), -3)

    factors = [
        {"factor": "Location micro-market", "impact": "positive", "note": f"{payload.get('location')} benchmarks at roughly {int(base)} per sqm for this asset class."},
        {"factor": "Building age", "impact": "negative" if age > 10 else "neutral", "note": f"{age} years old; depreciation applied at about 1.1% per year, floored at 42% of new-build value."},
        {"factor": "Condition", "impact": "positive" if condition in {"good", "excellent"} else "negative", "note": f"Condition rated {condition}, applying a {int((condition_mult - 1) * 100)}% adjustment."},
        {"factor": "Amenities", "impact": "positive", "note": f"{len(amenities)} noted amenities add about {int((amenity_mult - 1) * 100)}% to the achievable rate."},
    ]
    return {
        "estimated_value": value,
        "currency": payload.get("currency") or "USD",
        "value_range": {"low": low, "high": high},
        "price_per_sqm": _round(value / area, 2),
        "confidence": _round(rng.uniform(0.6, 0.78), 2),
        "factors": factors,
        "comparable_notes": [
            "Desktop estimates are anchored on segment-level rates, not on a specific transaction.",
            "A physical inspection and three verified comparables would tighten the range by roughly half.",
        ],
        "market_outlook": (
            "Balanced market with steady absorption. Well-maintained stock in established "
            "locations is holding value, while older or poorly maintained assets are taking "
            "longer to transact and are more price-sensitive."
        ),
        "assumptions": [
            "Clear and marketable title with no encumbrances.",
            "No structural defects or unauthorised additions.",
            f"Built area of {_round(area)} sqm is as declared and measured to the same standard as the comparables.",
            "Currency is nominal and not adjusted for inflation over the holding period.",
        ],
        "summary": (
            f"Estimated market value is {payload.get('currency') or 'USD'} {value:,.0f} "
            f"({_round(value / area, 2):,} per sqm) for {_round(area)} sqm of {ptype} in "
            f"{payload.get('location')}, with a defensible range of {low:,.0f} to {high:,.0f}."
        ),
    }


def _planning(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    area = float(payload.get("built_area_sqm") or 500)
    floors = max(1, int(payload.get("floors") or 1))
    ptype = str(payload.get("project_type") or "residential").lower()
    currency = payload.get("currency") or "USD"
    budget = payload.get("budget")

    total = max(10, round(6 + area / 70 + floors * 3))
    template = [
        ("Mobilisation and permits", 0.06, 8, ["Site handover", "Setting out", "Site offices and utilities"]),
        ("Site preparation and excavation", 0.10, 14, ["Clearing", "Excavation", "Shoring", "Dewatering"]),
        ("Foundation and substructure", 0.16, 22, ["PCC", "Footings", "Plinth beams", "Waterproofing"]),
        ("Superstructure", 0.30, 45, ["Columns", "Beams", "Slabs", "Staircases"]),
        ("Envelope and facade", 0.09, 20, ["Blockwork", "Plaster", "Windows", "External paint"]),
        ("MEP rough-in", 0.12, 26, ["Electrical conduits", "Plumbing", "HVAC ducts", "Fire lines"]),
        ("Finishes and fit-out", 0.13, 30, ["Flooring", "Doors", "Kitchen and bath", "Painting"]),
        ("Testing, commissioning and handover", 0.04, 10, ["Snagging", "Testing", "As-builts", "Handover"]),
    ]
    start = 1
    phases = []
    milestones = []
    for name, weight, crew, tasks in template:
        duration = max(1, round(total * weight))
        phases.append(
            {
                "name": name,
                "start_week": start,
                "duration_weeks": duration,
                "key_tasks": tasks,
                "dependencies": [phases[-1]["name"]] if phases else [],
                "crew_size": crew,
                "equipment": {
                    "Site preparation and excavation": ["Excavator", "Tipper trucks", "Dewatering pumps"],
                    "Foundation and substructure": ["Concrete pump", "Vibrators", "Bar bending machine"],
                    "Superstructure": ["Tower crane", "Concrete pump", "Formwork system"],
                    "Envelope and facade": ["Scaffolding", "Material hoist"],
                    "MEP rough-in": ["Pipe threading machine", "Conduit benders"],
                }.get(name, ["Hand tools", "Power tools"]),
            }
        )
        milestones.append(
            {
                "name": f"{name} complete",
                "week": start + duration - 1,
                "deliverable": f"Signed inspection and QA records for {name.lower()}.",
            }
        )
        start += duration

    total_duration = start - 1
    rate = {"residential": 950, "commercial": 1250, "industrial": 720, "infrastructure": 1500, "renovation": 620}.get(ptype, 950)
    estimated = float(budget) if budget else _round(area * rate * (1 + 0.06 * (floors - 1)), -3)
    breakdown_weights = [
        ("Substructure and earthworks", 14),
        ("Structure and concrete", 30),
        ("Envelope and finishes", 20),
        ("MEP services", 18),
        ("Preliminaries and site overheads", 9),
        ("Professional fees", 5),
        ("Contingency", 4),
    ]
    cost_breakdown = [
        {"category": name, "percent": pct, "amount": _round(estimated * pct / 100, -2)}
        for name, pct in breakdown_weights
    ]
    risks = [
        {"risk": "Monsoon or seasonal weather stopping excavation and concrete pours", "likelihood": "high", "impact": "high", "mitigation": "Schedule earthworks outside the wet season and keep a dewatering allowance in the preliminaries."},
        {"risk": "Rebar and cement price escalation", "likelihood": "medium", "impact": "medium", "mitigation": "Lock rates for the structural package and hold a 4% contingency."},
        {"risk": "Labour shortage during the festive season", "likelihood": "high", "impact": "medium", "mitigation": "Pre-book crews for peak phases and cross-train for finishing trades."},
        {"risk": "Late design changes to MEP layouts", "likelihood": "medium", "impact": "high", "mitigation": "Freeze the coordinated MEP model before the rough-in phase starts."},
    ]
    return {
        "total_duration_weeks": total_duration,
        "estimated_cost": estimated,
        "currency": currency,
        "phases": phases,
        "milestones": milestones,
        "critical_path": [phase["name"] for phase in phases],
        "cost_breakdown": cost_breakdown,
        "risks": risks,
        "assumptions": [
            "Single shift of 8 hours, six days a week.",
            "Statutory approvals are granted on the planned dates.",
            "Site has road access for delivery vehicles and temporary power.",
            f"Rates benchmarked for {ptype} construction in {payload.get('location') or 'the stated market'}.",
        ],
        "summary": (
            f"A {total_duration}-week programme in {len(phases)} phases for {_round(area)} sqm "
            f"across {floors} floor(s), with an indicative cost of {currency} {estimated:,.0f}. "
            "Superstructure is the controlling phase for the critical path."
        ),
    }


_LEVEL_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _daily_site(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    tasks = [t for t in (payload.get("planned_tasks") or []) if t] or [
        "Continue reinforcement fixing on level 2",
        "Pre-pour inspection for slab zone B",
        "Shift formwork to the east bay",
    ]
    weather = payload.get("weather") or {}
    condition = str(weather.get("condition") or "clear").lower()
    temp = weather.get("temperature_c")
    temp = 29.0 if temp is None else float(temp)
    precip = float(weather.get("precipitation_mm") or 0)
    wind = float(weather.get("wind_kph") or 12)

    restrictions: list[str] = []
    advice: list[str] = []
    notes: list[str] = ["Maintain hydration breaks and shaded rest areas."]
    impact = "low"

    def escalate(candidate: str) -> None:
        """Weather impact is the worst of the individual drivers, never the last."""
        nonlocal impact
        if _LEVEL_RANK[candidate] > _LEVEL_RANK[impact]:
            impact = candidate

    if precip >= 2:
        escalate("high" if precip >= 8 else "medium")
        restrictions.append("Suspend concrete pours and external painting while rain continues.")
        advice.append("Move interior blockwork and MEP rough-in forward to protect the programme.")
        notes.append("Check excavations for standing water and pump out before entry.")
    if wind >= 38:
        escalate("high" if wind >= 50 else "medium")
        restrictions.append("No crane lifts or facade panel handling above 38 km/h wind.")
        advice.append("Reschedule lifting to the early morning window.")
    if temp >= 35:
        escalate("high" if temp >= 40 else "medium")
        restrictions.append("Restrict heavy manual work between 12:00 and 15:00.")
        advice.append("Start at 06:00 and add a second hydration break in the afternoon.")
        notes.append("Watch for heat stress: confusion or stopped sweating means evacuate and cool immediately.")
    if temp <= 5:
        escalate("medium")
        restrictions.append("Cold-weather concrete protection required; no pours on frozen subgrade.")
        advice.append("Delay finishing operations until the surface temperature is above 5 C.")

    assignments = []
    crews = ["Steel fixing crew", "Formwork crew", "Concrete crew", "MEP crew", "Finishing crew", "General labour"]
    for index, task in enumerate(tasks[:5]):
        assignments.append(
            {
                "task": task,
                "crew": crews[index % len(crews)],
                "notes": "Verify permits and the inspection record before starting." if index == 0 else "Report progress at the 15:00 coordination call.",
            }
        )

    checklist = ["Daily plant and lifting gear inspection", "Edge protection and opening covers verified"]
    joined = " ".join(tasks).lower()
    if "concrete" in joined or "pour" in joined:
        checklist += [
            "Pre-pour checklist signed: reinforcement, cover, embeddings, formwork release agent",
            "Concrete delivery tickets and slump test records collected",
        ]
    if "mep" in joined or "electrical" in joined or "plumbing" in joined:
        checklist += ["Isolation and lock-out/tag-out confirmed for all live services"]
    if "scaffold" in joined or "facade" in joined:
        checklist += ["Scaffold tag in date and ties checked after overnight wind"]

    return {
        "briefing": (
            f"{payload.get('site_name') or 'Site'} briefing for {payload.get('date') or 'today'}: "
            f"{len(tasks)} planned activities with a crew of {payload.get('crew_size') or 'the usual'} on site. "
            f"Weather is {condition} at {temp:.0f} C"
            + (f" with {precip:.1f} mm of rain" if precip else "")
            + f" and wind at {wind:.0f} km/h, so {('the programme needs adjusting' if restrictions else 'normal sequencing holds')}."
        ),
        "priorities": tasks[:4] + ["Close out yesterday's open snags before the shift ends"],
        "weather_advisory": {
            "condition_summary": f"{condition.capitalize()}, {temp:.0f} C, wind {wind:.0f} km/h"
            + (f", {precip:.1f} mm precipitation" if precip else ""),
            "impact_level": impact,
            "work_restrictions": restrictions or ["No weather-related restrictions expected."],
            "scheduling_advice": advice or ["Proceed with the planned sequence."],
            "safety_notes": notes,
        },
        "crew_assignments": assignments,
        "inspection_checklist": checklist,
        "summary": (
            f"Shift plan issued for {len(tasks)} activities. Weather impact is {impact}; "
            f"{len(restrictions)} restriction(s) apply."
        ),
    }


def _knowledge(payload: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    question = str(payload.get("question") or "").strip()
    discipline = str(payload.get("discipline") or "").strip()
    topic = next((key for key in GENERIC_HINTS if key in question.lower()), None)
    hint = GENERIC_HINTS.get(topic or "", "Break the question into the sequence of work, the controlling constraint, and the acceptance criteria before you act.")
    return {
        "answer": (
            f"**Question:** {question}\n\n"
            f"**Practical answer.** {hint} Work through it in this order: confirm the design intent "
            f"and specification, check what is actually on site against it, then decide whether the "
            f"condition is a workmanship issue, a design issue or a loading issue. Record the finding "
            f"with photographs, dimensions and a date so the decision is auditable.\n\n"
            f"**On site.** Sequence the fix so that it does not lock in another trade's defect. "
            f"Where safety or structural stability is in question, stop the affected activity and "
            f"get a qualified engineer to inspect before work proceeds."
        ),
        "key_points": [
            "Verify the specification and the actual site condition before choosing a method.",
            "Fix the cause, not only the symptom; otherwise the defect returns.",
            "Document decisions with photos, measurements and dates.",
            "Escalate anything affecting structural stability or life safety to a licensed engineer.",
        ],
        "related_topics": [
            "Inspection and test plans (ITP)",
            "Concrete curing and durability",
            "Method statements and risk assessments",
        ],
        "caveats": [
            "This response was generated in demo mode without a language model; connect a Gemini API key for a live, project-specific answer.",
            "Code requirements vary by jurisdiction and edition — confirm against the governing local code.",
        ],
        "confidence": _round(rng.uniform(0.4, 0.55), 2),
        "summary": (f"Practical guidance requested{' for ' + discipline if discipline else ''}: {question[:120]}"),
    }


_GENERATORS = {
    "safety": _safety,
    "cracks": _cracks,
    "valuation": _valuation,
    "planning": _planning,
    "daily_site": _daily_site,
    "knowledge": _knowledge,
}


def generate(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    generator = _GENERATORS.get(kind)
    if generator is None:
        raise ValueError(f"Unknown analysis kind: {kind}")
    rng = random.Random(_seed(payload))
    return generator(payload, rng)
