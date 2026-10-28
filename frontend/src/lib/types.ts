export type Severity = "low" | "medium" | "high" | "critical";
export type Mode = "live" | "demo";
export type ImpactKind = "positive" | "neutral" | "negative";

export interface Health {
  status: string;
  service: string;
  version: string;
  ai_mode: Mode;
  model: string;
  features: string[];
}

export interface Stats {
  projects: number;
  analyses: number;
  images: number;
  by_kind: Record<string, number>;
  recent: AnalysisSummary[];
}

export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed";

export interface Project {
  id: string;
  name: string;
  project_type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  built_area_sqm: number | null;
  floors: number | null;
  budget: number | null;
  currency: string;
  status: ProjectStatus;
  start_date: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Upload {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
}

export interface AnalysisSummary {
  id: string;
  kind: string;
  title: string;
  mode: Mode;
  summary: string;
  project_id: string | null;
  created_at: string;
}

export interface AnalysisEnvelope<T> extends AnalysisSummary {
  result: T;
  warnings: string[];
}

export type PpeStatus = "compliant" | "partial" | "non_compliant" | "unclear" | "not_applicable";

export interface PpeCompliance {
  helmets: PpeStatus;
  high_visibility_vests: PpeStatus;
  fall_protection: PpeStatus;
  footwear: PpeStatus;
  observations: string[];
}

export interface SafetyHazard {
  hazard_type: string;
  severity: Severity;
  description: string;
  location_hint: string;
  recommendation: string;
}

export interface SafetyResult {
  overall_risk_level: Severity;
  risk_score: number;
  ppe_compliance: PpeCompliance;
  hazards: SafetyHazard[];
  unsafe_observations: string[];
  housekeeping_rating: number;
  confidence: number;
  immediate_actions: string[];
  summary: string;
}

export interface CrackFinding {
  crack_id: string;
  crack_type: string;
  orientation: string;
  estimated_width_mm: number;
  estimated_length_m: number;
  severity: Severity;
  likely_cause: string;
  recommended_repair: string;
  urgency: "monitor" | "schedule" | "urgent" | "immediate";
  notes: string;
}

export interface CrackResult {
  crack_detected: boolean;
  overall_severity: Severity;
  structural_concern: boolean;
  cracks: CrackFinding[];
  recommended_actions: string[];
  monitoring_advice: string;
  confidence: number;
  summary: string;
}

export interface ValuationResult {
  estimated_value: number;
  currency: string;
  value_range: { low: number; high: number };
  price_per_sqm: number;
  confidence: number;
  factors: { factor: string; impact: ImpactKind; note: string }[];
  comparable_notes: string[];
  market_outlook: string;
  assumptions: string[];
  summary: string;
}

export interface Phase {
  name: string;
  start_week: number;
  duration_weeks: number;
  key_tasks: string[];
  dependencies: string[];
  crew_size: number;
  equipment: string[];
}

export interface Milestone {
  name: string;
  week: number;
  deliverable: string;
}

export interface CostLine {
  category: string;
  percent: number;
  amount: number;
}

export interface RiskItem {
  risk: string;
  likelihood: Severity;
  impact: Severity;
  mitigation: string;
}

export interface PlanningResult {
  total_duration_weeks: number;
  estimated_cost: number;
  currency: string;
  phases: Phase[];
  milestones: Milestone[];
  critical_path: string[];
  cost_breakdown: CostLine[];
  risks: RiskItem[];
  assumptions: string[];
  summary: string;
}

export interface WeatherSnapshot {
  condition: string;
  temperature_c: number | null;
  precipitation_mm: number | null;
  wind_kph: number | null;
  humidity_percent: number | null;
  source: string;
}

export interface WeatherAdvisory {
  condition_summary: string;
  impact_level: Severity;
  work_restrictions: string[];
  scheduling_advice: string[];
  safety_notes: string[];
}

export interface CrewTask {
  task: string;
  crew: string;
  notes: string;
}

export interface DailySiteResult {
  briefing: string;
  priorities: string[];
  weather_advisory: WeatherAdvisory;
  crew_assignments: CrewTask[];
  inspection_checklist: string[];
  summary: string;
}

export interface KnowledgeResult {
  answer: string;
  key_points: string[];
  related_topics: string[];
  caveats: string[];
  confidence: number;
  summary: string;
}

export interface WeatherLookup {
  available: boolean;
  reason?: string;
  resolved_location?: string;
  latitude?: number;
  longitude?: number;
  condition?: string;
  temperature_c?: number | null;
  precipitation_mm?: number | null;
  wind_kph?: number | null;
  humidity_percent?: number | null;
  source?: string;
  observed_at?: string;
}
