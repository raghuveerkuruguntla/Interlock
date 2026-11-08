"use client";

import { UserProfile } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/account";
import type { ActivityEntry } from "@/lib/account/types";

const LABEL: Record<ActivityEntry["kind"], string> = {
  account_created: "Interlock account created",
  consent_changed: "Privacy choices changed",
  live_session_started: "Live session started",
  live_session_ended: "Live session ended — transcript deleted",
  incident_saved: "Incident report saved",
  incident_deleted: "Incident report deleted",
  data_exported: "Data exported",
};

export default function SecurityPage() {
  const router = useRouter();
  const { account, setAccount, refresh } = useAccount();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!account) return <p className="text-muted">Loading…</p>;

  async function deleteAll() {
    setError(null);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not delete the account. Try again.");
      return;
    }
    setAccount(null);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Sign-in and security</h2>
        <p className="mt-1 text-sm text-muted">
          Your password, email, connected accounts, two-step verification and signed-in devices are
          managed by Clerk, our sign-in provider. Interlock never sees your password.
        </p>
        <div className="mt-3 overflow-x-auto">
          <UserProfile routing="hash" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          We store no phone number, contacts, call audio or full transcripts.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="/api/account/export" onClick={() => setTimeout(() => void refresh(), 800)} className="rounded-md border border-line px-3 py-2 text-sm">
            Download everything Interlock holds (JSON)
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <ul className="mt-2 divide-y divide-[var(--border)] rounded-card border border-line bg-surface text-sm">
          {account.activity.slice(0, 40).map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex flex-wrap gap-x-3 px-3 py-2">
              <span className="font-mono text-xs text-faint">{new Date(a.at).toLocaleString()}</span>
              <span>{LABEL[a.kind] ?? a.kind}</span>
              {a.detail && <span className="text-muted">· {a.detail}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border p-4" style={{ borderColor: "var(--tier-critical)" }}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--tier-critical)" }}>Delete my account</h2>
        <p className="mt-1 text-sm text-muted">
          Permanently deletes your sign-in account, your privacy choices and history, and every saved
          report. This cannot be undone. Campaign fingerprints you reported stay on the network,
          because they are not linked to you.
        </p>
        <label className="mt-3 block text-sm">
          Type <strong>DELETE</strong> to confirm
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 block w-48 rounded-md border border-line bg-surface px-2 py-1.5 font-mono" autoComplete="off" />
        </label>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--tier-critical)" }}>{error}</p>}
        <button type="button" disabled={confirm !== "DELETE"} onClick={() => void deleteAll()} className="mt-3 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--tier-critical)" }}>
          Permanently delete my account
        </button>
      </section>
    </div>
  );
}
