"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/account";
import { IncidentReportView } from "@/components/incident-report";

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { account, refresh } = useAccount();
  const [confirm, setConfirm] = useState(false);
  if (!account) return <p className="text-muted">Loading…</p>;
  const incident = account.incidents.find((i) => i.id === id);
  if (!incident) {
    return (
      <p className="text-muted">
        That report does not exist or was deleted. <Link href="/account" className="underline">Back to dashboard</Link>
      </p>
    );
  }

  async function remove() {
    await fetch(`/api/account/incidents/${id}`, { method: "DELETE" }).catch(() => null);
    await refresh();
    router.push("/account");
  }

  return (
    <div className="space-y-4">
      <Link href="/account" className="text-sm text-brand underline underline-offset-4">← All incidents</Link>
      <IncidentReportView report={incident} showActions={false} />
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Delete this report permanently?</span>
          <button type="button" onClick={() => void remove()} className="rounded-md px-3 py-1.5 font-medium text-white" style={{ background: "var(--tier-critical)" }}>Delete</button>
          <button type="button" onClick={() => setConfirm(false)} className="rounded-md border border-line px-3 py-1.5">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="rounded-md border border-line px-3 py-1.5 text-sm">Delete this report</button>
      )}
    </div>
  );
}
