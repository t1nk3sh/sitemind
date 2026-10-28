import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import {
  Badge,
  Button,
  cx,
  ErrorNote,
  EmptyState,
  ModeBadge,
  PageHeader,
  Panel,
  Spinner,
  Stat,
} from "../components/ui";
import { api, relativeTime } from "../lib/api";
import { MODULES, moduleByKey } from "../lib/modules";
import { useApp } from "../lib/store";
import type { Stats } from "../lib/types";

export function DashboardPage() {
  const { health, projects, activeProject } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.stats());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, projects.length]);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Multimodal decision support"
        title="Construction intelligence workspace"
        description="Safety, structural condition, valuation, programme and daily site decisions — reasoned over text, images and structured project data, with every answer validated against a fixed JSON contract."
        actions={
          <>
            <Link to="/projects">
              <Button variant="secondary" icon="building">
                Project register
              </Button>
            </Link>
            <Link to="/safety">
              <Button icon="shield">Run a safety scan</Button>
            </Link>
          </>
        }
      />

      <div className="stats-row">
        <Stat label="Projects" value={stats?.projects ?? projects.length} icon="building" meta="in the register" />
        <Stat label="Analyses" value={stats?.analyses ?? 0} icon="spark" meta="validated contracts" />
        <Stat label="Site photos" value={stats?.images ?? 0} icon="camera" meta="stored on disk" />
        <Stat
          label="Engine"
          value={health?.ai_mode === "live" ? "Live" : "Demo"}
          icon="layers"
          meta={health?.model ?? "checking…"}
        />
      </div>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}

      <div className="dash-grid">
        <div className="stack">
          <Panel
            title="Capabilities"
            subtitle="Six AI features, one contract-driven API"
            actions={<Badge tone="accent">{MODULES.length} modules</Badge>}
          >
            <div className="module-grid">
              {MODULES.map((module) => {
                const runs = stats?.by_kind?.[module.key] ?? 0;
                return (
                  <Link key={module.key} to={module.path} className="module-card">
                    <span className="module-icon">
                      <Icon name={module.icon} size={19} />
                    </span>
                    <div className="module-copy">
                      <h3>{module.title}</h3>
                      <p>{module.blurb}</p>
                      <span className="module-foot">
                        <span className="module-input">{module.input}</span>
                        <span className={cx("module-runs", runs > 0 && "module-runs-on")}>
                          {runs} run{runs === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                    <Icon name="arrowRight" size={16} className="module-arrow" />
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Recent intelligence"
            subtitle="Every run is stored with its inputs and output contract"
            actions={
              <Button variant="ghost" icon="refresh" onClick={() => void load()} loading={loading}>
                Refresh
              </Button>
            }
          >
            {loading && !stats ? (
              <div className="inline-loading">
                <Spinner /> Loading activity…
              </div>
            ) : stats && stats.recent.length > 0 ? (
              <ul className="activity">
                {stats.recent.map((item) => {
                  const module = moduleByKey(item.kind);
                  return (
                    <li key={item.id}>
                      <span className="activity-icon">
                        <Icon name={module?.icon ?? "spark"} size={16} />
                      </span>
                      <div className="activity-body">
                        <div className="activity-top">
                          <strong>{item.title}</strong>
                          <ModeBadge mode={item.mode} />
                        </div>
                        <p>{item.summary || "No summary recorded."}</p>
                        <span className="activity-meta">
                          {module?.short ?? item.kind} · {relativeTime(item.created_at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon="spark"
                title="No analyses yet"
                body="Run a safety scan or a crack analysis to populate the workspace history."
              />
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Active project" subtitle="Applied as context to every analysis">
            {activeProject ? (
              <div className="project-brief">
                <span className="eyebrow">{activeProject.project_type}</span>
                <h3>{activeProject.name}</h3>
                <p>{activeProject.description || "No description recorded."}</p>
                <dl className="kv">
                  <div>
                    <dt>Location</dt>
                    <dd>{activeProject.location || "—"}</dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <dd>{activeProject.built_area_sqm ?? "—"} sqm</dd>
                  </div>
                  <div>
                    <dt>Floors</dt>
                    <dd>{activeProject.floors ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{activeProject.status.replace("_", " ")}</dd>
                  </div>
                </dl>
                <Link to="/projects" className="text-link">
                  Open project register <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            ) : (
              <EmptyState
                icon="building"
                title="No active project"
                body="Create a project in the register to feed area, location and budget into the AI context."
              />
            )}
          </Panel>

          <Panel title="How a request flows" subtitle="Architecture in production order">
            <ol className="pipeline">
              <li>
                <span className="pipeline-step">01</span>
                <div>
                  <strong>Capture</strong>
                  <p>Text, site photographs and structured project data.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-step">02</span>
                <div>
                  <strong>FastAPI intake</strong>
                  <p>Validation, upload hardening and prompt assembly.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-step">03</span>
                <div>
                  <strong>Multimodal model</strong>
                  <p>Vision + language reasoning over the assembled context.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-step">04</span>
                <div>
                  <strong>Contract enforcement</strong>
                  <p>Pydantic repair and validation before anything reaches the UI.</p>
                </div>
              </li>
              <li>
                <span className="pipeline-step">05</span>
                <div>
                  <strong>Stored decision</strong>
                  <p>SQLite record of inputs, output and engine mode.</p>
                </div>
              </li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
