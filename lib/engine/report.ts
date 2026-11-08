/**
 * The incident report: what happened, in plain language.
 *
 * A report is the end of the experience, not a separate page. It is built
 * entirely from the assessment the customer already saw, so it cannot claim
 * anything the warning did not — and it says how sure we are in words, because
 * "92% risk" means nothing to the person who just hung up on a scammer.
 *
 * Pure and deterministic, so it is tested like the rest of the engine.
 */

import type { CustomerAction, IncidentReport, IncidentSignal } from "@/lib/account/types";
import { copyFor, type Locale } from "./copy";
import type { ExposureKind, SignalId, ThreadAssessment } from "./types";

/** Each signal as a past-tense clause about the other party. */
const DID: Record<SignalId, string> = {
  brand_claim: "said they were from a company or agency you know",
  unverified_link: "sent a link we could not check",
  time_pressure: "pushed you to act fast",
  authority_threat: "threatened arrest, fines or legal trouble",
  payment_link: "asked you to pay through a link",
  prize_or_refund: "promised money back or a prize",
  secrecy_request: "asked you to keep it secret",
  discourage_verification: "told you not to check with anyone else",
  channel_migration: "tried to move you to another app",
  callback_substitution: "gave you their own number to call back",
  relationship_grooming: "built a close personal bond quickly",
  secret_request: "asked for a code, PIN or password",
  payment_data_request: "asked for card or bank details",
  remote_access_request: "asked to control your device",
  investment_enticement: "offered an investment with promised returns",
  otp_during_call: "were on the line when a security code arrived",
  money_movement_request: "asked you to send money or buy gift cards",
  qr_or_voucher_payment: "asked you to pay with a QR code or voucher",
  account_action_in_flight: "tried to change your account",
};

function family(seen: Set<SignalId>): { title: string; key: string } {
  const has = (id: SignalId) => seen.has(id);
  if ((has("secret_request") || has("otp_during_call")) && has("brand_claim"))
    return { title: "Suspected company impersonation — code request", key: "impersonation" };
  if (has("account_action_in_flight"))
    return { title: "Suspected account takeover attempt", key: "takeover" };
  if (has("remote_access_request")) return { title: "Suspected tech-support scam", key: "remote" };
  if (has("authority_threat")) return { title: "Suspected government or police impersonation", key: "authority" };
  if (has("investment_enticement") || has("relationship_grooming"))
    return { title: "Suspected romance or investment scam", key: "romance" };
  if (has("money_movement_request") || has("qr_or_voucher_payment"))
    return { title: "Suspected payment scam", key: "payment" };
  if (has("payment_link") || has("payment_data_request"))
    return { title: "Suspected payment phishing", key: "phishing" };
  if (has("secret_request")) return { title: "Suspected code-theft attempt", key: "code" };
  return { title: "Suspected scam attempt", key: "generic" };
}

function joinClauses(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const RESPONSE: Record<CustomerAction, string> = {
  ended_call: "You ended the conversation without sharing anything.",
  verified_independently:
    "You checked through a channel you already trust before doing anything they asked.",
  continued: "You chose to continue the conversation after the warning.",
  reported_exposure: "You told us you may have shared something, so we switched to recovery steps.",
  none: "No action was recorded.",
};

const NEXT_STEPS: Record<string, string[]> = {
  impersonation: [
    "Do not read out or forward any code you receive, even to someone who says they are from your carrier or bank.",
    "Open the company's official app yourself, or call the number printed on your bill or card.",
    "Ask your carrier to add a port-out / SIM-change PIN to your account.",
  ],
  takeover: [
    "Call your carrier from a number you already trust and ask whether any port-out or SIM change is pending.",
    "Ask for a port-out / SIM-change lock on your line.",
    "Change the password on your email, since that is what account resets go to.",
  ],
  remote: [
    "Do not install any app a caller asks you to install.",
    "If you already did, turn off Wi-Fi and mobile data, then uninstall it.",
    "From a different device, change your banking and email passwords.",
  ],
  authority: [
    "Government agencies and police do not demand payment by phone, gift card or crypto.",
    "Look up the agency's number yourself and call them directly if you are worried.",
  ],
  romance: [
    "Do not send money or crypto to someone you have only met online.",
    "Talk it over with someone you trust before you do anything else.",
  ],
  payment: [
    "Do not send money, gift cards or crypto to someone who contacted you first.",
    "If you already paid, call your bank or card issuer now using the number on your card.",
  ],
  phishing: [
    "Do not open the link. Go to the company's site or app by typing it yourself.",
    "If you entered card details, call your card issuer using the number on the card.",
  ],
  code: [
    "Never share a one-time code with anyone. Real companies will not ask for it.",
    "If you shared one, change that account's password now.",
  ],
  generic: [
    "Do not act on anything this person asked for until you have checked through a channel you already trust.",
    "If something feels off, it is fine to hang up. A real company will still be there.",
  ],
};

export interface BuildReportOptions {
  source: IncidentReport["source"];
  customerAction: CustomerAction;
  exposure?: ExposureKind | null;
  locale?: Locale;
  campaignSignature?: string | null;
  reportedToNetwork?: boolean;
}

export function confidenceWords(assessment: ThreadAssessment): string {
  if (assessment.abstaining)
    return "We are not sure. The conversation could go either way, so treat this as a question, not a verdict.";
  switch (assessment.tier) {
    case "critical":
      return "High confidence. Several separate warning signs appeared, including a direct request.";
    case "high":
      return "Fairly confident. More than one warning sign appeared, but we can still be wrong.";
    case "elevated":
      return "Some concern. A few warning signs appeared; none of them is proof on its own.";
    case "low":
      return "Low concern. One mild warning sign appeared.";
    default:
      return "No warning signs were found. That does not prove the caller was genuine.";
  }
}

export function buildIncidentReport(
  assessment: ThreadAssessment,
  options: BuildReportOptions,
): Omit<IncidentReport, "id" | "createdAt"> {
  const c = copyFor(options.locale ?? "en");
  const seen = new Set(assessment.signals.map((s) => s.id));
  const fam = assessment.signals.length
    ? family(seen)
    : { title: "Conversation reviewed — no warning signs", key: "generic" };

  const who = options.source === "live_message" ? "The sender" : options.source === "live_call" ? "The caller" : "The other party";
  const clauses = [...assessment.signals]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((s) => DID[s.id]);
  const summary = clauses.length
    ? `${who} ${joinClauses(clauses)}.`
    : `${who} did not say anything that matched a known scam pattern.`;

  const signals: IncidentSignal[] = assessment.signals.map((s) => ({
    id: s.id,
    label: c.signalLabels[s.id],
    evidence: s.evidence.length > 120 ? `${s.evidence.slice(0, 119)}…` : s.evidence,
  }));

  const exposure = options.exposure ?? null;
  const nextSteps = exposure ? c.recoverySteps[exposure] : NEXT_STEPS[fam.key];

  const recommendedAction = exposure
    ? "Lock things down first: work through the recovery steps below, starting with the first one."
    : assessment.signals.length
      ? "Contact the company yourself through its official app, or a number you already trust — not one the caller gave you."
      : "Nothing to do. If anything about the conversation still worries you, check with the company directly.";

  return {
    source: options.source,
    title: fam.title,
    summary,
    stage: assessment.stage,
    tier: assessment.tier,
    risk: Number(assessment.risk.toFixed(3)),
    confidence: confidenceWords(assessment),
    signals,
    customerAction: options.customerAction,
    customerResponse: RESPONSE[options.customerAction],
    recommendedAction,
    nextSteps,
    exposure,
    campaignSignature: options.campaignSignature ?? null,
    reportedToNetwork: options.reportedToNetwork ?? false,
  };
}

/**
 * The follow-up window after an incident. Entirely simulated in this
 * prototype — Interlock has no access to a real carrier account — and every
 * entry says so.
 */
export const SIMULATED_MONITORING = [
  { at: "Now", text: "Incident report created. Nothing on your real account has changed." },
  { at: "First hour", text: "Watch for port-out, SIM-change or new-device requests on the line." },
  { at: "24 hours", text: "Check-in: did anyone call back, or did any new codes arrive?" },
  { at: "48 hours", text: "Second check-in. Look for unfamiliar charges or password-reset emails." },
  { at: "72 hours", text: "Monitoring window closes. You can open a new one at any time." },
] as const;

/** A link-free alert email, for customers who do not use the carrier app. */
export function alertEmailText(report: Pick<IncidentReport, "title" | "summary" | "recommendedAction">): string {
  return [
    "Subject: Interlock: we stopped a suspected scam",
    "",
    "Hello,",
    "",
    `${report.title}.`,
    report.summary,
    "",
    `What to do next: ${report.recommendedAction}`,
    "",
    "This email contains no links and will never ask you for a code, password or payment.",
    "If you want to check, open your carrier's app yourself or call the number on your bill.",
  ].join("\n");
}
