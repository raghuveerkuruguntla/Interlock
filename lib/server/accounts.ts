/**
 * Customer accounts: profile, consent, consent log, activity and saved
 * incident reports.
 *
 * Sign-in is Clerk's job — passwords, sessions, email verification and
 * account security all live there. This module keeps only what Interlock
 * itself needs, keyed by the Clerk user id, and creates it the first time a
 * signed-in user reaches the app.
 *
 * What is stored is deliberately small. No phone number, no contacts, no call
 * audio, no full transcripts. An incident report holds a title, a summary, the
 * signal labels and short quotes that justified the warning, and the next
 * steps — and only if the customer switched "Keep my incident reports" on.
 */

import { randomUUID } from "node:crypto";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import {
  type AccountSnapshot,
  type ActivityEntry,
  CONSENT_KEYS,
  type ConsentKey,
  type ConsentLogEntry,
  type ConsentSettings,
  DEFAULT_CONSENT,
  type IncidentReport,
  NOTICE_VERSION,
  type PublicUser,
} from "@/lib/account/types";
import { kv } from "./kv";

interface AccountRecord {
  user: PublicUser;
  consent: ConsentSettings;
  consentLog: ConsentLogEntry[];
  activity: ActivityEntry[];
  incidents: IncidentReport[];
}

const K = {
  account: (id: string) => `il:acct:${id}`,
};

const MAX_ACTIVITY = 200;
const MAX_INCIDENTS = 100;

async function load(id: string): Promise<AccountRecord | null> {
  return kv().get<AccountRecord>(K.account(id));
}

async function save(record: AccountRecord): Promise<void> {
  await kv().set(K.account(record.user.id), record);
}

function snapshot(record: AccountRecord, isAdmin = false): AccountSnapshot {
  const store = kv();
  return {
    user: record.user,
    isAdmin,
    consent: record.consent,
    consentLog: record.consentLog,
    activity: record.activity,
    incidents: record.incidents,
    store: { kind: store.kind, durable: store.durable },
  };
}

function log(record: AccountRecord, kind: ActivityEntry["kind"], detail?: string): void {
  record.activity.unshift({ at: Date.now(), kind, detail });
  record.activity.length = Math.min(record.activity.length, MAX_ACTIVITY);
}

/**
 * Create the Interlock record for a Clerk user, if it does not exist yet.
 * Every consent starts off. Exported for tests, which have no Clerk session.
 */
export async function createAccountRecord(id: string, email: string, name: string): Promise<AccountRecord> {
  const existing = await load(id);
  if (existing) return existing;
  const record: AccountRecord = {
    user: { id, email, name: name.trim().slice(0, 80) || email.split("@")[0] || "Interlock user", createdAt: Date.now() },
    consent: { ...DEFAULT_CONSENT },
    consentLog: [],
    activity: [],
    incidents: [],
  };
  log(record, "account_created");
  await save(record);
  return record;
}

/** The signed-in Clerk user id for this request, or null. */
export async function currentAccountId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Whether a Clerk user is the Interlock admin: `publicMetadata.role` set to
 * "admin" in the Clerk dashboard. Public metadata can only be written from
 * the dashboard or the backend API, never by the user themselves.
 */
export function isAdminMetadata(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as { role?: unknown }).role === "admin");
}

export async function currentUserIsAdmin(): Promise<boolean> {
  const user = await currentUser();
  return isAdminMetadata(user?.publicMetadata);
}

/** The signed-in user's account, creating the Interlock record on first visit. */
export async function currentSnapshot(): Promise<AccountSnapshot | null> {
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";
  const record = await createAccountRecord(user.id, email, name);
  // Keep the display details in step with Clerk, where the user edits them.
  if (record.user.email !== email || (name && record.user.name !== name)) {
    record.user = { ...record.user, email, name: name || record.user.name };
    await save(record);
  }
  return snapshot(record, isAdminMetadata(user.publicMetadata));
}

export async function getSnapshot(id: string): Promise<AccountSnapshot | null> {
  const record = await load(id);
  return record ? snapshot(record) : null;
}

export async function recordActivity(id: string, kind: ActivityEntry["kind"], detail?: string): Promise<void> {
  const record = await load(id);
  if (!record) return;
  log(record, kind, detail);
  await save(record);
}

export async function updateConsent(
  id: string,
  patch: Partial<Record<ConsentKey, unknown>>,
  acceptNotice: boolean,
): Promise<AccountSnapshot | null> {
  const record = await load(id);
  if (!record) return null;
  const now = Date.now();
  let changed = false;
  for (const key of CONSENT_KEYS) {
    const value = patch[key];
    if (typeof value !== "boolean" || record.consent[key] === value) continue;
    record.consent[key] = value;
    record.consentLog.unshift({ at: now, key, value });
    changed = true;
  }
  if (acceptNotice && record.consent.noticeVersion !== NOTICE_VERSION) {
    record.consent.noticeVersion = NOTICE_VERSION;
    record.consentLog.unshift({ at: now, key: "notice", value: NOTICE_VERSION });
    changed = true;
  }
  // Revoking report-keeping removes the reports too. Consent withdrawn means
  // the data it covered goes, not just that we stop adding to it.
  if (patch.saveIncidents === false && record.incidents.length) {
    record.incidents = [];
    log(record, "incident_deleted", "All reports removed when you turned off report-keeping");
  }
  record.consent.trainingData = false;
  if (changed) {
    record.consent.updatedAt = now;
    log(record, "consent_changed");
  }
  await save(record);
  return snapshot(record);
}

export type SaveIncidentResult =
  | { ok: true; incident: IncidentReport }
  | { ok: false; error: string; status: number };

export async function saveIncident(
  id: string,
  incident: Omit<IncidentReport, "id" | "createdAt">,
): Promise<SaveIncidentResult> {
  const record = await load(id);
  if (!record) return { ok: false, error: "Not signed in.", status: 401 };
  if (!record.consent.saveIncidents) {
    return {
      ok: false,
      error: "Report-keeping is off. Turn on “Keep my incident reports” in Privacy to save reports.",
      status: 403,
    };
  }
  const saved: IncidentReport = { ...incident, id: randomUUID(), createdAt: Date.now() };
  record.incidents.unshift(saved);
  record.incidents.length = Math.min(record.incidents.length, MAX_INCIDENTS);
  log(record, "incident_saved", saved.title);
  await save(record);
  return { ok: true, incident: saved };
}

export async function deleteIncident(id: string, incidentId: string): Promise<boolean> {
  const record = await load(id);
  if (!record) return false;
  const before = record.incidents.length;
  record.incidents = record.incidents.filter((x) => x.id !== incidentId);
  if (record.incidents.length === before) return false;
  log(record, "incident_deleted");
  await save(record);
  return true;
}

/** Delete Interlock's data for this user. */
export async function deleteAccountData(id: string): Promise<void> {
  await kv().del(K.account(id));
}

/** Delete Interlock's data and the Clerk user itself. */
export async function deleteAccount(id: string): Promise<void> {
  await deleteAccountData(id);
  const client = await clerkClient();
  await client.users.deleteUser(id);
}
