import { describe, expect, it } from "vitest";
import { DEMO_THREADS, PORT_OUT_SCAM } from "@/lib/data/hero";
import { assessThread } from "@/lib/engine/killchain";
import { combineDemoEvents } from "@/lib/ui/demo-timeline";
import type { ThreadEvent } from "@/lib/engine/types";

describe("interactive demo story integrity", () => {
  it("provides a complete visible narrative and clear next step for every featured scenario", () => {
    expect(DEMO_THREADS).toHaveLength(5);
    expect(DEMO_THREADS.every((thread) => thread.events.length >= 5)).toBe(true);
    expect(DEMO_THREADS.every((thread) =>
      Boolean(thread.outcome?.title && thread.outcome?.explanation && thread.outcome?.nextStep)
    )).toBe(true);
    expect(DEMO_THREADS.some((thread) => thread.id === "CUSTOM-THREAD")).toBe(false);
  });

  it("keeps events uniquely identified and chronological within each story", () => {
    for (const thread of DEMO_THREADS) {
      const ids = thread.events.map((event) => event.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(thread.events.every((event, index) => index === 0 || event.at >= thread.events[index - 1].at)).toBe(true);
    }
  });

  it("completes the legitimate bank alert with independent verification", () => {
    const legitimate = DEMO_THREADS.find((thread) => thread.id === "HERO-FP");
    expect(legitimate).toBeDefined();
    const events = legitimate!.events;
    expect(events.some((event) => event.actor === "customer" && event.kind === "message")).toBe(true);
    expect(events.at(-1)?.kind).toBe("out_of_band_verified");
    const result = assessThread(events);
    expect(result.verified).toBe(true);
  });

  it("completes the bank phishing example with an exposure-specific recovery", () => {
    const bank = DEMO_THREADS.find((thread) => thread.id === "HERO-BANK");
    const result = assessThread(bank!.events);
    expect(result.recoveryActive).toBe(true);
    expect(result.safeguards.some((item) => item.id === "recovery_mode")).toBe(true);
  });

  for (const thread of DEMO_THREADS) {
    it(`replays every visible step in ${thread.id} without leaking later messages`, () => {
      for (let cursor = 0; cursor <= thread.events.length; cursor += 1) {
        const visible = combineDemoEvents(thread.events, cursor, []);
        expect(visible).toEqual(thread.events.slice(0, cursor));
        const result = assessThread(visible);
        expect(result.risk).toBeGreaterThanOrEqual(0);
        expect(result.risk).toBeLessThanOrEqual(1);
        expect(result.receipt).toBeTruthy();
      }
    });
  }

  it("reaches a sensitive account-change intervention in the full walkthrough", () => {
    const result = assessThread(PORT_OUT_SCAM.events);
    expect(result.stage).toBe("extraction");
    expect(result.safeguards.some((item) => item.id === "circuit_breaker")).toBe(true);
  });

  it("activates recovery when the simulated customer chooses to report exposure", () => {
    const last = PORT_OUT_SCAM.events[PORT_OUT_SCAM.events.length - 1];
    const report: ThreadEvent = {
      id: "recovery-choice",
      at: last.at + 30,
      channel: "customer",
      actor: "customer",
      kind: "customer_report",
      exposure: "carrier_otp",
    };
    const result = assessThread([...PORT_OUT_SCAM.events, report]);
    expect(result.recoveryActive).toBe(true);
    expect(result.safeguards.some((item) => item.id === "recovery_mode")).toBe(true);
  });
});
