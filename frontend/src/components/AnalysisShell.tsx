import { useEffect, useRef, type ReactNode } from "react";

import { relativeTime } from "../lib/api";
import type { AnalysisEnvelope } from "../lib/types";
import { Icon } from "./Icon";
import { EmptyState, ErrorNote, ModeBadge, RawJson, SeverityChip, Spinner } from "./ui";

interface AnalysisShellProps {
  envelope: AnalysisEnvelope<unknown> | null;
  loading: boolean;
  error: string | null;
  empty: { title: string; body: string };
  children: ReactNode;
  onRetry?: () => void;
  renderConfidence?: boolean;
  extraBadges?: ReactNode;
}

export function AnalysisShell({
  envelope,
  loading,
  error,
  empty,
  children,
  onRetry,
  renderConfidence = true,
  extraBadges,
}: AnalysisShellProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const resultId = envelope?.id ?? null;

  // On stacked (phone/tablet) layouts the result renders below the form, so bring it into view
  // once a new result or error arrives. Desktop keeps the two-column view untouched.
  useEffect(() => {
    if (!resultId && !error) return;
    if (typeof window === "undefined" || window.innerWidth > 960) return;
    const node = slotRef.current;
    if (!node) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [resultId, error]);

  let content: ReactNode;

  if (error) {
    content = <ErrorNote message={error} onRetry={onRetry} />;
  } else if (loading) {
    content = (
      <div className="panel loading-panel">
        <div className="loading-row">
          <Spinner size={20} />
          <div>
            <strong>Analysing…</strong>
            <p>Multimodal reasoning across the supplied inputs. Large images can take a moment.</p>
          </div>
        </div>
        <div className="skeleton" />
        <div className="skeleton skeleton-short" />
        <div className="skeleton skeleton-tight" />
      </div>
    );
  } else if (!envelope) {
    content = (
      <div className="panel">
        <EmptyState title={empty.title} body={empty.body} />
      </div>
    );
  } else {
    const result = envelope.result as Record<string, unknown>;
    const confidence = typeof result.confidence === "number" ? result.confidence : null;
    const severity =
      (result.overall_risk_level as string) ||
      (result.overall_severity as string) ||
      (result.weather_advisory as { impact_level?: string } | undefined)?.impact_level;

    content = (
      <div className="result">
        <div className="result-head">
          <div>
            <div className="result-tags">
              <ModeBadge mode={envelope.mode} />
              {severity && <SeverityChip level={severity} />}
              {extraBadges}
            </div>
            <h2>{envelope.title}</h2>
            <p className="result-meta">
              <Icon name="clock" size={13} /> {relativeTime(envelope.created_at)}
              <span className="dot-sep" />
              {envelope.id}
              {confidence !== null && renderConfidence && (
                <>
                  <span className="dot-sep" />
                  confidence {(confidence * 100).toFixed(0)}%
                </>
              )}
            </p>
          </div>
        </div>

        {envelope.warnings.length > 0 && (
          <div className="note note-warn">
            <Icon name="info" size={16} />
            <span>{envelope.warnings[0]}</span>
          </div>
        )}

        {children}

        <RawJson data={envelope.result} />
      </div>
    );
  }

  return (
    <div className="analysis-slot" ref={slotRef} aria-live="polite">
      {content}
    </div>
  );
}
