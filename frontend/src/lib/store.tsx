import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "./api";
import type { Health, Project } from "./types";

const STORAGE_KEY = "sitemind.activeProject";

interface AppState {
  health: Health | null;
  healthError: string | null;
  projects: Project[];
  projectsError: string | null;
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

function readStoredProject(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(readStoredProject);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be unavailable in private mode */
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.projects.list();
      setProjects(list);
      setProjectsError(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not load projects.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((value) => {
        if (!cancelled) setHealth(value);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealthError(error instanceof Error ? error.message : "API unreachable.");
        }
      });
    void refreshProjects();
    return () => {
      cancelled = true;
    };
  }, [refreshProjects]);

  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((project) => project.id === activeProjectId) ?? null;
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (activeProjectId && projects.length > 0 && !activeProject) {
      setActiveProjectId(null);
    }
  }, [activeProjectId, activeProject, projects.length, setActiveProjectId]);

  const value: AppState = {
    health,
    healthError,
    projects,
    projectsError,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    refreshProjects,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
