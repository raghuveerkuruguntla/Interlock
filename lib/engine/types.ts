/**
 * Shared vocabulary for the Interlock engine.
 *
 * The central modelling decision lives here: a scam is a *sequence*, so the
 * unit of detection is a thread, not a message. Every type below is shaped
 * around that.
 */

/**
 * The attacker's arc. A thread enters at `contact` and advances on evidence.
 *
 * Ordering is meaningful: stages can be skipped forward but never un-entered,
 * so the machine compares by index. A spoofed-bank SMS carrying a live
 * credential-harvesting link jumps straight from `contact` to `escalation`.
 */
export const STAGES = [
  "contact",
  "hook",
  "isolation",
  "escalation",
  "extraction",
  "recovery",
] as const;

export type Stage = (typeof STAGES)[number];

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** Accrued thread risk, bucketed. Drives how much friction a safeguard may add. */
export const TIERS = ["none", "low", "elevated", "high", "critical"] as const;
export type Tier = (typeof TIERS)[number];

export type Channel =
  | "sms"
  | "rcs"
  | "call"
  | "whatsapp"
  | "telegram"
  | "email"
  | "customer";

export type Actor = "external" | "customer" | "system";

/** An irreversible account change — the things only a carrier can gate. */
export const ACCOUNT_ACTIONS = [
  "port_out",
  "sim_swap",
  "autopay_change",
  "add_authorized_user",
  "plan_change",
  "address_change",
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

export interface ThreadEvent {
  id: string;
  /** Seconds since the thread began. The arc is a timeline, so this matters. */
  at: number;
  channel: Channel;
  actor: Actor;
  kind:
    | "message"
    | "call_start"
    | "call_end"
    | "otp_received"
    | "account_action_requested"
    | "customer_report"
    | "out_of_band_verified";
  /**
   * Message content. Scored on device and never serialised across the privacy
   * boundary. `undefined` for call metadata, which carries no transcript —
   * Interlock does not fabricate one.
   */
  text?: string;
  /** Present on `account_action_requested`. */
  accountAction?: AccountAction;
  /** Present on `otp_received`: who the code claims to be from. */
  otpIssuer?: string;
  /** Present on `customer_report`: what the customer believes they exposed. */
  exposure?: ExposureKind;
  /** Free-form label shown in the timeline, e.g. "Unknown number +1 940…". */
  label?: string;
}

/**
 * Exposure is recorded by *type* only. Never the value, never a full card
 * number, never a raw passcode. A customer saying they shared something is a
 * claim, not proof, and the product labels it that way throughout.
 */
export const EXPOSURE_KINDS = [
  "carrier_otp",
  "credential",
  "payment_card",
  "bank_transfer",
  "device_access",
  "link_opened",
  "identity_document",
  "phone_number",
  "other",
] as const;
export type ExposureKind = (typeof EXPOSURE_KINDS)[number];

export type Severity = "info" | "caution" | "intervene";

export type SignalId =
  // Hook
  | "brand_claim"
  | "unverified_link"
  | "time_pressure"
  | "authority_threat"
  | "payment_link"
  | "prize_or_refund"
  // Isolation
  | "secrecy_request"
  | "discourage_verification"
  | "channel_migration"
  | "callback_substitution"
  | "relationship_grooming"
  // Escalation
  | "secret_request"
  | "payment_data_request"
  | "remote_access_request"
  | "investment_enticement"
  | "otp_during_call"
  // Extraction
  | "money_movement_request"
  | "qr_or_voucher_payment"
  | "account_action_in_flight";

export interface Signal {
  id: SignalId;
  stage: Stage;
  severity: Severity;
  /** How much this evidence adds to accrued thread risk, once, on first sight. */
  weight: number;
  /** The exact substring that triggered it. Shown in the decision receipt. */
  evidence: string;
  /** Index of the event this came from. */
  eventIndex: number;
}

/** A safeguard the product may offer, tied to the stage that unlocked it. */
export type SafeguardId =
  | "campaign_match"
  | "grounded_warning"
  | "abstain_question"
  | "out_of_band_verification"
  | "channel_migration_flag"
  | "otp_guard"
  | "remote_access_alert"
  | "circuit_breaker"
  | "recovery_mode";

export interface Safeguard {
  id: SafeguardId;
  stage: Stage;
  /** Plain-language headline. Written for a fifth-grade reading level. */
  title: string;
  /** What the safeguard does, in the user's words, not ours. */
  body: string;
  /** The reasons, grounded in observed facts. Never model-invented. */
  reasons: string[];
  /** The action the user can take. */
  action?: { label: string; kind: SafeguardActionKind };
  severity: Severity;
}

export type SafeguardActionKind =
  | "reveal_code"
  | "dial_verified_number"
  | "hold_action"
  | "allow_action"
  | "mark_verified"
  | "open_recovery"
  | "dismiss";

export interface ThreadAssessment {
  stage: Stage;
  tier: Tier;
  /** Accrued thread risk in [0, 1]. Sticky, slow-decaying, never silently rewound. */
  risk: number;
  /** Calibrated model probability for the text observed so far, or null if no text. */
  modelProbability: number | null;
  /**
   * True when the model lands in the band where the product asks a question
   * instead of asserting a verdict.
   */
  abstaining: boolean;
  signals: Signal[];
  safeguards: Safeguard[];
  /** Set once the customer verifies the sender out of band. Lifts interlocks. */
  verified: boolean;
  /** Set when the customer has reported a possible exposure. */
  recoveryActive: boolean;
  /** Everything the decision was based on, for the user-visible receipt. */
  receipt: DecisionReceipt;
}

export interface DecisionReceipt {
  at: string;
  stage: Stage;
  tier: Tier;
  risk: number;
  observed: string[];
  notUsed: string[];
  leftTheDevice: string[];
  modelProbability: number | null;
  topFeatures: { term: string; contribution: number }[];
  appeal: string;
}
