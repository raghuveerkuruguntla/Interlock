import { describe, expect, it } from "vitest";
import { DEMO_THREADS, PORT_OUT_SCAM } from "@/lib/data/hero";
import { assessThread } from "@/lib/engine/killchain";
import { combineDemoEvents } from "@/lib/ui/demo-timeline";
import type { ThreadEvent } from "@/lib/engine/types";

describe("interactive demo story integrity", () => {
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
