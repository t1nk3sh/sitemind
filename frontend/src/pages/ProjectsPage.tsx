import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  ModeBadge,
  PageHeader,
  Panel,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from "../components/ui";
import { api, formatMoney, relativeTime } from "../lib/api";
import { moduleByKey } from "../lib/modules";
import { useApp } from "../lib/store";
import type { AnalysisSummary, ProjectStatus } from "../lib/types";

const TYPES = ["residential", "commercial", "industrial", "infrastructure", "renovation"];
const STATUSES: ProjectStatus[] = ["planning", "in_progress", "on_hold", "completed"];

const STATUS_TONE: Record<ProjectStatus, "neutral" | "accent" | "warn" | "ok"> = {
  planning: "neutral",
  in_progress: "accent",
  on_hold: "warn",
  completed: "ok",
};

export function ProjectsPage() {
  const { projects, projectsError, refreshProjects, activeProjectId, setActiveProjectId } = useApp();
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState(TYPES[0]);
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [floors, setFloors] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);

  useEffect(() => {
    if (!activeProjectId) {
      setAnalyses([]);
      return;
    }
    let cancelled = false;
    api.analyses
      .list({ project_id: activeProjectId, limit: 10 })
      .then((list) => {
        if (!cancelled) setAnalyses(list);
      })
      .catch(() => {
        if (!cancelled) setAnalyses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = await api.projects.create({
        name,
        project_type: projectType,
        location,
        built_area_sqm: area ? Number(area) : null,
        floors: floors ? Number(floors) : null,
        budget: budget ? Number(budget) : null,
        currency,
        status,
        description,
      });
      await refreshProjects();
      setActiveProjectId(project.id);
      setName("");
      setLocation("");
      setArea("");
      setFloors("");
      setBudget("");
      setDescription("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, projectName: string) {
    if (!window.confirm(`Delete "${projectName}" and unlink its analyses?`)) return;
    try {
      await api.projects.remove(id);
      if (activeProjectId === id) setActiveProjectId(null);
      await refreshProjects();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not delete the project.");
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Data · register"
        title="Projects"
        description="The structured project data that every analysis reasons over: type, location, area, floors and budget. The active project is attached as context automatically."
        actions={<Badge tone="accent">{projects.length} total</Badge>}
      />

      {(error || projectsError) && <ErrorNote message={error ?? projectsError ?? ""} />}

      <div className="work-grid">
        <Panel title="New project" subtitle="Only the name is required" className="form-panel">
          <form onSubmit={create} className="form">
            <Field label="Project name">
              <TextInput
                required
                placeholder="Riverside Tower B"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <div className="field-row">
              <Field label="Type">
                <Select value={projectType} onChange={(event) => setProjectType(event.target.value)}>
                  {TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                >
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Location">
              <TextInput
                placeholder="Mumbai, India"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>

            <div className="field-row field-row-3">
              <Field label="Area (sqm)">
                <TextInput
                  type="number"
                  min={0}
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                />
              </Field>
              <Field label="Floors">
                <TextInput
                  type="number"
                  min={0}
                  value={floors}
                  onChange={(event) => setFloors(event.target.value)}
                />
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {["USD", "EUR", "GBP", "INR", "AED", "SGD"].map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Budget">
              <TextInput
                type="number"
                min={0}
                placeholder="optional"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </Field>

            <Field label="Description">
              <TextArea
                rows={3}
                placeholder="12-storey commercial tower with two basement levels."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <Button type="submit" icon="plus" loading={busy} block>
              Create project
            </Button>
          </form>
        </Panel>

        <div className="stack">
          <Panel
            title="Register"
            subtitle="Select a project to use it as AI context"
            actions={
              <Button variant="ghost" icon="refresh" onClick={() => void refreshProjects()}>
                Refresh
              </Button>
            }
          >
            {projects.length === 0 ? (
              <EmptyState
                icon="building"
                title="No projects yet"
                body="Create your first project to attach location, area and budget context to every analysis."
              />
            ) : (
              <ul className="project-list">
                {projects.map((project) => {
                  const active = project.id === activeProjectId;
                  return (
                    <li key={project.id} className={`project-row${active ? " project-row-on" : ""}`}>
                      <div className="project-main">
                        <div className="project-title">
                          <h3>{project.name}</h3>
                          <Badge tone={STATUS_TONE[project.status]}>{project.status.replace("_", " ")}</Badge>
                          {active && <Badge tone="accent">Active</Badge>}
                        </div>
                        <p className="muted">
                          {project.project_type} · {project.location || "location not set"}
                          {project.built_area_sqm ? ` · ${project.built_area_sqm} sqm` : ""}
                          {project.floors ? ` · ${project.floors} floors` : ""}
                        </p>
                        {project.budget ? (
                          <p className="muted">
                            Budget {formatMoney(project.budget, project.currency)} · updated{" "}
                            {relativeTime(project.updated_at)}
                          </p>
                        ) : (
                          <p className="muted">Updated {relativeTime(project.updated_at)}</p>
                        )}
                      </div>
                      <div className="project-actions">
                        <Button
                          variant={active ? "ghost" : "secondary"}
                          onClick={() => setActiveProjectId(active ? null : project.id)}
                        >
                          {active ? "Clear" : "Set active"}
                        </Button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => void remove(project.id, project.name)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {activeProjectId && (
            <Panel title="Analyses on the active project" subtitle="Latest ten runs">
              {analyses.length === 0 ? (
                <div className="inline-loading">
                  <Spinner size={15} /> No analyses recorded for this project yet.
                </div>
              ) : (
                <ul className="activity activity-compact">
                  {analyses.map((item) => {
                    const module = moduleByKey(item.kind);
                    return (
                      <li key={item.id}>
                        <span className="activity-icon">
                          <Icon name={module?.icon ?? "spark"} size={15} />
                        </span>
                        <div className="activity-body">
                          <div className="activity-top">
                            <strong>{item.title}</strong>
                            <ModeBadge mode={item.mode} />
                          </div>
                          <span className="activity-meta">
                            {module?.short ?? item.kind} · {relativeTime(item.created_at)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="quick-links">
                <Link to="/safety" className="text-link">
                  Safety scan <Icon name="arrowRight" size={13} />
                </Link>
                <Link to="/planning" className="text-link">
                  Programme <Icon name="arrowRight" size={13} />
                </Link>
                <Link to="/valuation" className="text-link">
                  Valuation <Icon name="arrowRight" size={13} />
                </Link>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
