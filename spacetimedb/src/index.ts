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

/**
 * Who may run the incident console.
 *
 * - `owner`: the identity that published the database. Set once, immutable.
 * - `operator`: granted by the owner through the CLI.
 * - `admin`: a signed-in Clerk user whose token carries `role: "admin"`.
 *   Synced on every connection, so removing the role in Clerk removes access
 *   the next time that person connects.
 */
const operator = table(
  { name: "incident_operator" },
  {
    identity: t.identity().primaryKey(),
    role: t.string(),
  },
);

/**
 * Which identity provider this database trusts for customer and admin
 * sign-in. Private, and set only by the owner. Until it is set the database
 * behaves as before: anonymous reporting, CLI-granted operators only.
 */
const authConfig = table(
  { name: "auth_config" },
  {
    id: t.u8().primaryKey(),
    issuer: t.string(),
    audience: t.string(),
  },
);

/**
 * Every identity provider this database trusts, keyed by issuer — for example
 * the development and the production Clerk instance. Private; owner-managed.
 */
const trustedIssuer = table(
  { name: "trusted_issuer" },
  {
    issuer: t.string().primaryKey(),
    audience: t.string(),
  },
);

const spacetimedb = schema({ incident, statusEvent, operator, authConfig, trustedIssuer });
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

const STAFF_ROLES = ["owner", "operator", "admin"];

type IssuerRow = { issuer: string; audience: string };
type AuthCtxLike = {
  senderAuth: { jwt: { issuer: string; audience: readonly string[]; fullPayload: Record<string, unknown> } | null };
  db: {
    authConfig: { id: { find(id: number): IssuerRow | null | undefined }; count(): bigint };
    trustedIssuer: { issuer: { find(issuer: string): IssuerRow | null | undefined }; count(): bigint };
  };
};

/** True once the owner has told the database which sign-in provider(s) to trust. */
function signInConfigured(ctx: AuthCtxLike): boolean {
  return ctx.db.authConfig.count() > 0n || ctx.db.trustedIssuer.count() > 0n;
}

/** https, a host, an optional path; no trailing slash, query or fragment. */
const ISSUER = /^https:\/\/[^\s/?#]+(\/[^\s?#]*[^\s/?#])?$/;

/**
 * The verified claims of a signed-in user from the configured provider, or
 * null. SpacetimeDB has already checked the token's signature against the
 * issuer's published keys; this checks it came from the issuer we trust and
 * was minted for this database, because any OIDC provider can sign a token.
 */
function trustedClaims(ctx: AuthCtxLike): Record<string, unknown> | null {
  const jwt = ctx.senderAuth.jwt;
  if (!jwt) return null;
  const legacy = ctx.db.authConfig.id.find(0);
  const config = ctx.db.trustedIssuer.issuer.find(jwt.issuer) ?? (legacy?.issuer === jwt.issuer ? legacy : null);
  if (!config) return null;
  if (config.audience && !jwt.audience.includes(config.audience)) return null;
  return jwt.fullPayload;
}

export const init = spacetimedb.init((ctx) => {
  ctx.db.operator.insert({ identity: ctx.sender, role: "owner" });
});

/** Owner only: trust this Clerk instance for sign-in. */
export const configureAuth = spacetimedb.reducer(
  { issuer: t.string(), audience: t.string() },
  (ctx, { issuer, audience }) => {
    if (ctx.db.operator.identity.find(ctx.sender)?.role !== "owner") {
      throw new SenderError("Only the database owner can configure sign-in");
    }
    if (!ISSUER.test(issuer)) {
      throw new SenderError("Issuer must be an https URL with no trailing slash, e.g. https://example.clerk.accounts.dev");
    }
    const row = { id: 0, issuer, audience: audience.trim() };
    if (ctx.db.authConfig.id.find(0)) ctx.db.authConfig.id.update(row);
    else ctx.db.authConfig.insert(row);
  },
);

/** Owner only: also trust another sign-in provider, e.g. the production Clerk instance. */
export const trustIssuer = spacetimedb.reducer(
  { issuer: t.string(), audience: t.string() },
  (ctx, { issuer, audience }) => {
    if (ctx.db.operator.identity.find(ctx.sender)?.role !== "owner") {
      throw new SenderError("Only the database owner can configure sign-in");
    }
    if (!ISSUER.test(issuer)) {
      throw new SenderError("Issuer must be an https URL with no trailing slash, e.g. https://example.clerk.accounts.dev");
    }
    const row = { issuer, audience: audience.trim() };
    if (ctx.db.trustedIssuer.issuer.find(issuer)) ctx.db.trustedIssuer.issuer.update(row);
    else ctx.db.trustedIssuer.insert(row);
  },
);

/** Owner only: stop trusting a sign-in provider. */
export const untrustIssuer = spacetimedb.reducer(
  { issuer: t.string() },
  (ctx, { issuer }) => {
    if (ctx.db.operator.identity.find(ctx.sender)?.role !== "owner") {
      throw new SenderError("Only the database owner can configure sign-in");
    }
    ctx.db.trustedIssuer.issuer.delete(issuer);
  },
);

/**
 * Keep the admin role in step with the identity provider.
 *
 * Runs on every connection. A trusted token with `role: "admin"` becomes an
 * admin; a trusted token without it loses a previously synced admin role. The
 * owner and CLI-granted operators are never touched from here.
 */
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const claims = trustedClaims(ctx);
  if (!claims) return;
  const existing = ctx.db.operator.identity.find(ctx.sender);
  if (existing && existing.role !== "admin") return;
  const isAdmin = claims.role === "admin";
  if (isAdmin && !existing) ctx.db.operator.insert({ identity: ctx.sender, role: "admin" });
  if (!isAdmin && existing) ctx.db.operator.identity.delete(ctx.sender);
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
    if (signInConfigured(ctx) && !trustedClaims(ctx)) {
      throw new SenderError("Sign in to report an incident");
    }
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
    if (!roleRow || !STAFF_ROLES.includes(roleRow.role)) {
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
    if (!roleRow || !STAFF_ROLES.includes(roleRow.role)) {
      return ctx.from.incident.where((row) => row.id.eq(""));
    }
    return ctx.from.incident;
  },
);
/** The signed-in person's own role, so the UI can say whether they are staff. */
export const myRole = spacetimedb.view(
  { name: "my_role", public: true },
  t.array(operator.rowType),
  (ctx) => {
    const row = ctx.db.operator.identity.find(ctx.sender);
    return row ? [row] : [];
  },
);
