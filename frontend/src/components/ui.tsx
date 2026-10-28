import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { Icon, type IconName } from "./Icon";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: IconName;
  block?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  icon,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx("btn", `btn-${variant}`, block && "btn-block", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */
interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Panel({ title, subtitle, actions, children, className, padded = true }: PanelProps) {
  return (
    <section className={cx("panel", className)}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? "panel-body" : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */
type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "live" | "demo" | "info";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("badge", `badge-${tone}`)}>{children}</span>;
}

const SEVERITY_TONE: Record<string, Tone> = {
  low: "ok",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

export function SeverityChip({ level, label }: { level: string; label?: string }) {
  return (
    <span className={cx("sev", `sev-${level}`)}>
      <span className="sev-dot" />
      {label ?? level}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: "live" | "demo" }) {
  return mode === "live" ? (
    <Badge tone="live">
      <span className="pulse-dot" /> Live model
    </Badge>
  ) : (
    <Badge tone="demo">Demo engine</Badge>
  );
}

export const severityTone = (level: string): Tone => SEVERITY_TONE[level] ?? "neutral";

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("field", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("input", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx("input", "select", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("input", "textarea", props.className)} />;
}

export function ChipToggle<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={cx("chip", selected.includes(option) && "chip-on")}
          onClick={() => onToggle(option)}
          aria-pressed={selected.includes(option)}
        >
          {selected.includes(option) && <Icon name="check" size={13} />}
          {option}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */
export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function EmptyState({
  icon = "spark",
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="note note-danger" role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="note-action" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function InfoNote({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={cx("note", tone === "warn" ? "note-warn" : "note-info")}>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </div>
  );
}

export function RawJson({ data }: { data: unknown }) {
  return (
    <details className="raw">
      <summary>
        <Icon name="code" size={15} />
        Raw JSON contract
      </summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

export function BulletList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cx("list", ordered && "list-ordered")}>
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 12)}`}>{item}</li>
      ))}
    </Tag>
  );
}

export function Stat({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: ReactNode;
  meta?: string;
  icon?: IconName;
}) {
  return (
    <div className="stat">
      {icon && (
        <span className="stat-icon">
          <Icon name={icon} size={17} />
        </span>
      )}
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {meta && <span className="stat-meta">{meta}</span>}
      </div>
    </div>
  );
}

export function Meter({
  value,
  max = 100,
  tone = "accent",
  label,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "ok" | "warn" | "danger";
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <div className="meter-track">
        <div className={cx("meter-fill", `meter-${tone}`)} style={{ width: `${percent}%` }} />
      </div>
      {label && <span className="meter-label">{label}</span>}
    </div>
  );
}
