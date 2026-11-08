import { beforeEach, describe, expect, it, vi } from "vitest";

// accounts.ts reads the request cookie for the current user; these tests call
// the storage functions directly, so the request API is never touched.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import {
  authenticate,
  createAccount,
  deleteAccount,
  getSnapshot,
  saveIncident,
  updateConsent,
} from "@/lib/server/accounts";
import { resetMemoryKv } from "@/lib/server/kv";
import {
  activate,
  appendSegment,
  armedSession,
  armSession,
  endSession,
  finishCall,
  readSegments,
} from "@/lib/server/live";
import { sessionAllows } from "@/lib/server/live-consent";

const REPORT = {
  source: "live_call" as const,
  title: "t",
  summary: "s",
  stage: "hook" as const,
  tier: "low" as const,
  risk: 0.2,
  confidence: "c",
  signals: [],
  customerAction: "ended_call" as const,
  customerResponse: "r",
  recommendedAction: "a",
  nextSteps: [],
  exposure: null,
  campaignSignature: null,
  reportedToNetwork: false,
};

async function newUser(): Promise<string> {
  const r = await createAccount("a@b.co", "A", "long password 1");
  if (!r.ok) throw new Error(r.error);
  return r.user.id;
}

beforeEach(() => resetMemoryKv());

describe("accounts", () => {
  it("every consent starts off", async () => {
    const snap = await getSnapshot(await newUser());
    expect(snap?.consent).toMatchObject({
      callAnalysis: false,
      messageAnalysis: false,
      networkReporting: false,
      saveIncidents: false,
      trainingData: false,
    });
  });

  it("refuses a duplicate email and a wrong password", async () => {
    await newUser();
    expect((await createAccount("a@b.co", "B", "long password 2")).ok).toBe(false);
    expect(await authenticate("a@b.co", "nope nope nope")).toBeNull();
    expect(await authenticate("a@b.co", "long password 1")).not.toBeNull();
  });

  it("logs consent changes and never enables training data", async () => {
    const id = await newUser();
    const snap = await updateConsent(id, { callAnalysis: true, trainingData: true } as never, true);
    expect(snap?.consent.callAnalysis).toBe(true);
    expect(snap?.consent.trainingData).toBe(false);
    expect(snap?.consentLog.map((e) => e.key)).toEqual(["notice", "callAnalysis"]);
  });

  it("only saves reports with consent, and revoking deletes them", async () => {
    const id = await newUser();
    expect((await saveIncident(id, REPORT)).ok).toBe(false);
    await updateConsent(id, { saveIncidents: true }, false);
    expect((await saveIncident(id, REPORT)).ok).toBe(true);
    const after = await updateConsent(id, { saveIncidents: false }, false);
    expect(after?.incidents).toHaveLength(0);
  });

  it("deletes everything, and frees the email", async () => {
    const id = await newUser();
    await deleteAccount(id);
    expect(await getSnapshot(id)).toBeNull();
    expect((await createAccount("a@b.co", "A", "long password 1")).ok).toBe(true);
  });
});

describe("live sessions", () => {
  it("arms, records, frees the number when the call ends, and deletes on end", async () => {
    const armed = await armSession(null);
    if (!armed.ok) throw new Error(armed.error);
    const s = armed.session;
    expect((await armedSession())?.id).toBe(s.id);
    await activate(s, "CA1");
    expect((await armSession(null)).ok).toBe(false); // one live call at a time
    await appendSegment(s, { speaker: "caller", kind: "speech", text: "hello" });
    await appendSegment(s, { speaker: "caller", kind: "speech", text: "read me the code" });
    expect((await readSegments(s.id, 1)).map((x) => [x.seq, x.text])).toEqual([[1, "read me the code"]]);
    await finishCall(s);
    expect(await armedSession()).toBeNull();
    await endSession(s);
    expect(await readSegments(s.id, 0)).toEqual([]);
    expect(await sessionAllows(s, "call")).toBe(false);
  });

  it("stops analysing the moment an account revokes consent", async () => {
    const id = await newUser();
    await updateConsent(id, { callAnalysis: true }, true);
    const armed = await armSession(id);
    if (!armed.ok) throw new Error(armed.error);
    expect(await sessionAllows(armed.session, "call")).toBe(true);
    expect(await sessionAllows(armed.session, "message")).toBe(false);
    await updateConsent(id, { callAnalysis: false }, false);
    expect(await sessionAllows(armed.session, "call")).toBe(false);
  });
});
