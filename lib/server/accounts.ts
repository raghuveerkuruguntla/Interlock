/**
 * Customer accounts: profile, consent, consent log, activity and saved
 * incident reports.
 *
 * What is stored is deliberately small. No phone number, no contacts, no call
 * audio, no full transcripts. An incident report holds a title, a summary, the
 * signal labels and short quotes that justified the warning, and the next
 * steps — and only if the customer switched "Keep my incident reports" on.
 */

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
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
import { hashPassword, readSessionToken, SESSION_COOKIE, verifyPassword } from "./auth";
import { kv } from "./kv";

interface AccountRecord {
  user: PublicUser;
  passwordHash: string;
  consent: ConsentSettings;
  consentLog: ConsentLogEntry[];
  activity: ActivityEntry[];
  incidents: IncidentReport[];
}

const K = {
  account: (id: string) => `il:acct:${id}`,
  email: (email: string) => `il:email:${email}`,
};

const MAX_ACTIVITY = 200;
const MAX_INCIDENTS = 100;

async function load(id: string): Promise<AccountRecord | null> {
  return kv().get<AccountRecord>(K.account(id));
}

async function save(record: AccountRecord): Promise<void> {
  await kv().set(K.account(record.user.id), record);
}

function snapshot(record: AccountRecord): AccountSnapshot {
  const store = kv();
  return {
    user: record.user,
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

export type CreateResult = { ok: true; user: PublicUser } | { ok: false; error: string };

export async function createAccount(email: string, name: string, password: string): Promise<CreateResult> {
  const id = randomUUID();
  // Claim the email first, atomically, so two sign-ups cannot race to it.
  const claimed = await kv().setNx(K.email(email), id);
  if (!claimed) return { ok: false, error: "An account with that email already exists. Sign in instead." };
  const record: AccountRecord = {
    user: { id, email, name: name.trim().slice(0, 80) || email.split("@")[0], createdAt: Date.now() },
    passwordHash: hashPassword(password),
    consent: { ...DEFAULT_CONSENT },
    consentLog: [],
    activity: [],
    incidents: [],
  };
  log(record, "account_created");
  await save(record);
  return { ok: true, user: record.user };
}

export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const id = await kv().get<string>(K.email(email));
  // Hash anyway on a miss, so response time does not reveal whether an email is registered.
  if (!id) {
    verifyPassword(password, hashPassword("timing-equaliser"));
    return null;
  }
  const record = await load(id);
  if (!record || !verifyPassword(password, record.passwordHash)) return null;
  log(record, "signed_in");
  await save(record);
  return record.user;
}

/** The signed-in account for this request, or null. */
export async function currentAccountId(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
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

export async function deleteAccount(id: string): Promise<void> {
  const record = await load(id);
  if (!record) return;
  await kv().del(K.account(id), K.email(record.user.email));
}
