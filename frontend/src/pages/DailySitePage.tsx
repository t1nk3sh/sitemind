import { useEffect, useState, type FormEvent } from "react";

import { AnalysisShell } from "../components/AnalysisShell";
import { Icon } from "../components/Icon";
import {
  Badge,
  BulletList,
  Button,
  Field,
  PageHeader,
  Panel,
  SeverityChip,
  TextArea,
  TextInput,
} from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import type { DailySiteResult } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const today = () => new Date().toISOString().slice(0, 10);

export function DailySitePage() {
  const { activeProject } = useApp();
  const [siteName, setSiteName] = useState(activeProject?.name ?? "");
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState(
    "Pour concrete for level 5 slab zone B\nMEP rough-in level 3 east wing\nShift formwork to the north bay",
  );
  const [crewSize, setCrewSize] = useState("38");
  const [notes, setNotes] = useState("");
  const [weatherLocation, setWeatherLocation] = useState(activeProject?.location ?? "");
  const [condition, setCondition] = useState("clear");
  const [temperature, setTemperature] = useState("29");
  const [precipitation, setPrecipitation] = useState("0");
  const [wind, setWind] = useState("12");
  const [weatherSource, setWeatherSource] = useState("manual");
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const { result, loading, error, run } = useAnalysis<DailySiteResult>(api.analyze.dailySite);

  useEffect(() => {
    if (!activeProject) return;
    setSiteName((current) => current || activeProject.name);
    setWeatherLocation((current) => current || activeProject.location);
  }, [activeProject]);

  async function fetchWeather() {
    if (!weatherLocation.trim()) {
      setWeatherError("Enter a site location to fetch weather.");
      return;
    }
    setWeatherBusy(true);
    setWeatherError(null);
    try {
      const lookup = await api.weather(weatherLocation);
      if (!lookup.available) {
        setWeatherError(lookup.reason ?? "Weather is unavailable right now.");
        return;
      }
      setCondition(lookup.condition ?? "clear");
      setTemperature(String(lookup.temperature_c ?? ""));
      setPrecipitation(String(lookup.precipitation_mm ?? 0));
      setWind(String(lookup.wind_kph ?? 0));
      setWeatherSource(`open-meteo · ${lookup.resolved_location}`);
    } catch (lookupError) {
      setWeatherError(lookupError instanceof Error ? lookupError.message : "Weather lookup failed.");
    } finally {
      setWeatherBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({
      project_id: activeProject?.id ?? null,
      site_name: siteName,
      date,
      planned_tasks: tasks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      crew_size: Number(crewSize) || 0,
      notes,
      weather: {
        condition,
        temperature_c: Number(temperature) || 0,
        precipitation_mm: Number(precipitation) || 0,
        wind_kph: Number(wind) || 0,
        humidity_percent: null,
        source: weatherSource,
      },
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Operate · daily"
        title="Daily site assistance & weather advisory"
        description="The morning briefing a site manager actually needs: today's priorities, crew assignments, and weather restrictions tied to the specific tasks on the plan."
        actions={<Badge tone="neutral">{date}</Badge>}
      />

      <div className="work-grid">
        <Panel title="Today's plan" subtitle="One task per line" className="form-panel">
          <form onSubmit={submit} className="form">
            <div className="field-row">
              <Field label="Site">
                <TextInput
                  placeholder="Riverside Tower B"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                />
              </Field>
              <Field label="Date">
                <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </Field>
            </div>

            <Field label="Planned tasks">
              <TextArea rows={5} value={tasks} onChange={(event) => setTasks(event.target.value)} />
            </Field>

            <div className="field-row">
              <Field label="Crew size">
                <TextInput
                  type="number"
                  min={0}
                  value={crewSize}
                  onChange={(event) => setCrewSize(event.target.value)}
                />
              </Field>
              <Field label="Notes">
                <TextInput
                  placeholder="Crane booked for 07:00"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </div>

            <div className="weather-box">
              <div className="weather-head">
                <h4>
                  <Icon name="wind" size={15} /> Weather
                </h4>
                <Badge tone="neutral">{weatherSource.split(" · ")[0]}</Badge>
              </div>

              <div className="weather-fetch">
                <TextInput
                  placeholder="Site location for live weather"
                  value={weatherLocation}
                  onChange={(event) => setWeatherLocation(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void fetchWeather()}
                  loading={weatherBusy}
                  icon="refresh"
                >
                  Fetch
                </Button>
              </div>
              {weatherError && <p className="field-error">{weatherError}</p>}

              <div className="field-row field-row-3">
                <Field label="Condition">
                  <TextInput value={condition} onChange={(event) => setCondition(event.target.value)} />
                </Field>
                <Field label="Temp (°C)">
                  <TextInput
                    type="number"
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                  />
                </Field>
                <Field label="Rain (mm)">
                  <TextInput
                    type="number"
                    step="0.1"
                    value={precipitation}
                    onChange={(event) => setPrecipitation(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Wind (km/h)">
                <TextInput
                  type="number"
                  value={wind}
                  onChange={(event) => setWind(event.target.value)}
                />
              </Field>
            </div>

            <Button type="submit" icon="sun" loading={loading} block>
              Generate briefing
            </Button>
          </form>
        </Panel>

        <AnalysisShell
          envelope={result}
          loading={loading}
          error={error}
          empty={{
            title: "No briefing yet",
            body: "List today's tasks and set the weather to get priorities, crew assignments and task-specific restrictions.",
          }}
          onRetry={() => void run({ site_name: siteName, date, planned_tasks: tasks.split("\n").filter(Boolean) })}
        >
          {result && (
            <div className="stack">
              <section className="brief">
                <span className="eyebrow">Morning briefing</span>
                <p className="brief-text">{result.result.briefing}</p>
              </section>

              <section className="weather-advice">
                <header>
                  <div>
                    <h4>Weather advisory</h4>
                    <p>{result.result.weather_advisory.condition_summary}</p>
                  </div>
                  <SeverityChip
                    level={result.result.weather_advisory.impact_level}
                    label={`${result.result.weather_advisory.impact_level} impact`}
                  />
                </header>
                <div className="advice-grid">
                  <div>
                    <h5>Restrictions</h5>
                    {result.result.weather_advisory.work_restrictions.length ? (
                      <BulletList items={result.result.weather_advisory.work_restrictions} />
                    ) : (
                      <p className="muted">None.</p>
                    )}
                  </div>
                  <div>
                    <h5>Scheduling advice</h5>
                    {result.result.weather_advisory.scheduling_advice.length ? (
                      <BulletList items={result.result.weather_advisory.scheduling_advice} />
                    ) : (
                      <p className="muted">None.</p>
                    )}
                  </div>
                </div>
                {result.result.weather_advisory.safety_notes.length > 0 && (
                  <div className="advice-notes">
                    <Icon name="shield" size={14} />
                    <span>{result.result.weather_advisory.safety_notes.join(" ")}</span>
                  </div>
                )}
              </section>

              <div className="split">
                <section className="mini-panel">
                  <h4>Priorities</h4>
                  <BulletList items={result.result.priorities} ordered />
                </section>
                <section className="mini-panel">
                  <h4>Inspection checklist</h4>
                  <BulletList items={result.result.inspection_checklist} />
                </section>
              </div>

              <section>
                <h4 className="section-title">Crew assignments</h4>
                <div className="table-wrap">
                  <table className="table table-stack">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Crew</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.result.crew_assignments.map((assignment, index) => (
                        <tr key={`${assignment.task}-${index}`}>
                          <td data-label="Task">{assignment.task}</td>
                          <td data-label="Crew">{assignment.crew}</td>
                          <td data-label="Notes">{assignment.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </AnalysisShell>
      </div>
    </div>
  );
}

