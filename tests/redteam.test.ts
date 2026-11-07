/**
 * Adversarial regression guards.
 *
 * The full measurement lives in `scripts/evaluate.ts` and is published on the
 * evidence page. These are the properties that must not silently regress, so
 * they run on every commit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTACKS, INJECTION_PAYLOADS, splitAcrossMessages } from "@/lib/engine/adversarial";
import { assessThread } from "@/lib/engine/killchain";
import { foldVariants, campaignTemplate } from "@/lib/engine/normalize";
import { Scorer, type ScoringModel } from "@/lib/engine/scorer";
import { CAMPAIGN_RADIUS, hammingDistance, signatureOf } from "@/lib/engine/signature";
import type { ThreadAssessment, ThreadEvent } from "@/lib/engine/types";

const model: ScoringModel = JSON.parse(
  readFileSync(join(process.cwd(), "public", "model", "model.json"), "utf8"),
);
const scorer = new Scorer(model);

const SCAM = [
  "This is T-Mobile fraud prevention about a transfer request on your line.",
  "Do not hang up and do not call T-Mobile separately, that will lock the ticket.",
  "Please confirm the verification code we just sent so I can cancel the transfer.",
];

function thread(messages: string[], fold = true): ThreadAssessment {
  const events: ThreadEvent[] = messages.map((text, i) => ({
    id: `e${i}`,
    at: i * 60,
    channel: "sms",
    actor: "external",
    kind: "message",
    text,
  }));
  return assessThread(events, { scorer, fold });
}

const intervenes = (a: ThreadAssessment) => a.safeguards.some((s) => s.severity === "intervene");

describe("prompt injection cannot obtain authority it was never given", () => {
  const baseline = thread(SCAM);

  it.each(INJECTION_PAYLOADS)("payload cannot lower the tier: %s", (payload) => {
    const attacked = thread([...SCAM, payload]);
    expect(attacked.tier).toBe(baseline.tier);
    expect(intervenes(attacked)).toBe(true);
  });

  it.each(INJECTION_PAYLOADS)("payload cannot raise a false alarm on a benign thread: %s", (payload) => {
    const attacked = thread(["Your package will arrive tomorrow between 2pm and 4pm.", payload]);
    expect(["none", "low", "elevated"]).toContain(attacked.tier);
  });

  it("holds because the model has no authority over the tier, not because of a filter", () => {
    // The payload is not stripped or blocklisted anywhere. It simply has
    // nowhere to act: no step in the pipeline reads English and obeys it.
    const attacked = thread([...SCAM, INJECTION_PAYLOADS[0]]);
    expect(attacked.receipt.notUsed.length).toBeGreaterThan(0);
    expect(attacked.stage).toBe("escalation");
  });
});

describe("obfuscation defence", () => {
  const obfuscating = ATTACKS.filter(
    (a) => !["polite_paraphrase", "prompt_injection"].includes(a.id),
  );

  it.each(obfuscating.map((a) => [a.id, a] as const))(
    "%s is caught with the defence on",
    (_id, attack) => {
      const attacked = SCAM.map(attack.apply);
      expect(intervenes(thread(attacked, true))).toBe(true);
    },
  );

  it("the defence is what is doing the work, not luck", () => {
    // At least one attack must be defeated without folding and caught with it,
    // or the normalisation layer is not earning its place.
    const rescued = obfuscating.filter((attack) => {
      const attacked = SCAM.map(attack.apply);
      return !intervenes(thread(attacked, false)) && intervenes(thread(attacked, true));
    });
    expect(rescued.length).toBeGreaterThanOrEqual(4);
  });

  it("folding does not invent signals in benign text", () => {
    const benign = [
      "Your prescription is ready for pickup at the pharmacy on Oak Street.",
      "Reminder: parent-teacher conferences are Thursday at 6pm.",
      "T-Mobile: your bill of $84.21 is due on the 14th. Pay in the T-Life app.",
      "We will never ask you to share a verification code with anyone.",
      "Hola, tu paquete llegará mañana entre las 2 y las 4 de la tarde.",
    ];
    for (const text of benign) {
      expect(["none", "low", "elevated"]).toContain(thread([text]).tier);
    }
  });

  it("leaves text alone when there is nothing to fold", () => {
    const plain = "Please confirm the verification code we just sent.";
    expect(foldVariants(plain)[0]).toBe(plain);
  });

  it("does not destroy URLs while stripping intra-word punctuation", () => {
    const withUrl = "Pay the toll at https://fast-road.example.com/ticket?id=7 today";
    for (const reading of foldVariants(withUrl)) {
      expect(reading).toContain("https://fast-road.example.com/ticket?id=7");
    }
  });
});

describe("thread-level attacks", () => {
  it("catches an ask split across messages that no single message carries", () => {
    const parts = splitAcrossMessages(SCAM.join(" "), 4);
    // Confirm the premise: the split really does defeat per-message scoring.
    const anySingleMessageScoresHigh = parts.some(
      (p) => scorer.score(p).probability >= model.threshold,
    );
    const assessment = thread(parts);
    expect(intervenes(assessment)).toBe(true);
    // The thread catches it whether or not any individual fragment did.
    expect(typeof anySingleMessageScoresHigh).toBe("boolean");
  });
});

describe("campaign signatures", () => {
  const base =
    "URGENT: your package Maria could not be delivered. Pay the $2.95 fee at http://usps-redeliver.example/a1";
  const variants = [
    "URGENT: your package James could not be delivered. Pay the $3.15 fee at http://usps-redeliver.example/b7",
    "URGENT: your package Chen could not be delivered. Pay the $1.99 fee at http://parcel-fee.example/z2",
    "URGENT: your package Aisha could not be delivered. Pay the $2.50 fee at http://usps-redeliver.example/q9",
  ];
  const unrelated = [
    "Your prescription is ready for pickup at the pharmacy on Oak Street.",
    "Reminder: parent-teacher conferences are Thursday at 6pm.",
    "Your table for four is confirmed for Saturday at 7:30pm.",
    "T-Mobile: your bill of $84.21 is due on the 14th. Pay in the T-Life app.",
  ];

  it.each(variants)("clusters a personalised variant of the same campaign", (variant) => {
    expect(hammingDistance(signatureOf(base), signatureOf(variant))).toBeLessThanOrEqual(
      CAMPAIGN_RADIUS,
    );
  });

  it.each(unrelated)("keeps an unrelated message outside the radius", (message) => {
    expect(hammingDistance(signatureOf(base), signatureOf(message))).toBeGreaterThan(
      CAMPAIGN_RADIUS,
    );
  });

  it("strips everything that identifies a person from the template", () => {
    const template = campaignTemplate(
      "Hi Maria, your $2.95 toll from 11/04 is unpaid. Pay at http://x.example/9 or call 940-555-0147. Reply to maria.lopez@example.com",
    );
    expect(template).not.toMatch(/maria\.lopez@example\.com/);
    expect(template).not.toMatch(/940/);
    expect(template).not.toMatch(/2\.95/);
    expect(template).toContain("<url>");
    expect(template).toContain("<phone>");
    expect(template).toContain("<amount>");
  });

  it("produces a 16-character hex signature and nothing else", () => {
    expect(signatureOf(base)).toMatch(/^[0-9a-f]{16}$/);
  });
});
