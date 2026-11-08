"use client";

import Link from "next/link";
import { useAccount } from "@/components/account";
import { useSettings } from "@/components/settings";
import { CONSENT_COPY, NOTICE_VERSION } from "@/lib/account/types";
import { TIER_STYLE } from "@/lib/ui/tier";

export default function DashboardPage() {
  const { account } = useAccount();
  const { copy } = useSettings();
  if (!account) return <p className="text-muted">Loading your account…</p>;

  const { consent, incidents } = account;
  const protections = [
    { key: "callAnalysis", on: consent.callAnalysis },
    { key: "messageAnalysis", on: consent.messageAnalysis },
    { key: "networkReporting", on: consent.networkReporting },
    { key: "saveIncidents", on: consent.saveIncidents },
  ] as const;
  const needsOnboarding = consent.noticeVersion !== NOTICE_VERSION;

  return (
    <div className="space-y-6">
      {needsOnboarding && (
        <div className="rounded-card border border-brand bg-brand-soft p-4">
          <p className="font-medium">Finish setting up your protection</p>
          <p className="mt-1 text-sm text-muted">Nothing is switched on until you choose it.</p>
          <Link href="/onboarding" className="mt-2 inline-block rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white">
            Review what Interlock does
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Your protection</h2>
          <ul className="mt-3 space-y-2">
            {protections.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-sm">
                <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full text-xs" style={{ background: p.on ? "var(--ok-soft)" : "var(--surface-2)", color: p.on ? "var(--ok)" : "var(--text-faint)" }}>
                  {p.on ? "✓" : "–"}
                </span>
                <span className={p.on ? "text-ink" : "text-muted"}>{CONSENT_COPY[p.key].title}</span>
                <span className="ml-auto text-xs text-faint">{p.on ? "On" : "Off"}</span>
              </li>
            ))}
          </ul>
          <Link href="/account/privacy" className="mt-3 inline-block text-sm text-brand underline underline-offset-4">
            Change what is on
          </Link>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Got a suspicious call?</h2>
          <p className="mt-1 text-sm text-muted">Start a live session and Interlock will listen with you until you hang up.</p>
          <Link href="/live" className="mt-3 inline-block rounded-md px-3.5 py-2 text-sm font-semibold text-white" style={{ background: "var(--tier-critical)" }}>
            Start live protection
          </Link>
          <p className="mt-3 text-xs text-faint">
            Think you already shared something? Start a session and choose “I think I already shared
            something” for recovery steps.
          </p>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Incident history</h2>
        {incidents.length === 0 ? (
          <p className="mt-2 rounded-card border border-dashed border-line bg-surface p-4 text-sm text-muted">
            No saved reports.{" "}
            {consent.saveIncidents
              ? "When you save a report after a live session, it appears here."
              : "Report-keeping is off, so nothing is saved. Turn it on in Privacy if you want a history."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {incidents.map((i) => {
              const style = TIER_STYLE[i.tier];
              return (
                <li key={i.id}>
                  <Link href={`/account/incidents/${i.id}`} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 hover:bg-surface-2">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: style.bg, color: style.fg }}>
                      {style.glyph} {copy.tierLabels[i.tier]}
                    </span>
                    <span className="font-medium">{i.title}</span>
                    <span className="ml-auto text-xs text-faint">{new Date(i.createdAt).toLocaleString()}</span>
                    <span className="w-full text-sm text-muted">{i.customerResponse}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
