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
  SeverityChip,
  TextInput,
} from "../components/ui";
import { api, formatMoney, formatNumber } from "../lib/api";
import { useApp } from "../lib/store";
import type { PlanningResult } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const PROJECT_TYPES = ["residential", "commercial", "industrial", "infrastructure", "renovation"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD"];
const CONSTRAINTS = ["urban site", "occupied building", "monsoon season", "limited laydown", "night work", "heritage facade"];
const PRIORITIES = ["cost", "speed", "quality", "safety", "sustainability"];

export function PlanningPage() {
  const { activeProject } = useApp();
  const [projectType, setProjectType] = useState("residential");
  const [location, setLocation] = useState(activeProject?.location ?? "");
  const [area, setArea] = useState(activeProject?.built_area_sqm ? String(activeProject.built_area_sqm) : "1200");
  const [floors, setFloors] = useState(activeProject?.floors ? String(activeProject.floors) : "4");
  const [budget, setBudget] = useState(activeProject?.budget ? String(activeProject.budget) : "");
  const [currency, setCurrency] = useState(activeProject?.currency ?? "USD");
  const [startDate, setStartDate] = useState("");
  const [constraints, setConstraints] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>(["safety", "quality"]);
  const { result, loading, error, run } = useAnalysis<PlanningResult>(api.analyze.planning);

  useEffect(() => {
    if (!activeProject) return;
    setLocation((current) => current || activeProject.location);
    setCurrency((current) => current || activeProject.currency);
    setProjectType((current) => current || activeProject.project_type);
  }, [activeProject]);

  const toggle = (list: string[], setList: (value: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      project_id: activeProject?.id ?? null,
      project_type: projectType,
      location,
      built_area_sqm: Number(area) || 0,
      floors: Number(floors) || 1,
      budget: budget ? Number(budget) : null,
      currency,
      start_date: startDate || null,
      constraints,
      priorities,
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Analyze · planning"
        title="Construction project planning"
        description="Turn scope into a sequenced programme: phases with durations and dependencies, milestones, a cost split that adds up, and the risks that actually move the completion date."
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
        <Panel title="Scope" subtitle="What is being built, where and under what pressure" className="form-panel">
          <form onSubmit={submit} className="form">
            <div className="field-row">
              <Field label="Project type">
                <Select value={projectType} onChange={(event) => setProjectType(event.target.value)}>
                  {PROJECT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Floors">
                <TextInput
                  type="number"
                  min={1}
                  value={floors}
                  onChange={(event) => setFloors(event.target.value)}
                />
              </Field>
            </div>

            <Field label="Location">
              <TextInput
                required
                placeholder="Pune, India"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>

            <Field label="Built area (sqm)">
              <TextInput
                type="number"
                min={1}
                required
                value={area}
                onChange={(event) => setArea(event.target.value)}
              />
            </Field>

            <div className="field-row">
              <Field label="Budget">
                <TextInput
                  type="number"
                  min={0}
                  placeholder="optional"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {CURRENCIES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Planned start">
              <TextInput
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>

            <Field label="Site constraints">
              <ChipToggle
                options={CONSTRAINTS}
                selected={constraints}
                onToggle={(value) => toggle(constraints, setConstraints, value)}
              />
            </Field>

            <Field label="Priorities">
              <ChipToggle
                options={PRIORITIES}
                selected={priorities}
                onToggle={(value) => toggle(priorities, setPriorities, value)}
              />
            </Field>

            <Button type="submit" icon="gantt" loading={loading} block>
              Generate programme
            </Button>
          </form>
        </Panel>

        <AnalysisShell
          envelope={result}
          loading={loading}
          error={error}
          empty={{
            title: "No programme yet",
            body: "Describe the scope to generate a phase schedule, milestones, cost breakdown and risk register.",
          }}
          onRetry={() => void run({ location, built_area_sqm: Number(area) || 0 })}
        >
          {result && (
            <div className="stack">
              <div className="metric-row">
                <div className="metric">
                  <span>Duration</span>
                  <strong>{result.result.total_duration_weeks} weeks</strong>
                </div>
                <div className="metric">
                  <span>Estimated cost</span>
                  <strong>{formatMoney(result.result.estimated_cost, result.result.currency)}</strong>
                </div>
                <div className="metric">
                  <span>Phases</span>
                  <strong>{result.result.phases.length}</strong>
                </div>
                <div className="metric">
                  <span>Milestones</span>
                  <strong>{result.result.milestones.length}</strong>
                </div>
              </div>

              <section>
                <h4 className="section-title">Phase schedule</h4>
                <div className="timeline">
                  {result.result.phases.map((phase) => {
                    const total = Math.max(result.result.total_duration_weeks, 1);
                    const left = ((phase.start_week - 1) / total) * 100;
                    const width = Math.max(2, (phase.duration_weeks / total) * 100);
                    return (
                      <div key={phase.name} className="timeline-row">
                        <div className="timeline-label">
                          <strong>{phase.name}</strong>
                          <span>
                            wk {phase.start_week}–{phase.start_week + phase.duration_weeks - 1} ·{" "}
                            {phase.crew_size} crew
                          </span>
                        </div>
                        <div className="timeline-track">
                          <div className="timeline-bar" style={{ left: `${left}%`, width: `${width}%` }}>
                            {phase.duration_weeks}w
                          </div>
                        </div>
                        <div className="timeline-tasks">
                          {phase.key_tasks.map((task) => (
                            <span key={task} className="task-chip">
                              {task}
                            </span>
                          ))}
                          {phase.equipment.length > 0 && (
                            <span className="task-chip task-chip-equip">
                              <Icon name="layers" size={11} /> {phase.equipment.join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="split">
                <section className="mini-panel">
                  <h4>Cost breakdown</h4>
                  <ul className="cost-list">
                    {result.result.cost_breakdown.map((line) => (
                      <li key={line.category}>
                        <div className="cost-head">
                          <span>{line.category}</span>
                          <strong>{formatMoney(line.amount, result.result.currency)}</strong>
                        </div>
                        <div className="cost-track">
                          <div className="cost-fill" style={{ width: `${line.percent}%` }} />
                        </div>
                        <span className="cost-percent">{line.percent}%</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mini-panel">
                  <h4>Milestones</h4>
                  <ol className="milestones">
                    {result.result.milestones.map((milestone) => (
                      <li key={`${milestone.name}-${milestone.week}`}>
                        <span className="milestone-week">W{milestone.week}</span>
                        <div>
                          <strong>{milestone.name}</strong>
                          <p>{milestone.deliverable}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <section>
                <h4 className="section-title">Risk register</h4>
                <div className="table-wrap">
                  <table className="table table-stack">
                    <thead>
                      <tr>
                        <th>Risk</th>
                        <th>Likelihood</th>
                        <th>Impact</th>
                        <th>Mitigation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.result.risks.map((risk) => (
                        <tr key={risk.risk}>
                          <td data-label="Risk">{risk.risk}</td>
                          <td data-label="Likelihood">
                            <SeverityChip level={risk.likelihood} />
                          </td>
                          <td data-label="Impact">
                            <SeverityChip level={risk.impact} />
                          </td>
                          <td data-label="Mitigation">{risk.mitigation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="split">
                <section className="mini-panel">
                  <h4>Critical path</h4>
                  <div className="path">
                    {result.result.critical_path.map((step, index) => (
                      <span key={`${step}-${index}`} className="path-step">
                        {step}
                        {index < result.result.critical_path.length - 1 && (
                          <Icon name="arrowRight" size={12} />
                        )}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="mini-panel">
                  <h4>Assumptions</h4>
                  <BulletList items={result.result.assumptions} />
                </section>
              </div>

              <p className="muted">
                {formatNumber(result.result.phases.length)} phases ·{" "}
                {formatNumber(Number(area))} sqm across {floors} floor(s) ·{" "}
                {formatMoney(result.result.estimated_cost / Math.max(Number(area), 1), result.result.currency)} per sqm
              </p>
            </div>
          )}
        </AnalysisShell>
      </div>
    </div>
  );
}
