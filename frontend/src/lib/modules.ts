import type { IconName } from "../components/Icon";

export interface ModuleMeta {
  key: string;
  path: string;
  title: string;
  short: string;
  blurb: string;
  icon: IconName;
  group: "Analyze" | "Operate";
  input: string;
}

export const MODULES: ModuleMeta[] = [
  {
    key: "safety",
    path: "/safety",
    title: "Site Safety Monitoring",
    short: "Safety",
    blurb: "Screen site photographs for hazards, PPE gaps and housekeeping risk.",
    icon: "shield",
    group: "Analyze",
    input: "Photos + work context",
  },
  {
    key: "cracks",
    path: "/cracks",
    title: "Crack Detection & Analysis",
    short: "Cracks",
    blurb: "Classify crack patterns, estimate width and get a repair and monitoring plan.",
    icon: "crack",
    group: "Analyze",
    input: "Photo + element type",
  },
  {
    key: "valuation",
    path: "/valuation",
    title: "Real Estate Valuation",
    short: "Valuation",
    blurb: "Desktop market estimate with an explicit range and adjustment trail.",
    icon: "coins",
    group: "Analyze",
    input: "Structured asset data",
  },
  {
    key: "planning",
    path: "/planning",
    title: "Construction Project Planning",
    short: "Planning",
    blurb: "Phase schedule, milestones, cost split and the risks that move the date.",
    icon: "gantt",
    group: "Analyze",
    input: "Scope + budget",
  },
  {
    key: "daily_site",
    path: "/daily-site",
    title: "Daily Site & Weather Advisory",
    short: "Daily site",
    blurb: "Morning briefing with weather restrictions tied to today's actual tasks.",
    icon: "sun",
    group: "Operate",
    input: "Plan + weather",
  },
  {
    key: "knowledge",
    path: "/knowledge",
    title: "Construction Knowledge",
    short: "Knowledge",
    blurb: "Ask a senior-engineer question and get a method-level answer.",
    icon: "chat",
    group: "Operate",
    input: "Question + context",
  },
];

export const moduleByKey = (key: string): ModuleMeta | undefined =>
  MODULES.find((module) => module.key === key);
