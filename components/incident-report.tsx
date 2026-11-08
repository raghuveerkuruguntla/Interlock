"use client";

/**
 * The end of the experience: a plain-language incident report, the next
 * steps, and the choices about where it goes — your account, the campaign
 * network, a file, or nowhere.
 */

import Link from "next/link";
import { useState } from "react";
import type { IncidentReport } from "@/lib/account/types";
import { alertEmailText, SIMULATED_MONITORING } from "@/lib/engine/report";
import { TIER_STYLE } from "@/lib/ui/tier";
import { useAccount } from "./account";
import { useSettings } from "./settings";

export type DraftReport = Omit<IncidentReport, "id" | "createdAt"> & { id?: string; createdAt?: number };

export function reportAsText(r: DraftReport): string {
  return [
    `INTERLOCK INCIDENT REPORT${r.createdAt ? ` — ${new Date(r.createdAt).toLocaleString()}` : ""}`,
    "",
    r.title,
    r.summary,
    "",
    `How sure we are: ${r.confidence}`,
    `Your response: ${r.customerResponse}`,
    `Recommended next action: ${r.recommendedAction}`,
    "",
    "What we noticed:",
    ...r.signals.map((s) => `  - ${s.label}: ${s.evidence}`),
    "",
    "Next steps:",
    ...r.nextSteps.map((s, i) => `  ${i + 1}. ${s}`),
    "",
    "Prototype notice: no real carrier account was checked or changed. Any monitoring shown is simulated.",
  ].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function IncidentReportView({
  report,
  onChange,
  firstExternalText,
  showActions = true,
}: {
  report: DraftReport;
  onChange?: (r: DraftReport) => void;
  /** The opening line, used only to compute a campaign signature if the customer reports. */
  firstExternalText?: string;
  showActions?: boolean;
}) {
  const { copy } = useSettings();
  const { account, refresh } = useAccount();
  const style = TIER_STYLE[report.tier];
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    report.id ? "saved" : "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [netState, setNetState] = useState<"idle" | "sending" | "sent" | "error">(
    report.reportedToNetwork ? "sent" : "idle",
  );
  const [showEmail, setShowEmail] = useState(false);

  async function save() {
    setSaveState("saving");
    setSaveError(null);
    const res = await fetch("/api/account/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setSaveError(data?.error ?? "Could not save. Try again.");
      setSaveState("error");
      return;
    }
    const data = (await res.json()) as { incident: IncidentReport };
    onChange?.(data.incident);
    setSaveState("saved");
    void refresh();
  }

  async function reportToNetwork() {
    if (!firstExternalText) return;
    setNetState("sending");
    const { signatureOf } = await import("@/lib/engine/signature");
    const signature = signatureOf(firstExternalText);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        signature,
        stage: report.stage === "recovery" ? "escalation" : report.stage,
        tier: report.tier,
        family: "Other",
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setNetState("error");
      return;
    }
    setNetState("sent");
    onChange?.({ ...report, campaignSignature: signature, reportedToNetwork: true });
  }

  const canSave = Boolean(account?.consent.saveIncidents);
  const networkConsent = account ? account.consent.networkReporting : true;

  return (
    <article className="rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Incident report{report.createdAt ? ` · ${new Date(report.createdAt).toLocaleString()}` : ""}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{report.title}</h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: style.bg, color: style.fg }}
        >
          {style.glyph} {copy.tierLabels[report.tier]}
        </span>
      </div>
      <p className="mt-2 text-lg leading-relaxed">{report.summary}</p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-surface-2 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Your response</dt>
          <dd className="mt-1">{report.customerResponse}</dd>
        </div>
        <div className="rounded-md bg-surface-2 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">How sure we are</dt>
          <dd className="mt-1">{report.confidence}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md border-l-4 p-3" style={{ borderColor: "var(--brand)", background: "var(--brand-soft)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Recommended next action</p>
        <p className="mt-1 font-medium text-ink">{report.recommendedAction}</p>
      </div>

      <section className="mt-5">
        <h3 className="text-sm font-semibold">Next steps</h3>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          {report.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {report.signals.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">What we noticed</h3>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {report.signals.map((s) => (
              <li key={s.id}>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.evidence}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 rounded-md border border-dashed border-line p-3">
        <h3 className="text-sm font-semibold">
          72-hour watch{" "}
          <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Simulated
          </span>
        </h3>
        <p className="mt-1 text-xs text-muted">
          What a carrier-connected version would watch for. This prototype has no access to any
          real account, so nothing below is actually monitored.
        </p>
        <ol className="mt-2 space-y-1.5 text-sm">
          {SIMULATED_MONITORING.map((m) => (
            <li key={m.at} className="flex gap-3">
              <span className="w-20 shrink-0 font-mono text-xs text-faint">{m.at}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4">
        <button
          type="button"
          onClick={() => setShowEmail(!showEmail)}
          aria-expanded={showEmail}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          {showEmail ? "Hide" : "Preview"} the link-free alert email
        </button>
        {showEmail && (
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">
            {alertEmailText(report)}
          </pre>
        )}
        <p className="mt-1 text-xs text-faint">
          For customers who do not use the carrier app. Mock-up only — no email is sent.
        </p>
      </section>

      {showActions && (
        <section className="mt-6 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Where this report goes is up to you</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {account ? (
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saveState === "saving" || saveState === "saved"}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saveState === "saved" ? "Saved to your account" : saveState === "saving" ? "Saving…" : "Save to my account"}
              </button>
            ) : (
              <Link
                href="/signin?next=/live"
                className="rounded-md border border-line px-3 py-2 text-center text-sm"
              >
                Sign in to save reports
              </Link>
            )}
            <button
              type="button"
              onClick={reportToNetwork}
              disabled={!firstExternalText || !networkConsent || netState === "sending" || netState === "sent"}
              className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
            >
              {netState === "sent" ? "Queued for review (simulated)" : netState === "error" ? "Report failed — retry" : "Warn other people"}
            </button>
            <button
              type="button"
              onClick={() => download("interlock-incident.txt", reportAsText(report))}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              Download as text
            </button>
          </div>
          <ul className="mt-2 space-y-0.5 text-xs leading-snug text-faint">
            {account && !canSave && (
              <li>
                Report-keeping is off.{" "}
                <Link href="/account/privacy" className="underline">Turn it on in Privacy</Link> to save reports.
              </li>
            )}
            {account && !networkConsent && (
              <li>
                Network reporting is off.{" "}
                <Link href="/account/privacy" className="underline">Turn it on in Privacy</Link> to warn others.
              </li>
            )}
            {saveError && <li style={{ color: "var(--tier-critical)" }}>{saveError}</li>}
            <li>
              Saving keeps this summary and short quotes only — never a recording or full transcript.
              Warning other people queues a 16-character fingerprint of the opening line, not the words,
              for simulated review. Reports never change the campaign list directly.
            </li>
          </ul>
        </section>
      )}

      <p className="mt-5 text-xs text-faint">
        Prototype notice: Interlock did not check or change any real carrier account. Actions
        marked simulated show what a carrier-connected version would do.
      </p>
    </article>
  );
}
