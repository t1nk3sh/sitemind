import { useEffect, useState, type FormEvent } from "react";

import { AnalysisShell } from "../components/AnalysisShell";
import { Icon } from "../components/Icon";
import {
  Badge,
  BulletList,
  Button,
  ChipToggle,
  Field,
  PageHeader,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "../components/ui";
import { api, formatMoney, formatNumber } from "../lib/api";
import { useApp } from "../lib/store";
import type { ValuationResult } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const PROPERTY_TYPES = ["Apartment", "Villa", "Townhouse", "Commercial office", "Retail", "Industrial", "Plot"];
const CONDITIONS = ["excellent", "good", "fair", "poor"] as const;
const AMENITIES = ["parking", "lift", "gym", "pool", "security", "garden", "power backup", "clubhouse"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD"];

export function ValuationPage() {
  const { activeProject } = useApp();
  const [location, setLocation] = useState(activeProject?.location ?? "");
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [area, setArea] = useState(activeProject?.built_area_sqm ? String(activeProject.built_area_sqm) : "120");
  const [landArea, setLandArea] = useState("");
  const [age, setAge] = useState("5");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("good");
  const [floors, setFloors] = useState(activeProject?.floors ? String(activeProject.floors) : "1");
  const [units, setUnits] = useState("1");
  const [amenities, setAmenities] = useState<string[]>(["parking"]);
  const [currency, setCurrency] = useState(activeProject?.currency ?? "USD");
  const [notes, setNotes] = useState("");
  const { result, loading, error, run } = useAnalysis<ValuationResult>(api.analyze.valuation);

  useEffect(() => {
    if (!activeProject) return;
    setLocation((current) => current || activeProject.location);
    setCurrency((current) => current || activeProject.currency);
  }, [activeProject]);

  function toggleAmenity(value: string) {
    setAmenities((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      project_id: activeProject?.id ?? null,
      location,
      property_type: propertyType.toLowerCase(),
      built_area_sqm: Number(area) || 0,
      land_area_sqm: landArea ? Number(landArea) : null,
      age_years: Number(age) || 0,
      condition,
      floors: Number(floors) || 1,
      unit_count: Number(units) || 1,
      amenities,
      currency,
      notes,
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Analyze · structured data"
        title="Real estate valuation"
        description="A defensible desktop estimate with the adjustment trail exposed: location benchmark, condition, age, amenities and the uncertainty that remains."
        actions={<Badge tone="neutral">Desktop estimate</Badge>}
      />

      <div className="work-grid">
        <Panel title="Asset data" subtitle="The more accurate the inputs, the tighter the range" className="form-panel">
          <form onSubmit={submit} className="form">
            <Field label="Location">
              <TextInput
                required
                placeholder="Mumbai, India"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>

            <div className="field-row">
              <Field label="Property type">
                <Select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Condition">
                <Select
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as (typeof CONDITIONS)[number])}
                >
                  {CONDITIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="field-row">
              <Field label="Built area (sqm)">
                <TextInput
                  type="number"
                  min={1}
                  required
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                />
              </Field>
              <Field label="Land area (sqm)">
                <TextInput
                  type="number"
                  min={0}
                  placeholder="optional"
                  value={landArea}
                  onChange={(event) => setLandArea(event.target.value)}
                />
              </Field>
            </div>

            <div className="field-row field-row-3">
              <Field label="Age (years)">
                <TextInput
                  type="number"
                  min={0}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                />
              </Field>
              <Field label="Floors">
                <TextInput
                  type="number"
                  min={1}
                  value={floors}
                  onChange={(event) => setFloors(event.target.value)}
                />
              </Field>
              <Field label="Units">
                <TextInput
                  type="number"
                  min={1}
                  value={units}
                  onChange={(event) => setUnits(event.target.value)}
                />
              </Field>
            </div>

            <Field label="Amenities">
              <ChipToggle options={AMENITIES} selected={amenities} onToggle={toggleAmenity} />
            </Field>

            <Field label="Currency">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </Select>
            </Field>

            <Field label="Notes">
              <TextArea
                rows={2}
                placeholder="Corner unit, sea-facing, recently renovated kitchen."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            <Button type="submit" icon="coins" loading={loading} block>
              Estimate value
            </Button>
          </form>
        </Panel>

        <AnalysisShell
          envelope={result}
          loading={loading}
          error={error}
          empty={{
            title: "No valuation yet",
            body: "Enter the asset details to get an estimated value, a defensible range and the factors that moved the number.",
          }}
          onRetry={() => void run({ location, built_area_sqm: Number(area) || 0, property_type: propertyType.toLowerCase() })}
        >
          {result && (
            <div className="stack">
              <div className="valuation-hero">
                <div>
                  <span className="eyebrow">Estimated market value</span>
                  <h2 className="valuation-value">
                    {formatMoney(result.result.estimated_value, result.result.currency)}
                  </h2>
                  <p className="muted">
                    {formatMoney(result.result.price_per_sqm, result.result.currency)} per sqm ·{" "}
                    {formatNumber(Number(area))} sqm
                  </p>
                </div>
                <div className="confidence">
                  <span>Confidence</span>
                  <strong>{Math.round(result.result.confidence * 100)}%</strong>
                </div>
              </div>

              <RangeBar
                low={result.result.value_range.low}
                high={result.result.value_range.high}
                value={result.result.estimated_value}
                currency={result.result.currency}
              />

              <section>
                <h4 className="section-title">What moved the number</h4>
                <ul className="factors">
                  {result.result.factors.map((factor, index) => (
                    <li key={`${factor.factor}-${index}`}>
                      <span className={`factor-dot factor-${factor.impact}`} />
                      <div>
                        <strong>{factor.factor}</strong>
                        <p>{factor.note}</p>
                      </div>
                      <Badge tone={factor.impact === "positive" ? "ok" : factor.impact === "negative" ? "danger" : "neutral"}>
                        {factor.impact}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mini-panel">
                <h4>Market outlook</h4>
                <p>{result.result.market_outlook}</p>
              </section>

              <div className="split">
                <section className="mini-panel">
                  <h4>Assumptions</h4>
                  <BulletList items={result.result.assumptions} />
                </section>
                <section className="mini-panel">
                  <h4>Comparable evidence</h4>
                  <BulletList items={result.result.comparable_notes} />
                </section>
              </div>
            </div>
          )}
        </AnalysisShell>
      </div>
    </div>
  );
}

function RangeBar({
  low,
  high,
  value,
  currency,
}: {
  low: number;
  high: number;
  value: number;
  currency: string;
}) {
  const span = Math.max(high - low, 1);
  const position = Math.max(0, Math.min(100, ((value - low) / span) * 100));
  return (
    <div className="range">
      <div className="range-labels">
        <span>{formatMoney(low, currency)}</span>
        <span className="range-mid">
          <Icon name="target" size={12} /> point estimate
        </span>
        <span>{formatMoney(high, currency)}</span>
      </div>
      <div className="range-track">
        <div className="range-fill" />
        <div className="range-marker" style={{ left: `${position}%` }} />
      </div>
      <p className="range-hint">
        Range width is {Math.round((span / Math.max(value, 1)) * 100)}% of the point estimate — tighten
        it with verified comparables and an inspection.
      </p>
    </div>
  );
}

