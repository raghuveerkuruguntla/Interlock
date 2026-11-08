import { beforeEach, describe, expect, it, vi } from "vitest";

// accounts.ts reads the signed-in user from Clerk; these tests call the
// storage functions directly with a user id, so Clerk is never contacted.
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null }),
  currentUser: async () => null,
  clerkClient: async () => ({ users: { deleteUser: async () => undefined } }),
}));

import {
  createAccountRecord,
  deleteAccountData,
  getSnapshot,
  isAdminMetadata,
  saveIncident,
  updateConsent,
} from "@/lib/server/accounts";
import { resetMemoryKv } from "@/lib/server/kv";
import { needsConsent } from "@/lib/account/types";
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

async function newUser(id = "user_alice"): Promise<string> {
  const r = await createAccountRecord(id, "a@b.co", "A");
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

  it("sends a new customer through consent, and not again once they accept", async () => {
    const id = await newUser();
    expect(needsConsent((await getSnapshot(id))!.consent)).toBe(true);
    // Choosing nothing is a valid answer: accepting the notice with everything off completes it.
    const after = await updateConsent(id, {}, true);
    expect(needsConsent(after!.consent)).toBe(false);
    expect(after!.consent).toMatchObject({ callAnalysis: false, messageAnalysis: false, saveIncidents: false });
  });

  it("asks again when the privacy notice changes", () => {
    expect(needsConsent({ noticeVersion: "2020-01-01" })).toBe(true);
    expect(needsConsent({ noticeVersion: null })).toBe(true);
  });

  it("re-saving onboarding with existing choices keeps them", async () => {
    const id = await newUser();
    await updateConsent(id, { callAnalysis: true, saveIncidents: true }, true);
    const again = await updateConsent(id, { callAnalysis: true, saveIncidents: true, networkReporting: false }, true);
    expect(again!.consent).toMatchObject({ callAnalysis: true, saveIncidents: true });
  });

  it("creates a Clerk user's record once and keeps existing choices", async () => {
    const id = await newUser();
    await updateConsent(id, { callAnalysis: true }, true);
    await createAccountRecord(id, "a@b.co", "A");
    expect((await getSnapshot(id))?.consent.callAnalysis).toBe(true);
  });

  it("keeps each user's data separate", async () => {
    const alice = await newUser("user_alice");
    const bob = await newUser("user_bob");
    await updateConsent(alice, { saveIncidents: true }, false);
    await saveIncident(alice, REPORT);
    expect((await getSnapshot(alice))?.incidents).toHaveLength(1);
    expect((await getSnapshot(bob))?.incidents).toHaveLength(0);
  });

  it("only treats an explicit admin role in Clerk metadata as admin", () => {
    expect(isAdminMetadata({ role: "admin" })).toBe(true);
    expect(isAdminMetadata({ role: "Admin" })).toBe(false);
    expect(isAdminMetadata({ role: ["admin"] })).toBe(false);
    expect(isAdminMetadata({})).toBe(false);
    expect(isAdminMetadata(null)).toBe(false);
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

  it("deletes everything Interlock holds for the user", async () => {
    const id = await newUser();
    await deleteAccountData(id);
    expect(await getSnapshot(id)).toBeNull();
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
