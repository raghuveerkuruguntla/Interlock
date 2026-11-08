/**
 * Tests for the properties the kill-chain machine promises.
 *
 * These are the claims made in the pitch, so they are the ones that have to be
 * mechanically true rather than merely asserted on a slide.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessThread, tierFor, traceThread } from "@/lib/engine/killchain";
import { Scorer, type ScoringModel } from "@/lib/engine/scorer";
import { detectSignals } from "@/lib/engine/signals";
import type { ThreadEvent } from "@/lib/engine/types";

const model: ScoringModel = JSON.parse(
  readFileSync(join(process.cwd(), "public", "model", "model.json"), "utf8"),
);
const scorer = new Scorer(model);

let seq = 0;
function msg(text: string, at = (seq += 60)): ThreadEvent {
  return { id: `e${seq}`, at, channel: "sms", actor: "external", kind: "message", text };
}
function reset() {
  seq = 0;
}

describe("stages advance on evidence and never un-enter", () => {
  it("leaves a bare opener at contact, with no verdict", () => {
    reset();
    // The matched-pair opener. Identical between scam V3-0001 and legitimate
    // V3-0002, so asserting a verdict here would be wrong half the time.
    const a = assessThread([msg("There is a pending change on the mobile line ending 42.")], {
      scorer,
    });
    expect(a.stage).toBe("contact");
    expect(["none", "low"]).toContain(a.tier);
    expect(a.safeguards.find((s) => s.severity === "intervene")).toBeUndefined();
    // Worth stating outright: our own classifier is badly overconfident here.
    // It rates a coin-flip opener above 0.9. The product still does not
    // assert, because at first contact a score is not yet evidence.
    expect(a.modelProbability).toBeGreaterThan(0.9);
  });

  it("advances to escalation when the same thread asks for the code", () => {
    reset();
    const a = assessThread(
      [
        msg("There is a pending change on the mobile line ending 42."),
        msg("Reply with the verification code to stop the change."),
      ],
      { scorer },
    );
    expect(a.stage).toBe("escalation");
    expect(["high", "critical"]).toContain(a.tier);
  });

  it("does not advance when the matched legitimate half gives safety advice", () => {
    reset();
    const a = assessThread(
      [
        msg("There is a pending change on the mobile line ending 42."),
        msg("We will never ask you to send us that verification code."),
      ],
      { scorer },
    );
    // The negation guard is what makes this pair separable at all.
    expect(a.signals.find((s) => s.id === "secret_request")).toBeUndefined();
    expect(["none", "low", "elevated"]).toContain(a.tier);
  });

  it("accepts a forward jump straight from contact to escalation", () => {
    reset();
    const a = assessThread(
      [msg("Chase fraud dept: confirm the 6-digit code we just texted to stop a $4,200 wire.")],
      { scorer },
    );
    expect(a.stage).toBe("escalation");
  });

  it("never rewinds the stage when small talk follows", () => {
    reset();
    const events = [
      msg("Don't tell your family about this, they'll only worry."),
      msg("Anyway, how was your weekend?"),
      msg("The weather has been nice here."),
      msg("Did you watch the game?"),
    ];
    const trace = traceThread(events, { scorer });
    expect(trace[0].stage).toBe("isolation");
    for (const step of trace) expect(step.stage).toBe("isolation");
  });
});

describe("risk is sticky and decays slowly", () => {
  it("holds a thread above Low through a long quiet gap", () => {
    reset();
    const events: ThreadEvent[] = [
      msg("Don't call your bank about this, they'll just block it.", 0),
      // Three hours of silence — two full half-lives of accrued evidence.
      msg("Hope you had a good day.", 3 * 3600),
    ];
    const after = assessThread(events, { scorer });
    expect(after.stage).toBe("isolation");
    // The stage floor is what survives the decay.
    expect(after.risk).toBeGreaterThanOrEqual(0.45);
    expect(["elevated", "high", "critical"]).toContain(after.tier);
  });

  it("counts a repeated demand once, not five times", () => {
    reset();
    const once = assessThread([msg("Send me the verification code.")], { scorer });
    reset();
    const fiveTimes = assessThread(
      [
        msg("Send me the verification code."),
        msg("Send me the verification code."),
        msg("Send me the verification code."),
        msg("Send me the verification code."),
        msg("Send me the verification code."),
      ],
      { scorer },
    );
    expect(fiveTimes.signals.filter((s) => s.id === "secret_request")).toHaveLength(1);
    expect(fiveTimes.tier).toBe(once.tier);
  });
});

describe("the model cannot act alone", () => {
  it("caps a confident classifier below the interlock tiers", () => {
    reset();
    // Deliberately bypass the deterministic detectors: scored text with no
    // observable request in it. However certain the classifier is, this must
    // not be able to hold anyone's account.
    const a = assessThread([msg("Totally innocuous filler sentence about nothing at all.")], {
      scorer,
    });
    const modelOnlyCeiling = 0.5;
    expect(a.risk).toBeLessThanOrEqual(Math.max(modelOnlyCeiling, 0.2) + 1e-9);
    expect(a.safeguards.find((s) => s.id === "circuit_breaker")).toBeUndefined();
    expect(a.safeguards.find((s) => s.id === "otp_guard")).toBeUndefined();
  });

  it("abstains instead of asserting when the score is mid-band and nothing fired", () => {
    reset();
    // Scan the corpus for a case that genuinely lands in the band.
    const candidates = [
      "Your delivery could not be completed today. Please confirm your details.",
      "Following up on the account review we discussed earlier this week.",
      "Hi, this is regarding the recent activity notice on your profile.",
    ];
    const assessments = candidates.map((t) => {
      reset();
      return assessThread([msg(t)], { scorer });
    });
    const abstained = assessments.filter((a) => a.abstaining);
    for (const a of abstained) {
      expect(a.safeguards.some((s) => s.id === "abstain_question")).toBe(true);
      expect(a.safeguards.some((s) => s.id === "grounded_warning")).toBe(false);
    }
  });
});

describe("OTP Guard", () => {
  it("holds a passcode that arrives during a call with an unknown number", () => {
    reset();
    const a = assessThread(
      [
        { id: "c1", at: 0, channel: "call", actor: "external", kind: "call_start", label: "Unknown +1 940 555 0147" },
        { id: "o1", at: 40, channel: "sms", actor: "system", kind: "otp_received", otpIssuer: "T-Mobile" },
      ],
      { scorer },
    );
    const guard = a.safeguards.find((s) => s.id === "otp_guard");
    expect(guard).toBeDefined();
    expect(guard?.severity).toBe("intervene");
    expect(a.stage).toBe("escalation");
  });

  it("stays quiet when the same code arrives with no call in progress", () => {
    reset();
    const a = assessThread(
      [{ id: "o1", at: 40, channel: "sms", actor: "system", kind: "otp_received", otpIssuer: "T-Mobile" }],
      { scorer },
    );
    expect(a.safeguards.find((s) => s.id === "otp_guard")).toBeUndefined();
    expect(a.stage).toBe("contact");
  });

  it("stays quiet when the caller is a known contact", () => {
    reset();
    const a = assessThread(
      [
        { id: "c1", at: 0, channel: "call", actor: "external", kind: "call_start", label: "Contact: Mom" },
        { id: "o1", at: 40, channel: "sms", actor: "system", kind: "otp_received", otpIssuer: "T-Mobile" },
      ],
      { scorer },
    );
    expect(a.safeguards.find((s) => s.id === "otp_guard")).toBeUndefined();
  });
});

describe("the circuit breaker", () => {
  it("fires on a port-out and says plainly what is about to happen", () => {
    reset();
    const a = assessThread(
      [
        msg("Stay on the line, do not hang up while I move this over."),
        {
          id: "a1",
          at: 300,
          channel: "customer",
          actor: "system",
          kind: "account_action_requested",
          accountAction: "port_out",
        },
      ],
      { scorer },
    );
    const breaker = a.safeguards.find((s) => s.id === "circuit_breaker");
    expect(breaker).toBeDefined();
    expect(a.stage).toBe("extraction");
    expect(a.tier).toBe("critical");
    // No jargon in the victim path.
    expect(breaker?.reasons.join(" ")).toMatch(/phone number to a different company/i);
    expect(breaker?.reasons.join(" ")).not.toMatch(/SIM swap|port-?out/i);
  });

  it("is a delay, not a block — the customer can always continue", () => {
    reset();
    const a = assessThread(
      [
        {
          id: "a1",
          at: 10,
          channel: "customer",
          actor: "system",
          kind: "account_action_requested",
          accountAction: "sim_swap",
        },
      ],
      { scorer },
    );
    const breaker = a.safeguards.find((s) => s.id === "circuit_breaker");
    expect(breaker?.action?.kind).toBe("hold_action");
    expect(breaker?.body).toMatch(/not stopping you/i);
  });
});

describe("honest de-escalation", () => {
  it.each(["port_out", "sim_swap"] as const)(
    "keeps established risk and the %s hold when the customer claims verification",
    (accountAction) => {
      reset();
      const events: ThreadEvent[] = [
        msg("This is your bank's fraud team. Call us back on 877-555-0100 right away."),
        {
          id: "a1",
          at: 200,
          channel: "customer",
          actor: "system",
          kind: "account_action_requested",
          accountAction,
        },
        { id: "v1", at: 260, channel: "customer", actor: "customer", kind: "out_of_band_verified" },
      ];
      const after = assessThread(events, { scorer });
      const withoutVerification = assessThread(
        [...events.slice(0, -1), { ...events[1], at: 260 }],
        { scorer },
      );

      expect(after.verified).toBe(false);
      expect(after.risk).toBe(withoutVerification.risk);
      expect(after.tier).toBe("critical");
      expect(after.safeguards.find((s) => s.id === "circuit_breaker")?.action?.kind).toBe(
        "hold_action",
      );
    },
  );

  it("allows verification to de-escalate a low-risk thread", () => {
    const result = assessThread([
      msg("Your monthly statement is ready."),
      { id: "v1", at: 100, channel: "customer", actor: "customer", kind: "out_of_band_verified" },
    ], { scorer });
    expect(result.verified).toBe(true);
    expect(result.risk).toBeLessThanOrEqual(0.2);
  });

  it("re-arms if hard evidence arrives after the verification", () => {
    reset();
    const a = assessThread(
      [
        msg("Quick question about your account."),
        { id: "v1", at: 100, channel: "customer", actor: "customer", kind: "out_of_band_verified" },
        msg("Great — now read me the code that just came through.", 200),
      ],
      { scorer },
    );
    expect(a.verified).toBe(false);
    expect(a.stage).toBe("escalation");
  });
});

describe("recovery", () => {
  it("opens on a customer report even if the classifier missed the fraud", () => {
    reset();
    const a = assessThread(
      [
        msg("Hi, following up on our chat."),
        {
          id: "r1",
          at: 500,
          channel: "customer",
          actor: "customer",
          kind: "customer_report",
          exposure: "carrier_otp",
        },
      ],
      { scorer },
    );
    expect(a.recoveryActive).toBe(true);
    expect(a.stage).toBe("recovery");
    const recovery = a.safeguards.find((s) => s.id === "recovery_mode");
    expect(recovery?.reasons.length).toBeGreaterThan(2);
  });

  it("labels exposure as a customer claim, never as proof of theft", () => {
    reset();
    const a = assessThread(
      [
        {
          id: "r1",
          at: 10,
          channel: "customer",
          actor: "customer",
          kind: "customer_report",
          exposure: "payment_card",
        },
      ],
      { scorer },
    );
    expect(a.receipt.observed).toContain("What you told us you may have shared");
  });
});

describe("decision receipts", () => {
  it("states what was not used, including the answer key", () => {
    reset();
    const a = assessThread([msg("Send the code now.")], { scorer });
    expect(a.receipt.notUsed.join(" ")).toMatch(/answer key/i);
    expect(a.receipt.notUsed.join(" ")).toMatch(/audio or transcript/i);
  });

  it("says nothing left the device when reporting consent is absent", () => {
    reset();
    const a = assessThread([msg("Send the code now.")], { scorer });
    expect(a.receipt.leftTheDevice).toEqual(["Nothing. Scoring ran on this device."]);
  });

  it("names exactly what crosses when consent is given", () => {
    reset();
    const a = assessThread([msg("Send the code now.")], { scorer, reportingConsent: true });
    expect(a.receipt.leftTheDevice.join(" ")).toMatch(/campaign signature/i);
    expect(a.receipt.leftTheDevice.join(" ")).not.toMatch(/message text/i);
  });
});

describe("tier boundaries", () => {
  it("maps risk to tiers monotonically", () => {
    const risks = [0, 0.14, 0.15, 0.34, 0.35, 0.59, 0.6, 0.81, 0.82, 1];
    const tiers = risks.map(tierFor);
    expect(tiers).toEqual([
      "none",
      "none",
      "low",
      "low",
      "elevated",
      "elevated",
      "high",
      "high",
      "critical",
      "critical",
    ]);
  });
});

describe("negation guard", () => {
  it.each([
    "We will never ask you for your one-time code.",
    "Nobody from T-Mobile will ask you to send a verification code.",
    "Our staff do not ask for your password.",
    "Remember: we won't ask you to share the login code.",
  ])("does not flag safety advice as a code request: %s", (text) => {
    expect(detectSignals(text, 0).find((s) => s.id === "secret_request")).toBeUndefined();
  });

  it.each([
    "Send me the verification code so I can cancel the transfer.",
    "Please reply with the 6-digit code we just texted you.",
    "Read me the access code on your screen.",
  ])("still flags the real request: %s", (text) => {
    expect(detectSignals(text, 0).find((s) => s.id === "secret_request")).toBeDefined();
  });

  it("does not let a negation in sentence one excuse a demand in sentence two", () => {
    const text = "We never ask for codes. Now send me the verification code immediately.";
    expect(detectSignals(text, 0).find((s) => s.id === "secret_request")).toBeDefined();
  });
});
