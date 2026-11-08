"use client";

/**
 * The warning a customer sees while a call is still going.
 *
 * Three rules, all from the people this is for. It says what was actually
 * heard, in their words, not a score. It says how sure it is, including that
 * it can be wrong. And it always offers exactly three choices — end it, check
 * through a channel you trust, or keep going — because a warning without a
 * next step is just anxiety.
 */

import { confidenceWords } from "@/lib/engine/report";
import type { ThreadAssessment, Tier } from "@/lib/engine/types";
import { TIER_STYLE } from "@/lib/ui/tier";
import { useSettings } from "./settings";

const RANK: Record<Tier, number> = { none: 0, low: 1, elevated: 2, high: 3, critical: 4 };

export function tierRank(t: Tier): number {
  return RANK[t];
}

/** Whether the warning should be on screen, given what the customer already dismissed. */
export function shouldWarn(a: ThreadAssessment, acknowledged: Tier | null): boolean {
  const warnable = a.abstaining || RANK[a.tier] >= RANK.elevated;
  if (!warnable) return false;
  return acknowledged === null || RANK[a.tier] > RANK[acknowledged];
}

function headline(a: ThreadAssessment, codeAsked: boolean): string {
  if (codeAsked) return "Stop — they are asking for a code";
  if (a.tier === "critical") return "This looks like a scam";
  if (a.tier === "high") return "This is likely a scam";
  if (a.abstaining) return "We are not sure about this call";
  return "Be careful with this call";
}

export function LiveAlert({
  assessment,
  onEnd,
  onVerify,
  onContinue,
}: {
  assessment: ThreadAssessment;
  onEnd: () => void;
  onVerify: () => void;
  onContinue: () => void;
}) {
  const { copy } = useSettings();
  const style = TIER_STYLE[assessment.tier];
  const codeAsked = assessment.signals.some(
    (s) => s.id === "secret_request" || s.id === "otp_during_call",
  );
  const reasons = [...assessment.signals].sort((a, b) => b.weight - a.weight).slice(0, 4);

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rise rounded-card border-2 p-4 shadow-[var(--shadow-lift)] sm:p-5"
      style={{ borderColor: style.fg, background: style.bg }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl"
          style={{ background: "var(--surface)", color: style.fg }}
        >
          {style.glyph}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: style.fg }}>
            {copy.tierLabels[assessment.tier]} · live warning
          </p>
          <h2 className="mt-0.5 text-xl font-semibold leading-tight text-ink sm:text-2xl">
            {headline(assessment, codeAsked)}
          </h2>
        </div>
      </div>

      {codeAsked && (
        <p
          className="mt-3 rounded-md border px-3 py-2 text-sm font-medium leading-snug"
          style={{ borderColor: "var(--tier-critical)", background: "var(--surface)", color: "var(--tier-critical)" }}
        >
          Never read a code, PIN or password to anyone on a call. Your bank, your phone company
          and the police will never ask for it.
        </p>
      )}

      {reasons.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">What we heard</h3>
          <ul className="mt-1.5 space-y-1.5">
            {reasons.map((s) => (
              <li key={s.id} className="text-sm leading-snug">
                <span className="font-medium text-ink">{copy.signalLabels[s.id]}</span>
                <span className="block text-xs text-muted">{s.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-snug text-muted">
        {confidenceWords(assessment)} You decide what happens next.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onEnd}
          className="rounded-md px-3 py-2.5 text-sm font-semibold text-white"
          style={{ background: "var(--tier-critical)" }}
        >
          End the call
        </button>
        <button
          type="button"
          onClick={onVerify}
          className="rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm font-medium text-ink"
        >
          Check with the real company
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-muted"
        >
          Keep talking
        </button>
      </div>
    </section>
  );
}

/** Trusted ways to check, shown when the customer chooses to verify. */
export function VerifyPanel({ onDone }: { onDone: (endCall: boolean) => void }) {
  return (
    <section className="rise rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-semibold">Check through a channel you already trust</h2>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>Hang up first. A real company is happy for you to call them back.</li>
        <li>Open the company&apos;s official app yourself, or call the number printed on your bill or card.</li>
        <li>For your phone company, you can also dial 611 from your own phone.</li>
        <li>Never use a number, link or app the caller gave you.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDone(true)}
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          End the call and check now
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="rounded-md border border-line px-3 py-2 text-sm"
        >
          I checked — the caller is genuine
        </button>
      </div>
      <p className="mt-2 text-xs text-faint">
        Marking the caller genuine lowers the warning and is counted against our own accuracy.
        New warning signs on this call will raise it again.
      </p>
    </section>
  );
}
