import { Timestamp } from "spacetimedb";
import { SenderError, schema, table, t } from "spacetimedb/server";

const INCIDENT_STATUSES = [
  "submitted",
  "acknowledged",
  "investigating",
  "resolved",
] as const;
const EXPOSURES = [
  "carrier_account",
  "bank_credentials",
  "payment_card",
  "one_time_code",
  "other",
] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const URGENCIES = ["routine", "urgent", "immediate"] as const;

const incident = table(
  { name: "incident" },
  {
    id: t.string().primaryKey(),
    owner: t.identity().index("btree"),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
    consentedAt: t.timestamp(),
    exposure: t.string(),
    severity: t.string(),
    urgency: t.string(),
    status: t.string(),
  },
);

const statusEvent = table(
  { name: "incident_status_event" },
  {
    id: t.u64().primaryKey().autoInc(),
    incidentId: t.string().index("btree"),
    actor: t.identity(),
    fromStatus: t.string(),
    toStatus: t.string(),
    occurredAt: t.timestamp(),
  },
);

const operator = table(
  { name: "incident_operator" },
  {
    identity: t.identity().primaryKey(),
    role: t.string(),
  },
);

const spacetimedb = schema({ incident, statusEvent, operator });
export default spacetimedb;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOUR_MICROS = 3_600_000_000n;

type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

function coarseTime(timestamp: Timestamp): Timestamp {
  const micros = timestamp.microsSinceUnixEpoch;
  return new Timestamp((micros / HOUR_MICROS) * HOUR_MICROS);
}

function validIncidentId(id: string): void {
  if (!UUID.test(id)) throw new SenderError("Incident ID must be a UUID");
}

export const init = spacetimedb.init((ctx) => {
  ctx.db.operator.insert({ identity: ctx.sender, role: "owner" });
});

export const submitIncident = spacetimedb.reducer(
  {
    incidentId: t.string(),
    exposure: t.string(),
    severity: t.string(),
    urgency: t.string(),
    consent: t.bool(),
  },
  (ctx, { incidentId, exposure, severity, urgency, consent }) => {
    validIncidentId(incidentId);
    if (!consent) throw new SenderError("Explicit consent is required");
    if (!(EXPOSURES as readonly string[]).includes(exposure)) {
      throw new SenderError("Unknown exposure category");
    }
    if (!(SEVERITIES as readonly string[]).includes(severity)) {
      throw new SenderError("Unknown severity");
    }
    if (!(URGENCIES as readonly string[]).includes(urgency)) {
      throw new SenderError("Unknown urgency");
    }
    if (ctx.db.incident.id.find(incidentId)) {
      throw new SenderError("Incident ID already exists");
    }

    const now = coarseTime(ctx.timestamp);
    ctx.db.incident.insert({
      id: incidentId.toLowerCase(),
      owner: ctx.sender,
      createdAt: now,
      updatedAt: now,
      consentedAt: now,
      exposure,
      severity,
      urgency,
      status: "submitted",
    });
    ctx.db.statusEvent.insert({
      id: 0n,
      incidentId: incidentId.toLowerCase(),
      actor: ctx.sender,
      fromStatus: "none",
      toStatus: "submitted",
      occurredAt: now,
    });
  },
);

export const setIncidentStatus = spacetimedb.reducer(
  { incidentId: t.string(), status: t.string() },
  (ctx, { incidentId, status }) => {
    const roleRow = ctx.db.operator.identity.find(ctx.sender);
    if (roleRow?.role !== "owner" && roleRow?.role !== "operator") {
      throw new SenderError("Operator authorization required");
    }
    if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) {
      throw new SenderError("Unknown incident status");
    }
    const targetStatus = status as IncidentStatus;
    const row = ctx.db.incident.id.find(incidentId.toLowerCase());
    if (!row) throw new SenderError("Incident not found");

    const allowedNext: Record<IncidentStatus, IncidentStatus[]> = {
      submitted: ["acknowledged"],
      acknowledged: ["investigating", "resolved"],
      investigating: ["resolved"],
      resolved: [],
    };
    if (!allowedNext[row.status as IncidentStatus]?.includes(targetStatus)) {
      throw new SenderError("Invalid incident status transition");
    }

    const now = coarseTime(ctx.timestamp);
    ctx.db.incident.id.update({ ...row, status: targetStatus, updatedAt: now });
    ctx.db.statusEvent.insert({
      id: 0n,
      incidentId: row.id,
      actor: ctx.sender,
      fromStatus: row.status,
      toStatus: targetStatus,
      occurredAt: now,
    });
  },
);

export const grantOperator = spacetimedb.reducer(
  { identity: t.identity() },
  (ctx, { identity }) => {
    if (ctx.db.operator.identity.find(ctx.sender)?.role !== "owner") {
      throw new SenderError("Only the database owner can provision operators");
    }
    const existing = ctx.db.operator.identity.find(identity);
    if (existing?.role === "owner") {
      throw new SenderError("The database owner role cannot be changed");
    }
    if (!existing) ctx.db.operator.insert({ identity, role: "operator" });
  },
);

export const revokeOperator = spacetimedb.reducer(
  { identity: t.identity() },
  (ctx, { identity }) => {
    if (ctx.db.operator.identity.find(ctx.sender)?.role !== "owner") {
      throw new SenderError("Only the database owner can provision operators");
    }
    const existing = ctx.db.operator.identity.find(identity);
    if (!existing || existing.role === "owner") {
      throw new SenderError("Operator not found or owner role is immutable");
    }
    ctx.db.operator.identity.delete(identity);
  },
);

export const myIncidents = spacetimedb.view(
  { name: "my_incidents", public: true },
  t.array(incident.rowType),
  (ctx) => Array.from(ctx.db.incident.owner.filter(ctx.sender)),
);

export const operatorIncidents = spacetimedb.view(
  { name: "operator_incidents", public: true },
  t.array(incident.rowType),
  (ctx) => {
    const roleRow = ctx.db.operator.identity.find(ctx.sender);
    if (roleRow?.role !== "owner" && roleRow?.role !== "operator") {
      return ctx.from.incident.where((row) => row.id.eq(""));
    }
    return ctx.from.incident;
  },
);