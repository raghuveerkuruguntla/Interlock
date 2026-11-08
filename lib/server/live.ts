/**
 * Live phone sessions.
 *
 * A customer "arms" a session from the live page. The next call (or text) to
 * the Interlock Twilio number attaches to it, Twilio transcribes the call in
 * real time and posts each utterance here, and the customer's browser polls
 * for new segments and scores them with the same on-device engine as
 * everything else.
 *
 * What is held, and for how long: finalised transcript segments and the
 * latest partial line per speaker, for at most two hours, and deleted the
 * moment the customer ends the session. No audio is ever received — Twilio
 * transcribes and sends text only. The caller's number is stored masked.
 */

import { randomUUID } from "node:crypto";
import { kv } from "./kv";

export const LIVE_TTL_SECONDS = 2 * 60 * 60;
/** How long an armed session waits for a call before it lapses. */
export const ARM_TTL_SECONDS = 30 * 60;

export type Speaker = "caller" | "customer" | "system";

export interface LiveSegment {
  seq: number;
  /** Seconds since the session was armed. */
  at: number;
  speaker: Speaker;
  kind: "speech" | "sms" | "call_start" | "call_end" | "skipped_contact" | "notice";
  text?: string;
  label?: string;
}

export interface LiveSession {
  id: string;
  ownerId: string | null;
  createdAt: number;
  status: "armed" | "active" | "finished" | "ended";
  /** The first call leg. Kept for sessions created before callSids existed. */
  callSid: string | null;
  /** Every call leg in this session: one in forward mode, up to two in conference mode. */
  callSids?: string[];
  endedAt: number | null;
}

const K = {
  session: (id: string) => `il:live:${id}`,
  segments: (id: string) => `il:live:${id}:seg`,
  partial: (id: string, s: Speaker) => `il:live:${id}:p:${s}`,
  armed: "il:live:armed",
};

export async function getSession(id: string): Promise<LiveSession | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return kv().get<LiveSession>(K.session(id));
}

async function putSession(s: LiveSession): Promise<void> {
  await kv().set(K.session(s.id), s, LIVE_TTL_SECONDS);
}

export type ArmResult = { ok: true; session: LiveSession } | { ok: false; error: string; status: number };

/**
 * Arm a new session. One Twilio number serves one live call at a time, so a
 * new session cannot take over while another is mid-call.
 */
export async function armSession(ownerId: string | null): Promise<ArmResult> {
  const currentId = await kv().get<string>(K.armed);
  if (currentId) {
    const current = await getSession(currentId);
    if (current?.status === "active") {
      return { ok: false, status: 409, error: "Another live call is in progress on the demo number. Try again when it ends." };
    }
  }
  const session: LiveSession = {
    id: randomUUID(),
    ownerId,
    createdAt: Date.now(),
    status: "armed",
    callSid: null,
    callSids: [],
    endedAt: null,
  };
  await putSession(session);
  await kv().set(K.armed, session.id, ARM_TTL_SECONDS);
  return { ok: true, session };
}

export async function armedSession(): Promise<LiveSession | null> {
  const id = await kv().get<string>(K.armed);
  if (!id) return null;
  const s = await getSession(id);
  return s && s.status !== "ended" ? s : null;
}

export async function activate(s: LiveSession, callSid: string): Promise<void> {
  s.status = "active";
  s.callSid = s.callSid ?? callSid;
  const legs = s.callSids ?? (s.callSid ? [s.callSid] : []);
  if (!legs.includes(callSid)) legs.push(callSid);
  s.callSids = legs;
  await putSession(s);
  await kv().expire(K.armed, LIVE_TTL_SECONDS);
}

export async function appendSegment(
  s: LiveSession,
  seg: Omit<LiveSegment, "seq" | "at">,
): Promise<void> {
  const at = Math.max(0, Math.round((Date.now() - s.createdAt) / 1000));
  // seq is assigned from the list length after the push, so it is monotonic
  // even if two webhooks land at once.
  const store = kv();
  const n = await store.push(K.segments(s.id), { ...seg, at, seq: -1 }, LIVE_TTL_SECONDS);
  void n;
  if (seg.speaker !== "system") await store.del(K.partial(s.id, seg.speaker));
}

export async function setPartial(s: LiveSession, speaker: Speaker, text: string): Promise<void> {
  await kv().set(K.partial(s.id, speaker), text.slice(0, 500), 120);
}

export async function readSegments(id: string, after: number): Promise<LiveSegment[]> {
  const raw = await kv().range<LiveSegment>(K.segments(id), after);
  return raw.map((seg, i) => ({ ...seg, seq: after + i }));
}

export async function readPartials(id: string): Promise<Partial<Record<Speaker, string>>> {
  const [caller, customer] = await Promise.all([
    kv().get<string>(K.partial(id, "caller")),
    kv().get<string>(K.partial(id, "customer")),
  ]);
  return { ...(caller ? { caller } : {}), ...(customer ? { customer } : {}) };
}

/**
 * The call is over. The transcript stays readable until the customer ends the
 * session (or it expires), but the shared number is freed for the next call.
 */
export async function finishCall(s: LiveSession): Promise<void> {
  await appendSegment(s, { speaker: "system", kind: "call_end" });
  s.status = "finished";
  await putSession(s);
  const store = kv();
  if ((await store.get<string>(K.armed)) === s.id) await store.del(K.armed);
}

/** End the session and delete everything it held. */
export async function endSession(s: LiveSession): Promise<void> {
  const store = kv();
  await store.del(K.segments(s.id), K.partial(s.id, "caller"), K.partial(s.id, "customer"));
  const armed = await store.get<string>(K.armed);
  if (armed === s.id) await store.del(K.armed);
  s.status = "ended";
  s.endedAt = Date.now();
  // Keep the bare session record briefly so late webhooks are refused, not re-armed.
  await store.set(K.session(s.id), s, 600);
}

export async function sessionByCall(callSid: string, id: string | null): Promise<LiveSession | null> {
  if (!id) return null;
  const s = await getSession(id);
  if (!s || s.status !== "active") return null;
  const legs = s.callSids ?? (s.callSid ? [s.callSid] : []);
  return legs.includes(callSid) ? s : null;
}
