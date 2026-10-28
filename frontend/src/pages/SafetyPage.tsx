import { useState, type FormEvent } from "react";

import { AnalysisShell } from "../components/AnalysisShell";
import { Icon } from "../components/Icon";
import { UploadZone } from "../components/UploadZone";
import {
  Badge,
  BulletList,
  Button,
  ChipToggle,
  Field,
  PageHeader,
  Panel,
  Select,
  SeverityChip,
  TextArea,
} from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import type { PpeCompliance, PpeStatus, SafetyResult, Upload } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const WORK_TYPES = [
  "General site work",
  "Structural work",
  "Work at height",
  "Excavation",
  "MEP installation",
  "Demolition",
  "Material handling",
  "Finishing works",
];

const FOCUS_AREAS = [
  "fall protection",
  "PPE",
  "housekeeping",
  "electrical",
  "lifting",
  "scaffolding",
  "fire safety",
];

const PPE_LABELS: Record<keyof Omit<PpeCompliance, "observations">, string> = {
  helmets: "Hard hats",
  high_visibility_vests: "Hi-vis vests",
  fall_protection: "Fall protection",
  footwear: "Safety footwear",
};

const PPE_TONE: Record<PpeStatus, "ok" | "warn" | "danger" | "neutral"> = {
  compliant: "ok",
  partial: "warn",
  non_compliant: "danger",
  unclear: "neutral",
  not_applicable: "neutral",
};

export function SafetyPage() {
  const { activeProject } = useApp();
  const [files, setFiles] = useState<Upload[]>([]);
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [focus, setFocus] = useState<string[]>(["fall protection", "PPE"]);
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { result, loading, error, run } = useAnalysis<SafetyResult>(api.analyze.safety);

  function toggleFocus(value: string) {
    setFocus((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (files.length === 0) {
      setLocalError("Attach at least one site photograph to run a safety scan.");
      return;
    }
    setLocalError(null);
    void run({
      project_id: activeProject?.id ?? null,
      image_upload_ids: files.map((file) => file.id),
      work_type: workType,
      focus_areas: focus,
      notes,
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Analyze · vision"
        title="Construction site safety monitoring"
        description="Screen site photographs for PPE compliance, unprotected edges, unsafe access and housekeeping. Hazards are ranked by credible outcome, not by how obvious they look."
        actions={
          activeProject ? (
            <Badge tone="accent">
              <Icon name="pin" size={12} /> {activeProject.name}
            </Badge>
          ) : (
            <Badge>No project context</Badge>
          )
        }
      />

      <div className="work-grid">
        <Panel title="Site evidence" subtitle="Photographs, work type and what to prioritise" className="form-panel">
          <form onSubmit={submit} className="form">
            <UploadZone files={files} onChange={setFiles} max={3} hint="Up to 3 photos · JPEG, PNG or WebP" />

            <Field label="Work type">
              <Select value={workType} onChange={(event) => setWorkType(event.target.value)}>
                {WORK_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </Select>
            </Field>

            <Field label="Focus areas" hint="Used to prioritise what the model reports first.">
              <ChipToggle options={FOCUS_AREAS} selected={focus} onToggle={toggleFocus} />
            </Field>

            <Field label="Supervisor notes">
              <TextArea
                rows={3}
                placeholder="Morning walk, level 4 slab. Two crews working near the north edge."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            {localError && <p className="field-error">{localError}</p>}

            <Button type="submit" icon="shield" loading={loading} block>
              Run safety scan
            </Button>
            <p className="form-foot">
              Images are stored locally and sent to the model only for this analysis.
            </p>
          </form>
        </Panel>

        <AnalysisShell
          envelope={result}
          loading={loading}
          error={error}
          empty={{
            title: "No scan yet",
            body: "Attach a site photograph to get a ranked hazard register, PPE compliance and same-day actions.",
          }}
          onRetry={() => void run({ image_upload_ids: files.map((file) => file.id) })}
        >
          {result && (
            <div className="stack">
              <div className="risk-band">
                <div
                  className="gauge"
                  style={{
                    background: `conic-gradient(var(--${toneFor(result.result.overall_risk_level)}) ${result.result.risk_score * 3.6}deg, rgba(255,255,255,0.06) 0)`,
                  }}
                >
                  <div className="gauge-inner">
                    <strong>{result.result.risk_score}</strong>
                    <span>risk / 100</span>
                  </div>
                </div>
                <div className="risk-copy">
                  <SeverityChip level={result.result.overall_risk_level} label={`${result.result.overall_risk_level} risk`} />
                  <h3>{result.result.summary}</h3>
                  <div className="risk-sub">
                    <span>
                      <Icon name="camera" size={14} /> Housekeeping {result.result.housekeeping_rating}/5
                    </span>
                    <span>
                      <Icon name="target" size={14} /> {result.result.hazards.length} hazard
                      {result.result.hazards.length === 1 ? "" : "s"} found
                    </span>
                  </div>
                </div>
              </div>

              <section className="mini-panel">
                <h4>PPE compliance</h4>
                <div className="ppe-grid">
                  {Object.entries(PPE_LABELS).map(([key, label]) => {
                    const status = result.result.ppe_compliance[
                      key as keyof Omit<PpeCompliance, "observations">
                    ] as PpeStatus;
                    return (
                      <div key={key} className="ppe-item">
                        <span>{label}</span>
                        <Badge tone={PPE_TONE[status]}>{status.replace(/_/g, " ")}</Badge>
                      </div>
                    );
                  })}
                </div>
                {result.result.ppe_compliance.observations.length > 0 && (
                  <BulletList items={result.result.ppe_compliance.observations} />
                )}
              </section>

              <section>
                <h4 className="section-title">Hazard register</h4>
                <ol className="hazards">
                  {result.result.hazards.map((hazard, index) => (
                    <li key={`${hazard.hazard_type}-${index}`} className="hazard">
                      <div className="hazard-head">
                        <span className="hazard-index">{String(index + 1).padStart(2, "0")}</span>
                        <strong>{hazard.hazard_type}</strong>
                        <SeverityChip level={hazard.severity} />
                      </div>
                      <p>{hazard.description}</p>
                      <div className="hazard-meta">
                        <span>
                          <Icon name="pin" size={13} /> {hazard.location_hint}
                        </span>
                      </div>
                      <div className="hazard-fix">
                        <Icon name="check" size={14} />
                        <span>{hazard.recommendation}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="split">
                <section className="mini-panel">
                  <h4>Other unsafe observations</h4>
                  {result.result.unsafe_observations.length > 0 ? (
                    <BulletList items={result.result.unsafe_observations} />
                  ) : (
                    <p className="muted">None recorded.</p>
                  )}
                </section>
                <section className="mini-panel">
                  <h4>Start today</h4>
                  <BulletList items={result.result.immediate_actions} ordered />
                </section>
              </div>
            </div>
          )}
        </AnalysisShell>
      </div>
    </div>
  );
}

function toneFor(level: string): string {
  if (level === "critical" || level === "high") return "danger";
  if (level === "medium") return "warn";
  return "ok";
}

