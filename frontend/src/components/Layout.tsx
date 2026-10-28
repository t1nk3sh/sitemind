import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { MODULES } from "../lib/modules";
import { useApp } from "../lib/store";
import { Icon } from "./Icon";
import { Badge, cx } from "./ui";

const DATA_NAV = [{ to: "/projects", label: "Projects", icon: "building" as const }];

function navClass({ isActive }: { isActive: boolean }) {
  return cx("nav-link", isActive && "nav-link-on");
}

export function Layout({ children }: { children: ReactNode }) {
  const { health, healthError, projects, activeProjectId, setActiveProjectId } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock page scroll and support Escape while the mobile drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("no-scroll");
    };
  }, [menuOpen]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className={cx("shell", menuOpen && "shell-menu-open")}>
        <aside className="sidebar" id="app-sidebar">
          <div className="brand">
            <span className="brand-mark">
              <img
                src="/logo-mark.svg"
                alt="SiteMind logo"
                width={36}
                height={36}
                className="brand-logo"
              />
            </span>
            <span className="brand-text">
              <strong>SiteMind</strong>
              <small>Construction Intelligence</small>
            </span>
            <button
              type="button"
              className="icon-btn sidebar-close"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <nav className="nav" aria-label="Main navigation">
            <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
              <Icon name="grid" />
              Dashboard
            </NavLink>

            <span className="nav-section">Analyze</span>
            {MODULES.filter((module) => module.group === "Analyze").map((module) => (
              <NavLink
                key={module.key}
                to={module.path}
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={module.icon} />
                {module.short}
              </NavLink>
            ))}

            <span className="nav-section">Operate</span>
            {MODULES.filter((module) => module.group === "Operate").map((module) => (
              <NavLink
                key={module.key}
                to={module.path}
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={module.icon} />
                {module.short}
              </NavLink>
            ))}

            <span className="nav-section">Data</span>
            {DATA_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="engine-card">
              <div className="engine-row">
                <span className="engine-label">Engine</span>
                {health ? (
                  <Badge tone={health.ai_mode === "live" ? "live" : "demo"}>
                    {health.ai_mode === "live" ? "Live" : "Demo"}
                  </Badge>
                ) : (
                  <Badge tone={healthError ? "danger" : "neutral"}>
                    {healthError ? "Offline" : "…"}
                  </Badge>
                )}
              </div>
              <span className="engine-model">{health?.model ?? "checking API…"}</span>
              <span className="engine-version">v{health?.version ?? "1.0.0"} · JSON contracts</span>
            </div>
          </div>
        </aside>

        <button
          type="button"
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />

        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? "close" : "menu"} size={20} />
            </button>

            <div className="crumb">
              <span>Workspace</span>
              <Icon name="chevron" size={14} className="crumb-sep" />
              <strong>{titleFor(location.pathname)}</strong>
            </div>

            <div className="topbar-right">
              <label className="project-picker">
                <Icon name="pin" size={15} />
                <select
                  value={activeProjectId ?? ""}
                  onChange={(event) => setActiveProjectId(event.target.value || null)}
                  aria-label="Active project"
                >
                  <option value="">No project selected</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <a
                className="icon-btn topbar-docs"
                href="/docs"
                target="_blank"
                rel="noreferrer"
                title="API docs"
              >
                <Icon name="code" size={17} />
              </a>
            </div>
          </header>

          {health?.ai_mode === "demo" && !demoDismissed && (
            <div className="demo-strip">
              <Icon name="spark" size={15} />
              <span>
                <strong>Demo engine active.</strong> Results are generated locally from your inputs,
                not by a language model. Add a <code>GEMINI_API_KEY</code> to enable live multimodal
                analysis.
              </span>
              <button type="button" onClick={() => setDemoDismissed(true)} aria-label="Dismiss">
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          {healthError && (
            <div className="demo-strip demo-strip-bad">
              <Icon name="alert" size={15} />
              <span>{healthError}</span>
            </div>
          )}

          <main className="content" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function titleFor(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const module = MODULES.find((item) => item.path === pathname);
  if (module) return module.short;
  if (pathname.startsWith("/projects")) return "Projects";
  return "Workspace";
}
