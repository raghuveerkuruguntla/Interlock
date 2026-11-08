"use client";

import { useEffect, useState } from "react";
import {
  DbConnection,
  tables,
} from "@/lib/spacetime/module_bindings";
import type { Incident } from "@/lib/spacetime/module_bindings/types";

type FeedMode = "customer" | "operator";
type ConnectionState = "connecting" | "connected" | "offline";
type IncidentStatus = "submitted" | "acknowledged" | "investigating" | "resolved";
const SPACETIMEDB_URI = process.env.NEXT_PUBLIC_SPACETIMEDB_URI?.trim();
const SPACETIMEDB_DATABASE = process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE?.trim();
const IS_CONFIGURED = Boolean(SPACETIMEDB_URI && SPACETIMEDB_DATABASE);

const EXPOSURES = [
  ["carrier_account", "Carrier account"],
  ["bank_credentials", "Bank credentials"],
  ["payment_card", "Payment card"],
  ["one_time_code", "One-time code"],
  ["other", "Other"],
] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const URGENCIES = ["routine", "urgent", "immediate"] as const;

function connectionKey(uri: string, database: string, mode: FeedMode): string {
  return `interlock:spacetimedb:${uri}:${database}:${mode}:token`;
}

/**
 * Where this browser keeps its SpacetimeDB identity token.
 *
 * The operator console keeps one identity per browser (localStorage), because
 * the database owner grants operator access to a specific identity through the
 * CLI — a per-tab identity would lose that access the moment the tab closed.
 * The customer view keeps a per-tab identity (sessionStorage), so a customer
 * tab and an operator tab in the same browser stay two separate people.
 */
function tokenStore(mode: FeedMode): Storage {
  return mode === "operator" ? window.localStorage : window.sessionStorage;
}

function addOrReplace(rows: Incident[], next: Incident): Incident[] {
  const index = rows.findIndex((row) => row.id === next.id);
  if (index < 0) return [next, ...rows];
  return rows.map((row) => row.id === next.id ? next : row);
}

function formatCoarseTimestamp(timestamp: Incident["createdAt"]): string {
  const milliseconds = Number(timestamp.microsSinceUnixEpoch / 1_000n);
  return new Date(milliseconds).toLocaleString();
}

function useIncidentFeed(mode: FeedMode) {
  const [state, setState] = useState<ConnectionState>(IS_CONFIGURED ? "connecting" : "offline");
  const [identity, setIdentity] = useState("");
  const [connection, setConnection] = useState<InstanceType<typeof DbConnection> | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [connectionError, setConnectionError] = useState(
    IS_CONFIGURED ? "" : "SpacetimeDB is not configured. See .env.example.",
  );

  useEffect(() => {
    const uri = SPACETIMEDB_URI;
    const database = SPACETIMEDB_DATABASE;
    if (!uri || !database) return;

    let active = true;
    let currentConnection: InstanceType<typeof DbConnection> | null = null;
    let savedToken: string | undefined;
    try {
      savedToken = tokenStore(mode).getItem(connectionKey(uri, database, mode)) ?? undefined;
    } catch {
      savedToken = undefined;
    }

    currentConnection = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(database)
      .withToken(savedToken)
      .withAutomaticReconnect()
      .onConnect((connected, connectedIdentity, token) => {
        if (!active) return;
        setConnectionError("");
        try {
          tokenStore(mode).setItem(connectionKey(uri, database, mode), token);
        } catch {
          setConnectionError("Connected, but this browser cannot persist its SpacetimeDB identity token.");
        }
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
      .onAutomaticReconnect(() => {
        if (active) {
          setConnectionError("");
          setState("connecting");
        }
      })
      .onConnectError((_ctx, error) => {
        if (!active) return;
        setState("offline");
        setConnectionError(error.message);
      })
      .onDisconnect((_ctx, error) => {
        if (!active) return;
        setState("offline");
        setConnectionError(error?.message ?? "The SpacetimeDB connection is offline.");
      })
      .build();

    return () => {
      active = false;
      currentConnection?.disconnect();
    };
  }, [mode]);

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

  return { state, identity, incidents, connectionError, submitIncident, setIncidentStatus };
}

function ConnectionLabel({ state }: { state: ConnectionState }) {
  const label = state === "connected" ? "Connected" : state === "connecting" ? "Connecting" : "Offline";
  return (
    <span className="rounded border border-line px-2 py-1 text-xs font-medium text-muted" role="status">
      {label}
    </span>
  );
}

export function IncidentSubmission() {
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
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">SIMULATED INCIDENT COORDINATION</p>
          <h3 id="incident-submit-heading" className="mt-1 text-sm font-semibold text-ink">Share a minimized incident</h3>
        </div>
        <ConnectionLabel state={feed.state} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        This separate demo record stores only a category, severity, urgency, server-issued identity and coarse time. No message, number, contact, OTP, credential, card detail or conversation is sent. This is not a T-Mobile service.
      </p>

      {feed.connectionError && <p className="mt-2 text-xs text-tier-high">{feed.connectionError}</p>}

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
          <span>I consent to submit these minimized, simulated incident fields to the Interlock SpacetimeDB demo.</span>
        </label>
        <button className="demo-play-button" type="submit" disabled={!consent || feed.state !== "connected" || submission === "submitting"}>
          {submission === "submitting" ? "Submitting…" : "Submit minimized incident"}
        </button>
      </form>

      {submission === "submitted" && (
        <p className="mt-3 text-sm text-muted" role="status">
          Submitted and committed. Current status: <strong className="text-ink">{currentIncident?.status ?? "submitted"}</strong>.
        </p>
      )}
      {submission === "failed" && <p className="mt-3 text-sm text-tier-high" role="alert">Submission failed: {submissionError} No success was recorded.</p>}
      {incidentId && currentIncident && currentIncident.status !== "submitted" && (
        <p className="mt-2 text-sm text-muted" role="status">Live status update: <strong className="text-ink">{currentIncident.status}</strong>.</p>
      )}
      {feed.incidents.length > 0 && (
        <section aria-label="Your incident records" className="mt-4 border-y border-line">
          <h4 className="py-2 text-xs font-semibold uppercase tracking-wider text-muted">Your simulated incidents</h4>
          <ul className="divide-y divide-line">
            {feed.incidents.map((incident) => (
              <li key={incident.id} className="py-3">
                <p className="text-sm font-semibold text-ink">
                  {incident.exposure.replaceAll("_", " ")} · {incident.status}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-faint">{incident.id}</p>
                <p className="mt-1 text-xs text-muted">
                  {incident.severity} severity · {incident.urgency} urgency · {formatCoarseTimestamp(incident.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {feed.identity && <p className="mt-3 break-all font-mono text-[10px] text-faint">SpacetimeDB identity: {feed.identity}</p>}
    </section>
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

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">SIMULATED T-MOBILE CONSOLE</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Incident queue</h2>
        </div>
        <ConnectionLabel state={feed.state} />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        This operator view is authorized by the database identity allowlist. All carrier workflows and status changes are simulated; no T-Mobile systems or APIs are connected.
      </p>
      {feed.connectionError && <p className="mt-3 text-sm text-tier-high">{feed.connectionError}</p>}
      {feed.identity && (
        <p className="mt-3 break-all text-xs text-muted">
          This session identity: <span className="font-mono text-ink">{feed.identity}</span>. The database owner provisions operator access through the CLI; the page role itself grants no access.
        </p>
      )}
      {actionError && <p className="mt-3 text-sm text-tier-high" role="alert">Status change failed: {actionError}</p>}

      {feed.state === "connected" && feed.incidents.length === 0 && (
        <p className="mt-6 border border-dashed border-line p-4 text-sm text-muted">No incidents are visible to this identity. If this should be the operator session, ask the database owner to provision its identity through the CLI.</p>
      )}
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {feed.incidents.map((incident) => (
          <li key={incident.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-faint">{incident.id}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{incident.exposure.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-muted">{incident.severity} severity · {incident.urgency} urgency · {formatCoarseTimestamp(incident.createdAt)}</p>
                <p className="mt-1 break-all text-[10px] text-faint">Owner identity: {incident.owner.toHexString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-line px-2 py-1 text-xs font-medium text-ink">{incident.status}</span>
                {incident.status === "submitted" && (
                  <button className="demo-play-button" type="button" disabled={busyIncident === incident.id || feed.state !== "connected"} onClick={() => changeStatus(incident.id, "acknowledged")}>
                    {busyIncident === incident.id ? "Saving…" : "Acknowledge"}
                  </button>
                )}
                {incident.status === "acknowledged" && (
                  <>
                    <button className="demo-subtle-button" type="button" disabled={busyIncident === incident.id || feed.state !== "connected"} onClick={() => changeStatus(incident.id, "investigating")}>Mark investigating</button>
                    <button className="demo-play-button" type="button" disabled={busyIncident === incident.id || feed.state !== "connected"} onClick={() => changeStatus(incident.id, "resolved")}>Resolve</button>
                  </>
                )}
                {incident.status === "investigating" && (
                  <button className="demo-play-button" type="button" disabled={busyIncident === incident.id || feed.state !== "connected"} onClick={() => changeStatus(incident.id, "resolved")}>Resolve</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}