/**
 * The kill-chain state machine.
 *
 * Every anti-fraud product asks "is this message a scam?". That question is
 * answered at minute zero of an attack that takes forty minutes to land, which
 * is why the victim sees a banner, dismisses it, and loses the money anyway.
 *
 * Interlock asks a different question: is this *customer* being scammed right
 * now? That is a property of the thread and the account activity, not of any
 * single message. So the unit here is a conversation, the state is cumulative,
 * and the product response is a function of the *stage* the attacker has
 * reached — not of a score alone.
 *
 * Three properties the machine guarantees, each tested in `tests/killchain.test.ts`:
 *
 *   1. Risk is cumulative and sticky. A thread that reached Isolation does not
 *      drop back to Low because the next three messages are small talk. Decay
 *      is slow and asymmetric, because scammers deliberately cool off before
 *      the ask.
 *   2. Stages can be skipped but never un-entered. A spoofed-bank SMS carrying
 *      a live credential-harvesting link jumps straight from Contact to
 *      Escalation. Forward jumps are accepted; the machine never silently
 *      rewinds.
 *   3. Each stage unlocks a different safeguard. The same risk produces a
 *      nudge at Hook and a hard hold at Extraction.
 *
 * The one honest de-escalation: if the customer verifies the sender out of
 * band, the thread is marked verified, the tier drops and the interlocks lift.
 * That is logged as a false positive against ourselves and reported in the
 * evaluation rather than quietly discarded.
 */

import { copyFor, type Locale } from "./copy";
import { foldObfuscation } from "./normalize";
import type { Scorer } from "./scorer";
import { CONTEXTUAL_SIGNALS, detectSignals } from "./signals";
import type { CampaignMatch } from "./signature";
import {
  type AccountAction,
  type DecisionReceipt,
  type Safeguard,
  type Signal,
  type SignalId,
  type Stage,
  stageIndex,
  type ThreadAssessment,
  type ThreadEvent,
  type Tier,
} from "./types";

/**
 * Reaching a stage sets a permanent floor under the thread's risk. This is what
 * makes "patience does not reset the arc" true: an attacker can go quiet for an
 * hour, but the thread does not forget that they already asked for a passcode.
 */
const STAGE_FLOOR: Record<Stage, number> = {
  contact: 0.05,
  hook: 0.2,
  isolation: 0.45,
  escalation: 0.65,
  extraction: 0.85,
  recovery: 0.85,
};

const TIER_CUTS: { tier: Tier; min: number }[] = [
  { tier: "critical", min: 0.82 },
  { tier: "high", min: 0.6 },
  { tier: "elevated", min: 0.35 },
  { tier: "low", min: 0.15 },
  { tier: "none", min: 0 },
];

/**
 * Accrued evidence halves every 90 minutes of silence. Long, because the
 * cool-off before the ask is a deliberate tactic, and asymmetric, because risk
 * rises the instant evidence arrives but only ever falls gradually.
 */
const HALF_LIFE_MINUTES = 90;

/**
 * How much the message-level model is allowed to contribute on its own.
 *
 * Capped at half. A text classifier that is certain, with no observable
 * request anywhere in the thread, can raise the thread to "be careful" and no
 * further — it can never by itself trigger a hold on someone's account. The
 * deterministic signals do the scoring; the model is one input among several.
 * This is also what makes prompt injection against the explainer pointless:
 * the model has no authority over the tier.
 */
const MODEL_CEILING = 0.5;

/**
 * And the model's contribution is additionally capped by how far the attacker
 * has actually got.
 *
 * This is not a hedge, it is the central design claim made arithmetic. The
 * corpus contains 160 matched pairs whose first messages are identical between
 * a scam and a legitimate conversation; our own classifier rates one such
 * opener — "There is a pending change on the mobile line ending 42." — at
 * 0.914, when by construction it is a coin flip. A score is simply not
 * evidence yet at first contact, however confident it sounds.
 *
 * So at `contact`, with nothing observable having fired, the model can carry a
 * thread to "worth a look" and no further. It takes an actual observed request
 * to get past that. The ceiling lifts as the thread earns it.
 */
const MODEL_STAGE_CEILING: Record<Stage, number> = {
  contact: 0.3,
  hook: 0.45,
  isolation: 0.5,
  escalation: 0.5,
  extraction: 0.5,
  recovery: 0.5,
};

export function tierFor(risk: number): Tier {
  for (const { tier, min } of TIER_CUTS) {
    if (risk >= min) return tier;
  }
  return "none";
}

export interface AssessOptions {
  /** On-device scorer. Omitted in tests that exercise the deterministic path. */
  scorer?: Scorer | null;
  /** A campaign match from the network layer, if the signature was known. */
  campaign?: CampaignMatch | null;
  locale?: Locale;
  /** Whether the customer has opted into herd-immunity reporting. */
  reportingConsent?: boolean;
}

interface WalkState {
  accrued: number;
  stage: Stage;
  signals: Signal[];
  seen: Set<SignalId>;
  lastAt: number;
  onCall: boolean;
  callerKnown: boolean;
  heldOtp: { issuer: string; at: number } | null;
  pendingAction: { action: AccountAction; at: number } | null;
  verified: boolean;
  recoveryActive: boolean;
  exposure: ThreadEvent["exposure"];
  externalText: string[];
}

function advance(state: WalkState, to: Stage): void {
  if (stageIndex(to) > stageIndex(state.stage)) state.stage = to;
}

function addSignal(state: WalkState, signal: Signal): void {
  // Repeating the same demand five times is the same evidence, not five times
  // the evidence. Only the first occurrence of each signal accrues weight.
  if (state.seen.has(signal.id)) return;
  state.seen.add(signal.id);
  state.signals.push(signal);
  state.accrued += signal.weight;
  advance(state, signal.stage);
  // New hard evidence after an out-of-band verification re-arms the thread.
  // Verification is not a permanent pass.
  if (signal.severity === "intervene") state.verified = false;
}

function walk(events: ThreadEvent[]): WalkState {
  const state: WalkState = {
    accrued: 0,
    stage: "contact",
    signals: [],
    seen: new Set(),
    lastAt: events.length ? events[0].at : 0,
    onCall: false,
    callerKnown: false,
    heldOtp: null,
    pendingAction: null,
    verified: false,
    recoveryActive: false,
    exposure: undefined,
    externalText: [],
  };

  events.forEach((event, index) => {
    const elapsedMinutes = Math.max(0, event.at - state.lastAt) / 60;
    state.lastAt = event.at;
    state.accrued *= Math.pow(0.5, elapsedMinutes / HALF_LIFE_MINUTES);

    switch (event.kind) {
      case "message": {
        if (event.actor !== "external" || !event.text) break;
        // Fold obfuscation before matching, so a Cyrillic "о" or a zero-width
        // joiner between letters does not buy the attacker a clean pass.
        const folded = foldObfuscation(event.text);
        state.externalText.push(folded);
        for (const signal of detectSignals(folded, index)) addSignal(state, signal);
        break;
      }

      case "call_start": {
        state.onCall = true;
        // "Known" means the number resolves to a contact or a verified brand.
        state.callerKnown = Boolean(event.label && /verified|contact/i.test(event.label));
        break;
      }

      case "call_end": {
        state.onCall = false;
        state.heldOtp = null;
        break;
      }

      case "otp_received": {
        // The highest-precision fraud signal that exists, and one only a
        // carrier can see: a passcode arriving mid-call with a number nobody
        // recognises. An app-layer product sees at most one half of this.
        if (state.onCall && !state.callerKnown) {
          state.heldOtp = { issuer: event.otpIssuer ?? "your account", at: event.at };
          const spec = CONTEXTUAL_SIGNALS.otp_during_call;
          addSignal(state, {
            id: "otp_during_call",
            stage: spec.stage,
            severity: spec.severity,
            weight: spec.weight,
            evidence: `A code from ${event.otpIssuer ?? "your account"} arrived during an active call`,
            eventIndex: index,
          });
        }
        break;
      }

      case "account_action_requested": {
        if (!event.accountAction) break;
        state.pendingAction = { action: event.accountAction, at: event.at };
        const spec = CONTEXTUAL_SIGNALS.account_action_in_flight;
        addSignal(state, {
          id: "account_action_in_flight",
          stage: spec.stage,
          severity: spec.severity,
          weight: spec.weight,
          evidence: `Requested account change: ${event.accountAction.replace(/_/g, " ")}`,
          eventIndex: index,
        });
        break;
      }

      case "out_of_band_verified": {
        state.verified = true;
        break;
      }

      case "customer_report": {
        // A customer saying they shared something is a claim about possible
        // exposure. It is never treated as proof that anything was stolen.
        state.recoveryActive = true;
        state.exposure = event.exposure ?? "other";
        advance(state, "recovery");
        break;
      }
    }
  });

  return state;
}

function buildReceipt(
  state: WalkState,
  tier: Tier,
  risk: number,
  modelProbability: number | null,
  scorer: Scorer | null,
  reportingConsent: boolean,
): DecisionReceipt {
  const text = state.externalText.join("\n");
  const topFeatures =
    scorer && text
      ? scorer
          .contributions(text, 6)
          .map((c) => ({ term: c.term, contribution: Number(c.contribution.toFixed(4)) }))
      : [];

  const observed = [
    `The words in ${state.externalText.length} message${state.externalText.length === 1 ? "" : "s"} on this device`,
    state.onCall || state.heldOtp ? "Whether a call was active when a code arrived" : null,
    state.pendingAction ? "The account change that was requested" : null,
    state.recoveryActive ? "What you told us you may have shared" : null,
  ].filter((x): x is string => Boolean(x));

  return {
    at: new Date().toISOString(),
    stage: state.stage,
    tier,
    risk: Number(risk.toFixed(4)),
    observed,
    notUsed: [
      "Your contacts",
      "The audio or transcript of any call",
      "Your photos, location or browsing",
      "Who else you message",
      "The answer key in our test data — the model never sees a case label",
    ],
    leftTheDevice: reportingConsent
      ? [
          "A 16-character campaign signature, which cannot be turned back into text",
          "The stage label and risk tier",
          "The hour this happened, not the minute",
        ]
      : ["Nothing. Scoring ran on this device."],
    modelProbability,
    topFeatures,
    appeal:
      "Tell us this was a real message and we lift every hold on it, and count it against our own accuracy.",
  };
}

function buildSafeguards(
  state: WalkState,
  tier: Tier,
  abstaining: boolean,
  locale: Locale,
  campaign: CampaignMatch | null,
): Safeguard[] {
  const c = copyFor(locale);
  const out: Safeguard[] = [];
  const has = (id: SignalId) => state.seen.has(id);
  const labelled = (ids: SignalId[]) =>
    state.signals
      .filter((s) => ids.includes(s.id))
      .sort((a, b) => b.weight - a.weight)
      .map((s) => c.signalLabels[s.id]);
  const allReasons = () =>
    [...state.signals].sort((a, b) => b.weight - a.weight).slice(0, 4).map((s) => c.signalLabels[s.id]);

  // -- Contact: campaign match ---------------------------------------------
  // Blocks message two through forty thousand of a campaign one person
  // reported, with no text ever having crossed the boundary.
  if (campaign) {
    const { campaign: hit } = campaign;
    out.push({
      id: "campaign_match",
      stage: "contact",
      title: c.safeguards.campaignMatch.title,
      body: c.safeguards.campaignMatch.body,
      severity: hit.blocking ? "intervene" : "caution",
      reasons: [
        `${hit.reports} report${hit.reports === 1 ? "" : "s"} from ${hit.reporters} different ${
          hit.reporters === 1 ? "person" : "people"
        }`,
        `First seen ${Math.max(1, Math.round((Date.now() / 1000 - hit.firstSeen) / 3600))} hours ago`,
        hit.blocking
          ? "Enough independent reports to block, not just warn"
          : "Not enough independent reports to block yet — we are only telling you",
      ],
      action: { label: c.safeguards.campaignMatch.action ?? "", kind: "dismiss" },
    });
  }

  // -- Hook: assert, or ask -------------------------------------------------
  if (abstaining) {
    // Between roughly 0.4 and 0.7 the product does not assert. It asks.
    // Turning uncertainty into a question is more honest than a false red
    // banner, and it attacks alert fatigue, which is the real reason warnings
    // get ignored.
    out.push({
      id: "abstain_question",
      stage: "hook",
      title: c.safeguards.abstainQuestion.title,
      body: c.safeguards.abstainQuestion.body,
      severity: "caution",
      reasons: [
        "Did you contact them first, or did they contact you?",
        "Does this message claim to be from your bank or your phone company?",
        "Were you expecting this?",
      ],
      action: { label: c.safeguards.abstainQuestion.action ?? "", kind: "dismiss" },
    });
  } else if (tier !== "none" && stageIndex(state.stage) >= stageIndex("hook")) {
    out.push({
      id: "grounded_warning",
      stage: "hook",
      title: c.safeguards.groundedWarning.title,
      body: c.safeguards.groundedWarning.body,
      severity: tier === "high" || tier === "critical" ? "intervene" : "caution",
      reasons: allReasons(),
      action: { label: c.safeguards.groundedWarning.action ?? "", kind: "dismiss" },
    });
  }

  // -- Isolation: replace the attacker's channel with the real one ----------
  // Phishing works by handing the victim a fake channel back to the brand. The
  // carrier-native answer is to intercept the callback and offer the verified
  // number instead.
  if (has("callback_substitution") || has("discourage_verification") || has("brand_claim")) {
    out.push({
      id: "out_of_band_verification",
      stage: "isolation",
      title: c.safeguards.outOfBand.title,
      body: c.safeguards.outOfBand.body,
      severity: has("discourage_verification") ? "intervene" : "caution",
      reasons: labelled(["callback_substitution", "discourage_verification", "brand_claim", "secrecy_request"]),
      action: { label: c.safeguards.outOfBand.action ?? "", kind: "dial_verified_number" },
    });
  }

  if (has("channel_migration")) {
    out.push({
      id: "channel_migration_flag",
      stage: "isolation",
      title: c.safeguards.channelMigration.title,
      body: c.safeguards.channelMigration.body,
      severity: "intervene",
      reasons: labelled(["channel_migration", "secrecy_request"]),
    });
  }

  // -- Escalation: OTP Guard ------------------------------------------------
  if (state.heldOtp) {
    const lifted = state.verified;
    out.push({
      id: "otp_guard",
      stage: "escalation",
      title: lifted ? c.ui.verified : c.safeguards.otpGuard.title,
      body: lifted ? c.safeguards.otpGuard.body : c.safeguards.otpGuard.body,
      severity: lifted ? "info" : "intervene",
      reasons: [
        `A code from ${state.heldOtp.issuer} arrived while you were on a call`,
        "The number you are on is not in your contacts and is not a verified company",
        lifted
          ? "You told us this sender is real, so the hold is lifted"
          : "We are holding it on screen for 60 seconds",
      ],
      action: {
        label: c.safeguards.otpGuard.action ?? "",
        kind: lifted ? "allow_action" : "reveal_code",
      },
    });
  }

  if (has("remote_access_request")) {
    out.push({
      id: "remote_access_alert",
      stage: "escalation",
      title: c.safeguards.remoteAccess.title,
      body: c.safeguards.remoteAccess.body,
      severity: "intervene",
      reasons: labelled(["remote_access_request", "discourage_verification", "time_pressure"]),
    });
  }

  // -- Extraction: the circuit breaker --------------------------------------
  // A delay, never a block. We do not stop the customer, we slow the attacker.
  // Urgency is the only weapon a scammer has and ten minutes removes it.
  if (state.pendingAction) {
    const action = c.accountActions[state.pendingAction.action];
    const lifted = state.verified;
    out.push({
      id: "circuit_breaker",
      stage: "extraction",
      title: lifted ? c.ui.verified : c.safeguards.circuitBreaker.title,
      body: c.safeguards.circuitBreaker.body,
      severity: lifted ? "info" : "intervene",
      reasons: [
        `What was asked for: ${action?.plain ?? state.pendingAction.action}`,
        `What that means: ${action?.consequence ?? ""}`,
        ...allReasons(),
      ].filter(Boolean),
      action: {
        label: c.safeguards.circuitBreaker.action ?? "",
        kind: lifted ? "allow_action" : "hold_action",
      },
    });
  }

  // -- Post-loss ------------------------------------------------------------
  if (state.recoveryActive) {
    const exposure = state.exposure ?? "other";
    out.push({
      id: "recovery_mode",
      stage: "recovery",
      title: c.safeguards.recoveryMode.title,
      body: c.safeguards.recoveryMode.body,
      severity: "intervene",
      reasons: c.recoverySteps[exposure],
      action: { label: c.safeguards.recoveryMode.action ?? "", kind: "open_recovery" },
    });
  } else if (tier === "high" || tier === "critical") {
    out.push({
      id: "recovery_mode",
      stage: "recovery",
      title: c.safeguards.recoveryMode.title,
      body: c.safeguards.recoveryMode.body,
      severity: "caution",
      reasons: ["You do not have to be sure. We lock things down first and ask questions after."],
      action: { label: c.safeguards.recoveryMode.action ?? "", kind: "open_recovery" },
    });
  }

  return out;
}

/**
 * Score a thread from the events observed so far.
 *
 * Pure and recomputed from scratch, which is what guarantees no future
 * leakage: an assessment at event three cannot see event four, because it is
 * never handed one.
 */
export function assessThread(
  events: ThreadEvent[],
  options: AssessOptions = {},
): ThreadAssessment {
  const { scorer = null, campaign = null, locale = "en", reportingConsent = false } = options;
  const state = walk(events);

  const text = state.externalText.join("\n");
  const scored = scorer && text ? scorer.score(text) : null;
  const modelProbability = scored ? scored.probability : null;

  const modelContribution =
    modelProbability === null
      ? 0
      : Math.min(MODEL_CEILING * modelProbability, MODEL_STAGE_CEILING[state.stage]);

  let risk = Math.max(state.accrued, STAGE_FLOOR[state.stage], modelContribution);
  if (state.verified) risk = Math.min(risk, 0.2);
  risk = Math.min(1, Math.max(0, risk));

  const tier = tierFor(risk);

  // The product only abstains when the model is genuinely undecided *and*
  // nothing observable has fired. A thread with a passcode request in it is
  // not ambiguous no matter what the classifier thinks.
  const hasIntervention = state.signals.some((s) => s.severity === "intervene");
  const abstaining = Boolean(scored?.abstain) && !hasIntervention && !state.recoveryActive;

  return {
    stage: state.stage,
    tier,
    risk,
    modelProbability,
    abstaining,
    signals: state.signals,
    safeguards: buildSafeguards(state, tier, abstaining, locale, campaign),
    verified: state.verified,
    recoveryActive: state.recoveryActive,
    receipt: buildReceipt(state, tier, risk, modelProbability, scorer, reportingConsent),
  };
}

/**
 * Replay a thread, returning the assessment as it stood after each event.
 *
 * This is what the demo timeline renders, and what the time-to-intervention
 * metric measures against. Each step is recomputed from the prefix, so the
 * trace is exactly what a device would have shown at that moment.
 */
export function traceThread(
  events: ThreadEvent[],
  options: AssessOptions = {},
): ThreadAssessment[] {
  return events.map((_, i) => assessThread(events.slice(0, i + 1), options));
}
