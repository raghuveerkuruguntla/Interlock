"use client";

/**
 * The engine's state, rendered.
 *
 * Everything on this side of the demo is derived from a single
 * `ThreadAssessment`. There is no separate "demo mode" that fakes a verdict:
 * the panel shows what the engine actually concluded from the events it has
 * been shown so far, recomputed from scratch after each one.
 */

import { useState } from "react";
import { useSettings } from "@/components/settings";
import type { Safeguard, Signal, ThreadAssessment, Tier } from "@/lib/engine/types";
import { STAGE_ORDER, SEVERITY_STYLE, TIER_STYLE, formatPercent } from "@/lib/ui/tier";

export function RiskMeter({ assessment }: { assessment: ThreadAssessment }) {
  const { copy } = useSettings();
  const style = TIER_STYLE[assessment.tier];
  const pct = Math.round(assessment.risk * 100);

  return (
    <section
      aria-label="Thread risk"
      className="rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {copy.ui.riskLabel}
        </h2>
        <span className="font-mono text-xs text-faint" aria-hidden>
          {pct}/100
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg"
          style={{ background: style.bg, color: style.fg }}
        >
          {style.glyph}
        </span>
        <p className="text-xl font-semibold leading-tight" style={{ color: style.fg }}>
          {copy.tierLabels[assessment.tier]}
        </p>
      </div>

      {/* The bar repeats information already given in words and in a glyph, so
          it is decorative and hidden from assistive technology. */}
      <div
        aria-hidden
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, background: style.fg }}
        />
      </div>

      <p className="sr-only">
        Risk tier {style.name}, {pct} out of 100, at the {assessment.stage} stage.
      </p>

      {assessment.verified && (
        <p className="mt-3 rounded-md border border-line px-2.5 py-2 text-sm" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          {copy.ui.verified}
        </p>
      )}
    </section>
  );
}

export function StageRail({ assessment }: { assessment: ThreadAssessment }) {
  const { copy } = useSettings();
  const currentIndex = STAGE_ORDER.indexOf(assessment.stage);

  return (
    <section
      aria-label="Kill chain stage"
      className="rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {copy.ui.stageLabel}
      </h2>
      <ol className="mt-3 space-y-0.5">
        {STAGE_ORDER.map((stage, i) => {
          const reached = i <= currentIndex;
          const current = i === currentIndex;
          return (
            <li key={stage}>
              <div
                className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors ${
                  current ? "bg-surface-2" : ""
                }`}
                aria-current={current ? "step" : undefined}
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold"
                  style={{
                    borderColor: reached ? "var(--tier-high)" : "var(--border)",
                    background: reached ? "var(--tier-high)" : "transparent",
                    color: reached ? "var(--surface)" : "var(--text-faint)",
                  }}
                >
                  {reached ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm leading-tight ${
                      current ? "font-semibold text-ink" : reached ? "text-ink" : "text-faint"
                    }`}
                  >
                    {copy.stageLabels[stage]}
                    {current && <span className="sr-only"> (current stage)</span>}
                  </p>
                  {current && (
                    <p className="mt-0.5 text-xs leading-snug text-muted">
                      {copy.stageBlurb[stage]}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 border-t border-line pt-2.5 text-xs leading-snug text-faint">
        {copy.demo.stageNote}
      </p>
    </section>
  );
}

export function SafeguardCard({ safeguard, onAction }: { safeguard: Safeguard; onAction?: (s: Safeguard) => void }) {
  const style = SEVERITY_STYLE[safeguard.severity];
  return (
    <article
      className="rise rounded-card border bg-surface p-4 shadow-[var(--shadow-card)]"
      style={{ borderColor: style.fg }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs"
          style={{ background: style.bg, color: style.fg }}
        >
          {style.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-ink">
            <span className="sr-only">{style.name}: </span>
            {safeguard.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{safeguard.body}</p>

          {safeguard.reasons.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {safeguard.reasons.filter(Boolean).map((reason, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-ink">
                  <span aria-hidden className="select-none text-faint">
                    —
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}

          {safeguard.action?.label && onAction && (
            <button
              type="button"
              onClick={() => onAction(safeguard)}
              className="mt-3 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2"
              style={{ borderColor: style.fg, color: style.fg }}
            >
              {safeguard.action.label}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function SignalList({ signals }: { signals: Signal[] }) {
  const { copy } = useSettings();
  if (signals.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface p-4 text-sm text-muted">
        {copy.ui.noEvidence}
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {[...signals]
        .sort((a, b) => b.weight - a.weight)
        .map((signal) => {
          const style = SEVERITY_STYLE[signal.severity];
          return (
            <li
              key={signal.id}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden style={{ color: style.fg }} className="text-[10px]">
                  {style.glyph}
                </span>
                <span className="font-medium text-ink">{copy.signalLabels[signal.id]}</span>
                <span className="ml-auto font-mono text-[11px] text-faint">
                  +{signal.weight.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 border-l-2 border-line pl-2 font-mono text-[11px] leading-snug text-faint">
                {signal.evidence}
              </p>
            </li>
          );
        })}
    </ul>
  );
}

export function ReceiptPanel({ assessment }: { assessment: ThreadAssessment }) {
  const { copy } = useSettings();
  const [open, setOpen] = useState(false);
  const r = assessment.receipt;

  return (
    <section className="rounded-card border border-line bg-surface shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {copy.ui.receiptLabel}
        </span>
        <span aria-hidden className="text-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
          <div>
            <h3 className="font-semibold text-ink">{copy.ui.observed}</h3>
            <ul className="mt-1 space-y-0.5 text-muted">
              {r.observed.map((x, i) => (
                <li key={i}>· {x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink">{copy.ui.notUsed}</h3>
            <ul className="mt-1 space-y-0.5 text-muted">
              {r.notUsed.map((x, i) => (
                <li key={i}>· {x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink">{copy.ui.leftDevice}</h3>
            <ul className="mt-1 space-y-0.5 text-muted">
              {r.leftTheDevice.map((x, i) => (
                <li key={i}>· {x}</li>
              ))}
            </ul>
          </div>

          {r.modelProbability !== null && (
            <div>
              <h3 className="font-semibold text-ink">Text model</h3>
              <p className="mt-1 text-muted">
                Scored{" "}
                <span className="font-mono text-ink">{r.modelProbability.toFixed(3)}</span> on
                our test conversations. This is not a probability that anyone is being
                defrauded, and it never sets the tier on its own.
              </p>
              {r.topFeatures.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.topFeatures.map((f, i) => (
                    <li
                      key={i}
                      className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]"
                      style={{
                        color: f.contribution > 0 ? "var(--tier-high)" : "var(--ok)",
                      }}
                      title={`${f.contribution > 0 ? "pushed toward" : "pushed away from"} scam`}
                    >
                      {JSON.stringify(f.term).slice(1, -1)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="border-t border-line pt-3">
            <h3 className="font-semibold text-ink">{copy.ui.appeal}</h3>
            <p className="mt-1 text-muted">{r.appeal}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function TierBadge({ tier, children }: { tier: Tier; children?: React.ReactNode }) {
  const style = TIER_STYLE[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      <span aria-hidden>{style.glyph}</span>
      {children ?? style.name}
    </span>
  );
}

export function ModelReadout({ assessment }: { assessment: ThreadAssessment }) {
  if (assessment.modelProbability === null) {
    return (
      <p className="text-xs text-faint">
        No message text yet — nothing for the text model to score. We do not guess from call
        metadata.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted">Text model</span>
      <span className="font-mono text-ink">{assessment.modelProbability.toFixed(3)}</span>
      {assessment.abstaining && (
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{ background: "var(--tier-elevated-soft)", color: "var(--tier-elevated)" }}
        >
          abstain band — we ask instead of asserting
        </span>
      )}
      <span className="ml-auto text-faint">
        contributes at most {formatPercent(0.5)} of risk, and less before the thread earns it
      </span>
    </div>
  );
}
