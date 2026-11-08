/**
 * Live speech: finalised transcript segments from a call the customer opted in to.
 */
import { describe, expect, it } from "vitest";
import { assessThread } from "@/lib/engine/killchain";
import { buildIncidentReport } from "@/lib/engine/report";
import type { Actor, ThreadEvent } from "@/lib/engine/types";

function speech(lines: [Actor, string][]): ThreadEvent[] {
  return lines.map(([actor, text], i) => ({
    id: `s${i}`,
    at: i * 8,
    channel: "call",
    actor,
    kind: "live_transcript",
    text,
  }));
}

const IMPROVISED_SCAM: [Actor, string][] = [
  ["external", "hi this is Mike from T-Mobile account security"],
  ["external", "someone is trying to move your number to another carrier and we need to stop it right now"],
  ["external", "please don't hang up and don't go to a store they can't help with this"],
  ["external", "I'm sending you a six digit code can you read it back to me"],
  ["external", "you'll also need to buy a gift card to secure the account"],
];

describe("live transcript", () => {
  it("escalates stage by stage as an improvised scam unfolds", () => {
    const events = speech(IMPROVISED_SCAM);
    const stages = events.map((_, i) => assessThread(events.slice(0, i + 1)).stage);
    expect(stages).toEqual(["hook", "hook", "isolation", "escalation", "extraction"]);
    const final = assessThread(events);
    expect(final.tier).toBe("critical");
    expect(final.signals.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "brand_claim",
        "discourage_verification",
        "secret_request",
        "money_movement_request",
      ]),
    );
  });

  it("quotes what was heard in the evidence", () => {
    const a = assessThread(speech(IMPROVISED_SCAM.slice(0, 4)));
    const code = a.signals.find((s) => s.id === "secret_request");
    expect(code?.evidence).toMatch(/^Heard on the call:/);
  });

  it("never scores the customer's own words", () => {
    const a = assessThread(
      speech([
        ["customer", "I will not read you the code and I'm going to call my bank right now"],
        ["customer", "should I buy a gift card"],
      ]),
    );
    expect(a.signals).toHaveLength(0);
    expect(a.tier).toBe("none");
  });

  it("stays quiet on an ordinary call", () => {
    const a = assessThread(
      speech([
        ["external", "hey man what's up"],
        ["external", "are we still meeting for lunch tomorrow at noon"],
        ["external", "cool I'll text you when I'm outside"],
      ]),
    );
    expect(a.tier).toBe("none");
  });

  it("respects a genuine safety reminder", () => {
    const a = assessThread(speech([["external", "remember we will never ask you for that code"]]));
    expect(a.signals.some((s) => s.id === "secret_request")).toBe(false);
  });

  it("marks live transcription in the receipt without claiming a recording", () => {
    const a = assessThread(speech(IMPROVISED_SCAM));
    expect(a.receipt.observed.join(" ")).toMatch(/transcribed live/i);
    expect(a.receipt.notUsed.join(" ")).toMatch(/keeps no recording/i);
  });

  it("produces a report a person can act on", () => {
    const r = buildIncidentReport(assessThread(speech(IMPROVISED_SCAM)), {
      source: "live_call",
      customerAction: "ended_call",
    });
    expect(r.title).toMatch(/impersonation/i);
    expect(r.summary).toMatch(/^The caller /);
    expect(r.customerResponse).toMatch(/ended the conversation/i);
    expect(r.nextSteps.length).toBeGreaterThan(1);
    expect(r.signals.every((s) => s.evidence.length <= 120)).toBe(true);
  });
});
