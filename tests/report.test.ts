import { describe, expect, it } from "vitest";
import { DEMO_THREADS } from "@/lib/data/hero";
import { assessThread } from "@/lib/engine/killchain";
import { alertEmailText, buildIncidentReport, confidenceWords } from "@/lib/engine/report";

describe("incident report", () => {
  it("does not invent a scam when nothing fired", () => {
    const r = buildIncidentReport(assessThread([]), { source: "live_call", customerAction: "none" });
    expect(r.title).toMatch(/no warning signs/i);
    expect(r.signals).toHaveLength(0);
  });

  it("switches to recovery steps when the customer reports an exposure", () => {
    const a = assessThread(DEMO_THREADS[0].events);
    const r = buildIncidentReport(a, {
      source: "demo",
      customerAction: "reported_exposure",
      exposure: "carrier_otp",
    });
    expect(r.exposure).toBe("carrier_otp");
    expect(r.recommendedAction).toMatch(/lock things down/i);
  });

  it("every scripted demo produces a complete report at its end", () => {
    for (const t of DEMO_THREADS) {
      const a = assessThread(t.events);
      const r = buildIncidentReport(a, { source: "demo", customerAction: "ended_call" });
      expect(r.title.length).toBeGreaterThan(5);
      expect(r.nextSteps.length).toBeGreaterThan(0);
      expect(r.confidence).toBe(confidenceWords(a));
    }
  });

  it("alert email contains no links", () => {
    const r = buildIncidentReport(assessThread(DEMO_THREADS[0].events), {
      source: "demo",
      customerAction: "ended_call",
    });
    expect(alertEmailText(r)).not.toMatch(/https?:|www\.|\.com\b/i);
  });
});
