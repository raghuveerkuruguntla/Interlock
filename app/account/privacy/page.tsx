"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/components/account";
import { ConsentToggles } from "@/components/consent-toggles";
import { CONSENT_COPY, type ConsentKey } from "@/lib/account/types";

export default function PrivacySettingsPage() {
  const { account, updateConsent } = useAccount();
  const [busy, setBusy] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  if (!account) return <p className="text-muted">Loading…</p>;

  async function change(key: ConsentKey, v: boolean) {
    // Turning report-keeping off deletes saved reports; say so before doing it.
    if (key === "saveIncidents" && !v && account!.incidents.length && !confirmDrop) {
      setConfirmDrop(true);
      return;
    }
    setBusy(true);
    await updateConsent({ [key]: v });
    setBusy(false);
    setConfirmDrop(false);
  }

  async function revokeAll() {
    setBusy(true);
    await updateConsent({ callAnalysis: false, messageAnalysis: false, networkReporting: false });
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Privacy &amp; consent</h2>
        <p className="mt-1 text-sm text-muted">
          Changes save instantly and apply on the very next request. Turning call analysis off ends
          any live session within a second. <Link href="/privacy" className="underline">Read the full notice</Link>.
        </p>
      </div>

      {confirmDrop && (
        <div role="alert" className="rounded-card border p-4 text-sm" style={{ borderColor: "var(--tier-critical)" }}>
          <p>
            Turning this off permanently deletes your {account.incidents.length} saved report
            {account.incidents.length === 1 ? "" : "s"}. This cannot be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={async () => { setBusy(true); await updateConsent({ saveIncidents: false }); setBusy(false); setConfirmDrop(false); }} className="rounded-md px-3 py-1.5 font-medium text-white" style={{ background: "var(--tier-critical)" }}>
              Turn off and delete reports
            </button>
            <button type="button" onClick={() => setConfirmDrop(false)} className="rounded-md border border-line px-3 py-1.5">Keep them</button>
          </div>
        </div>
      )}

      <ConsentToggles value={account.consent} onChange={change} busy={busy} />

      <button type="button" onClick={() => void revokeAll()} disabled={busy} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}>
        Stop all analysis now
      </button>

      <section>
        <h3 className="font-semibold">Your consent history</h3>
        <p className="mt-1 text-sm text-muted">Every change you have made, newest first.</p>
        {account.consentLog.length === 0 ? (
          <p className="mt-2 text-sm text-faint">No changes yet. Everything is at its default: off.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-card border border-line bg-surface text-sm">
            {account.consentLog.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-3 px-3 py-2">
                <span className="font-mono text-xs text-faint">{new Date(e.at).toLocaleString()}</span>
                <span>
                  {e.key === "notice"
                    ? `Accepted privacy notice version ${e.value}`
                    : `${CONSENT_COPY[e.key].title}: turned ${e.value ? "on" : "off"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
