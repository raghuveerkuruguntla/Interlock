"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DbConnection,
  tables,
} from "@/lib/spacetime/module_bindings";
import type { Incident } from "@/lib/spacetime/module_bindings/types";

type FeedMode = "customer" | "operator";
type ConnectionState = "connecting" | "connected" | "offline" | "signed_out";
type IncidentStatus = "submitted" | "acknowledged" | "investigating" | "resolved";
const SPACETIMEDB_URI = process.env.NEXT_PUBLIC_SPACETIMEDB_URI?.trim();
const SPACETIMEDB_DATABASE = process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE?.trim();
const IS_CONFIGURED = Boolean(SPACETIMEDB_URI && SPACETIMEDB_DATABASE);
/** Clerk JWT template that adds the `aud` and `role` claims the database checks. */
const CLERK_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_SPACETIMEDB_TEMPLATE?.trim() || "spacetimedb";

/** What customers and the admin see for each stored status. */
export const STATUS_LABEL: Record<string, string> = {
  submitted: "New",
  acknowledged: "Acknowledged",
  investigating: "Under review",
  resolved: "Resolved",
};

const EXPOSURES = [
  ["carrier_account", "Carrier account"],
  ["bank_credentials", "Bank credentials"],
  ["payment_card", "Payment card"],
  ["one_time_code", "One-time code"],
  ["other", "Other"],
] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const URGENCIES = ["routine", "urgent", "immediate"] as const;

function addOrReplace(rows: Incident[], next: Incident): Incident[] {
  const index = rows.findIndex((row) => row.id === next.id);
  if (index < 0) return [next, ...rows];
  return rows.map((row) => row.id === next.id ? next : row);
}

function formatCoarseTimestamp(timestamp: Incident["createdAt"]): string {
  const milliseconds = Number(timestamp.microsSinceUnixEpoch / 1_000n);
  return new Date(milliseconds).toLocaleString();
}

/**
 * A live connection to the incident database as the signed-in Clerk user.
 *
 * The Clerk token is the database identity: the same person gets the same
 * identity in every browser and on every device, so there is nothing to grant
 * per browser. Clerk tokens are short-lived, so instead of the SDK's automatic
 * reconnect (which would replay an expired token) every reconnect fetches a
 * fresh one.
 */
function useIncidentFeed(mode: FeedMode) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [state, setState] = useState<ConnectionState>(IS_CONFIGURED ? "connecting" : "offline");
  const [identity, setIdentity] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [connection, setConnection] = useState<InstanceType<typeof DbConnection> | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [connectionError, setConnectionError] = useState(
    IS_CONFIGURED ? "" : "SpacetimeDB is not configured. See .env.example.",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const uri = SPACETIMEDB_URI;
    const database = SPACETIMEDB_DATABASE;
    if (!uri || !database || !isLoaded) return;

    let active = true;
    let currentConnection: InstanceType<typeof DbConnection> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = () => {
      if (!active || retry) return;
      const delay = Math.min(30_000, 2_000 * 2 ** Math.min(attempt, 4));
      retry = setTimeout(() => setAttempt((n) => n + 1), delay);
    };

    const connect = async () => {
      if (!isSignedIn) {
        setState("signed_out");
        setIncidents([]);
        setRole(null);
        setConnectionError("");
        return;
      }
      setState("connecting");
      let token: string | null = null;
      try {
        token = await getToken({ template: CLERK_TEMPLATE });
      } catch {
        token = null;
      }
      if (!active) return;
      if (!token) {
        setState("offline");
        setConnectionError(
          `Could not get a sign-in token for the incident database. Check the Clerk JWT template named "${CLERK_TEMPLATE}".`,
        );
        scheduleRetry();
        return;
      }

      currentConnection = DbConnection.builder()
        .withUri(uri)
        .withDatabaseName(database)
        .withToken(token)
        .onConnect((connected, connectedIdentity) => {
          if (!active) return;
          setConnectionError("");
          setConnection(connected);
          setIdentity(connectedIdentity.toHexString());

          const view = mode === "customer" ? connected.db.myIncidents : connected.db.operatorIncidents;
          view.onInsert((_ctx, row) => {
            if (active) setIncidents((rows) => addOrReplace(rows, row));
          });
          view.onUpdate((_ctx, _oldRow, row) => {
            if (active) setIncidents((rows) => addOrReplace(rows, row));
          });
          view.onDelete((_ctx, row) => {
            if (active) setIncidents((rows) => rows.filter((item) => item.id !== row.id));
          });

          if (mode === "operator") {
            connected.subscriptionBuilder()
              .onApplied(() => {
                if (active) setRole(Array.from(connected.db.myRole.iter())[0]?.role ?? null);
              })
              .subscribe(tables.myRole);
          }

          connected.subscriptionBuilder()
            .onApplied(() => {
              if (!active) return;
              setIncidents(Array.from(view.iter()));
              setConnectionError("");
              setState("connected");
            })
            .onError((ctx) => {
              if (!active) return;
              setState("offline");
              setConnectionError(ctx.event?.message ?? "The incident subscription is unavailable.");
            })
            .subscribe(mode === "customer" ? tables.myIncidents : tables.operatorIncidents);
        })
        .onConnectError((_ctx, error) => {
          if (!active) return;
          setState("offline");
          setConnectionError(error.message);
          scheduleRetry();
        })
        .onDisconnect((_ctx, error) => {
          if (!active) return;
          setState("offline");
          setConnectionError(error?.message ?? "Reconnecting to the incident database…");
          scheduleRetry();
        })
        .build();
    };
    void connect();

    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      currentConnection?.disconnect();
    };
    // `attempt` re-runs this effect to reconnect with a fresh token.
  }, [mode, isLoaded, isSignedIn, userId, getToken, attempt]);

  async function submitIncident(input: {
    incidentId: string;
    exposure: string;
    severity: string;
    urgency: string;
    consent: true;
  }): Promise<void> {
    if (!connection?.isActive || state !== "connected") {
      throw new Error("SpacetimeDB is offline. The incident was not submitted.");
    }
    await connection.reducers.submitIncident(input);
  }

  async function setIncidentStatus(id: string, status: IncidentStatus): Promise<void> {
    if (!connection?.isActive || state !== "connected") {
      throw new Error("SpacetimeDB is offline. The status was not changed.");
    }
    await connection.reducers.setIncidentStatus({ incidentId: id, status });
  }

  return { state, identity, role, incidents, connectionError, submitIncident, setIncidentStatus };
}

function ConnectionLabel({ state }: { state: ConnectionState }) {
  const label =
    state === "connected"
      ? "Connected"
      : state === "connecting"
        ? "Connecting"
        : state === "signed_out"
          ? "Signed out"
          : "Offline";
  return (
    <span className="rounded border border-line px-2 py-1 text-xs font-medium text-muted" role="status">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded border border-line px-2 py-1 text-xs font-medium text-ink">
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** A customer's own incidents with their live status. Read-only. */
function IncidentList({ incidents, emptyText }: { incidents: Incident[]; emptyText?: string }) {
  if (incidents.length === 0) {
    return emptyText ? (
      <p className="mt-4 border border-dashed border-line p-4 text-sm text-muted">{emptyText}</p>
    ) : null;
  }
  return (
    <section aria-label="Your incident records" className="mt-4 border-y border-line">
      <h4 className="py-2 text-xs font-semibold uppercase tracking-wider text-muted">Your reported incidents</h4>
      <ul className="divide-y divide-line">
        {incidents.map((incident) => (
          <li key={incident.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{incident.exposure.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-muted">
                {incident.severity} severity · {incident.urgency} urgency · {formatCoarseTimestamp(incident.createdAt)}
              </p>
            </div>
            <StatusBadge status={incident.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignInPrompt({ returnTo }: { returnTo: string }) {
  return (
    <p className="mt-4 border border-dashed border-line p-4 text-sm text-muted">
      <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`} className="font-medium text-brand underline">
        Sign in
      </Link>{" "}
      or{" "}
      <Link href="/sign-up" className="font-medium text-brand underline">
        create an account
      </Link>{" "}
      to report an incident and follow its status. Only you and the Interlock admin can see what you report.
    </p>
  );
}

export function IncidentSubmission({ returnTo = "/demo" }: { returnTo?: string }) {
  const feed = useIncidentFeed("customer");
  const [exposure, setExposure] = useState<(typeof EXPOSURES)[number][0]>("carrier_account");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>("routine");
  const [consent, setConsent] = useState(false);
  const [submission, setSubmission] = useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const [incidentId, setIncidentId] = useState("");
  const [submissionError, setSubmissionError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || feed.state !== "connected") return;
    const id = crypto.randomUUID();
    setSubmission("submitting");
    setSubmissionError("");
    try {
      await feed.submitIncident({ incidentId: id, exposure, severity, urgency, consent: true });
      setIncidentId(id);
      setSubmission("submitted");
    } catch (error) {
      setSubmission("failed");
      setSubmissionError(error instanceof Error ? error.message : "Submission failed.");
    }
  }

  const currentIncident = feed.incidents.find((item) => item.id === incidentId);

  return (
    <section aria-labelledby="incident-submit-heading" className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">REPORT AN INCIDENT</p>
          <h3 id="incident-submit-heading" className="mt-1 text-sm font-semibold text-ink">Tell our fraud team what happened</h3>
        </div>
        <ConnectionLabel state={feed.state} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        We only send a category, how serious and how urgent it is, and the hour it happened. Never your messages, phone numbers, contacts, codes, passwords or card details.
      </p>

      {feed.connectionError && <p className="mt-2 text-xs text-tier-high">{feed.connectionError}</p>}

      {feed.state === "signed_out" ? (
        <SignInPrompt returnTo={returnTo} />
      ) : (
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-muted">
              Exposure category
              <select className="rounded border border-line bg-surface px-2 py-2 text-sm text-ink" value={exposure} onChange={(event) => setExposure(event.target.value as (typeof EXPOSURES)[number][0])}>
                {EXPOSURES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted">
              Severity
              <select className="rounded border border-line bg-surface px-2 py-2 text-sm text-ink" value={severity} onChange={(event) => setSeverity(event.target.value as (typeof SEVERITIES)[number])}>
                {SEVERITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted">
              Urgency
              <select className="rounded border border-line bg-surface px-2 py-2 text-sm text-ink" value={urgency} onChange={(event) => setUrgency(event.target.value as (typeof URGENCIES)[number])}>
                {URGENCIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <input className="mt-0.5 accent-[var(--brand)]" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I agree to send this report to the Interlock fraud team.</span>
          </label>
          <button className="demo-play-button" type="submit" disabled={!consent || feed.state !== "connected" || submission === "submitting"}>
            {submission === "submitting" ? "Sending…" : "Send report"}
          </button>
        </form>
      )}

      {submission === "submitted" && (
        <p className="mt-3 text-sm text-muted" role="status">
          Report sent. Current status:{" "}
          <strong className="text-ink">{STATUS_LABEL[currentIncident?.status ?? "submitted"]}</strong>.
          It also appears on your dashboard.
        </p>
      )}
      {submission === "failed" && <p className="mt-3 text-sm text-tier-high" role="alert">Submission failed: {submissionError} No success was recorded.</p>}
      {incidentId && currentIncident && currentIncident.status !== "submitted" && (
        <p className="mt-2 text-sm text-muted" role="status">
          Live status update: <strong className="text-ink">{STATUS_LABEL[currentIncident.status] ?? currentIncident.status}</strong>.
        </p>
      )}
      <IncidentList incidents={feed.incidents} />
    </section>
  );
}

/** The signed-in customer's reported incidents, updating live as the admin works them. */
export function MyIncidents() {
  const feed = useIncidentFeed("customer");
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reported incidents</h2>
        <ConnectionLabel state={feed.state} />
      </div>
      <p className="mt-1 text-sm text-muted">
        Incidents you reported to the Interlock team, with their status updating live. Only you and the admin can see these.
      </p>
      {feed.connectionError && <p className="mt-2 text-xs text-tier-high">{feed.connectionError}</p>}
      <IncidentList
        incidents={feed.incidents}
        emptyText={
          feed.state === "connected"
            ? "You have not reported any incidents. Reports you send after a live call or from the demo appear here."
            : undefined
        }
      />
    </div>
  );
}

export function IncidentOperatorConsole() {
  const feed = useIncidentFeed("operator");
  const [busyIncident, setBusyIncident] = useState("");
  const [actionError, setActionError] = useState("");

  async function changeStatus(id: string, status: IncidentStatus) {
    setBusyIncident(id);
    setActionError("");
    try {
      await feed.setIncidentStatus(id, status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status update failed.");
    } finally {
      setBusyIncident("");
    }
  }

  const busy = (id: string) => busyIncident === id || feed.state !== "connected";
  const counts = feed.incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">ADMIN</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Incident queue</h2>
        </div>
        <ConnectionLabel state={feed.state} />
      </div>
      {feed.connectionError && <p className="mt-3 text-sm text-tier-high">{feed.connectionError}</p>}
      {feed.state === "connected" && !feed.role && (
        <p className="mt-3 border border-dashed border-line p-3 text-sm text-tier-high" role="alert">
          The incident database does not recognise this account as an admin yet. Check that your Clerk user has
          a <code>role</code> of <code>admin</code> in its public metadata, that the Clerk JWT template adds the
          {" "}<code>role</code> claim, and that the database owner has run <code>configure_auth</code>. Then sign out and back in.
        </p>
      )}
      {actionError && <p className="mt-3 text-sm text-tier-high" role="alert">Status change failed: {actionError}</p>}

      {feed.role && (
        <p className="mt-4 text-xs text-muted">
          {Object.keys(STATUS_LABEL).map((s) => `${STATUS_LABEL[s]}: ${counts[s] ?? 0}`).join(" · ")}
        </p>
      )}
      {feed.state === "connected" && feed.role && feed.incidents.length === 0 && (
        <p className="mt-6 border border-dashed border-line p-4 text-sm text-muted">No incidents yet. New reports from customers appear here as they arrive.</p>
      )}
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {feed.incidents.map((incident) => (
          <li key={incident.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-faint">{incident.id}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{incident.exposure.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-muted">{incident.severity} severity · {incident.urgency} urgency · {formatCoarseTimestamp(incident.createdAt)}</p>
                <p className="mt-1 break-all text-[10px] text-faint">Reported by account {incident.owner.toHexString().slice(0, 12)}…</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={incident.status} />
                {incident.status === "submitted" && (
                  <button className="demo-play-button" type="button" disabled={busy(incident.id)} onClick={() => changeStatus(incident.id, "acknowledged")}>
                    {busyIncident === incident.id ? "Saving…" : "Acknowledge"}
                  </button>
                )}
                {incident.status === "acknowledged" && (
                  <>
                    <button className="demo-subtle-button" type="button" disabled={busy(incident.id)} onClick={() => changeStatus(incident.id, "investigating")}>Mark under review</button>
                    <button className="demo-play-button" type="button" disabled={busy(incident.id)} onClick={() => changeStatus(incident.id, "resolved")}>Resolve</button>
                  </>
                )}
                {incident.status === "investigating" && (
                  <button className="demo-play-button" type="button" disabled={busy(incident.id)} onClick={() => changeStatus(incident.id, "resolved")}>Resolve</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
