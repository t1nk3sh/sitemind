import { useState, type FormEvent } from "react";

import { AnalysisShell } from "../components/AnalysisShell";
import { Icon } from "../components/Icon";
import { UploadZone } from "../components/UploadZone";
import {
  Badge,
  BulletList,
  Button,
  Field,
  PageHeader,
  Panel,
  Select,
  SeverityChip,
  TextArea,
  TextInput,
} from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import type { CrackResult, Upload } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const ELEMENTS = [
  "Concrete wall",
  "Concrete column",
  "Concrete beam",
  "Concrete slab",
  "Foundation / plinth",
  "Pavement / slab on grade",
  "Plaster / render",
  "Masonry wall",
];

export function CracksPage() {
  const { activeProject } = useApp();
  const [files, setFiles] = useState<Upload[]>([]);
  const [elementType, setElementType] = useState(ELEMENTS[1]);
  const [scale, setScale] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { result, loading, error, run } = useAnalysis<CrackResult>(api.analyze.cracks);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (files.length === 0) {
      setLocalError("Attach a photograph of the crack to analyse it.");
      return;
    }
    setLocalError(null);
    void run({
      project_id: activeProject?.id ?? null,
      image_upload_ids: files.map((file) => file.id),
      element_type: elementType,
      scale_reference: scale,
      notes,
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Analyze · vision"
        title="Structural crack detection & analysis"
        description="Identify crack patterns, estimate width and movement, and decide between monitoring, repair and escalation. Visual widths are estimates until measured with a gauge."
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
        <Panel title="Element evidence" subtitle="Photograph the crack with something for scale" className="form-panel">
          <form onSubmit={submit} className="form">
            <UploadZone files={files} onChange={setFiles} max={2} hint="Up to 2 photos · include a tape or coin for scale" />

            <Field label="Element type">
              <Select value={elementType} onChange={(event) => setElementType(event.target.value)}>
                {ELEMENTS.map((element) => (
                  <option key={element}>{element}</option>
                ))}
              </Select>
            </Field>

            <Field label="Scale reference" hint="What is visible in the frame that gives scale?">
              <TextInput
                placeholder="20 mm conduit, 10 mm tape mark, brick course…"
                value={scale}
                onChange={(event) => setScale(event.target.value)}
              />
            </Field>

            <Field label="Observations">
              <TextArea
                rows={3}
                placeholder="First noticed after the monsoon. No dust or staining around the crack."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>

            {localError && <p className="field-error">{localError}</p>}

            <Button type="submit" icon="crack" loading={loading} block>
              Analyse crack
            </Button>
            <p className="form-foot">
              Screening aid only — life-safety decisions need a licensed structural engineer on site.
            </p>
          </form>
        </Panel>

        <AnalysisShell
          envelope={result}
          loading={loading}
          error={error}
          empty={{
            title: "No analysis yet",
            body: "Upload a crack photograph to get pattern classification, width estimate, repair method and monitoring advice.",
          }}
          onRetry={() => void run({ image_upload_ids: files.map((file) => file.id) })}
        >
          {result && (
            <div className="stack">
              {result.result.structural_concern && (
                <div className="note note-danger">
                  <Icon name="alert" size={16} />
                  <span>
                    Structural concern flagged. Restrict loading on the element and arrange an
                    engineer's inspection before repair.
                  </span>
                </div>
              )}

              <div className="verdict">
                <div>
                  <span className="eyebrow">Detection</span>
                  <h3>
                    {result.result.crack_detected
                      ? `${result.result.cracks.length} crack${result.result.cracks.length === 1 ? "" : "s"} identified`
                      : "No crack detected"}
                  </h3>
                  <p>{result.result.summary}</p>
                </div>
                <SeverityChip level={result.result.overall_severity} label={`${result.result.overall_severity} severity`} />
              </div>

              {result.result.cracks.map((crack) => (
                <section key={crack.crack_id} className="crack-card">
                  <header>
                    <span className="crack-id">{crack.crack_id}</span>
                    <div>
                      <strong>{crack.crack_type}</strong>
                      <span className="muted"> · {crack.orientation}</span>
                    </div>
                    <SeverityChip level={crack.severity} />
                  </header>

                  <div className="measure-grid">
                    <div>
                      <span className="measure-label">Width</span>
                      <strong>
                        {crack.estimated_width_mm} <small>mm</small>
                      </strong>
                    </div>
                    <div>
                      <span className="measure-label">Length</span>
                      <strong>
                        {crack.estimated_length_m} <small>m</small>
                      </strong>
                    </div>
                    <div>
                      <span className="measure-label">Urgency</span>
                      <Badge tone={crack.urgency === "immediate" || crack.urgency === "urgent" ? "danger" : crack.urgency === "schedule" ? "warn" : "ok"}>
                        {crack.urgency}
                      </Badge>
                    </div>
                  </div>

                  <dl className="detail-list">
                    <div>
                      <dt>Likely cause</dt>
                      <dd>{crack.likely_cause}</dd>
                    </div>
                    <div>
                      <dt>Recommended repair</dt>
                      <dd>{crack.recommended_repair}</dd>
                    </div>
                    {crack.notes && (
                      <div>
                        <dt>Notes</dt>
                        <dd>{crack.notes}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              ))}

              <div className="split">
                <section className="mini-panel">
                  <h4>Recommended actions</h4>
                  <BulletList items={result.result.recommended_actions} ordered />
                </section>
                <section className="mini-panel">
                  <h4>Monitoring</h4>
                  <p>{result.result.monitoring_advice}</p>
                </section>
              </div>
            </div>
          )}
        </AnalysisShell>
      </div>
    </div>
  );
}
