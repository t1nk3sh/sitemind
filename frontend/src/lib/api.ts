import type {
  AnalysisEnvelope,
  AnalysisSummary,
  CrackResult,
  DailySiteResult,
  Health,
  KnowledgeResult,
  PlanningResult,
  Project,
  SafetyResult,
  Stats,
  Upload,
  ValuationResult,
  WeatherLookup,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init?.headers
          : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Cannot reach the API server. Is the backend running?", 0);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((item: { msg?: string; loc?: (string | number)[] }) =>
            [item.loc?.slice(1).join("."), item.msg].filter(Boolean).join(": "),
          )
          .join("; ");
      }
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;

  // A non-JSON body (for example an HTML error page from a proxy or a static
  // host) must not surface as "Unexpected token '<'" — turn it into ApiError.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new ApiError(
      `The server returned ${contentType.split(";")[0] || "an unknown content type"} instead of JSON. ` +
        "The API backend is probably not reachable from this origin.",
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The server returned malformed JSON.", response.status);
  }
}

const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/api/health"),
  stats: () => request<Stats>("/api/stats"),

  projects: {
    list: () => request<Project[]>("/api/projects"),
    create: (body: Partial<Project>) => post<Project>("/api/projects", body),
    update: (id: string, body: Partial<Project>) =>
      request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  },

  uploads: {
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<Upload>("/api/uploads", { method: "POST", body: form });
    },
  },

  analyses: {
    list: (params: { kind?: string; project_id?: string; limit?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.kind) query.set("kind", params.kind);
      if (params.project_id) query.set("project_id", params.project_id);
      query.set("limit", String(params.limit ?? 20));
      return request<AnalysisSummary[]>(`/api/analyses?${query.toString()}`);
    },
    get: <T,>(id: string) => request<AnalysisEnvelope<T>>(`/api/analyses/${id}`),
  },

  weather: (location: string) =>
    request<WeatherLookup>(`/api/weather?location=${encodeURIComponent(location)}`),

  analyze: {
    safety: (body: unknown) => post<AnalysisEnvelope<SafetyResult>>("/api/analyze/safety", body),
    cracks: (body: unknown) => post<AnalysisEnvelope<CrackResult>>("/api/analyze/cracks", body),
    valuation: (body: unknown) =>
      post<AnalysisEnvelope<ValuationResult>>("/api/analyze/valuation", body),
    planning: (body: unknown) =>
      post<AnalysisEnvelope<PlanningResult>>("/api/analyze/planning", body),
    dailySite: (body: unknown) =>
      post<AnalysisEnvelope<DailySiteResult>>("/api/analyze/daily-site", body),
    knowledge: (body: unknown) =>
      post<AnalysisEnvelope<KnowledgeResult>>("/api/analyze/knowledge", body),
  },
};

export function formatMoney(value: number, currency: string): string {
  const fractionDigits = value >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
