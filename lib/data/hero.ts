/**
 * The scripted demo threads.
 *
 * Everything here is fiction, written for this project. No real customer, no
 * real message, no real account. The corpus threads in `public/data/corpus.json`
 * are the authored v3 scenarios and are only three or four events long, which
 * is enough to show the counterfactual pairs but not enough to walk a whole
 * kill chain. These carry the full arc: a call connecting, a passcode arriving
 * mid-call, a port-out request, and the recovery path afterwards.
 *
 * The first two are a matched pair in the same sense the corpus uses: the
 * opening message is byte-identical between the attack and the legitimate
 * notice. That is the single most useful thing to show a sceptical audience,
 * because it makes "the opener looked suspicious" visibly insufficient.
 */

import type { ThreadEvent } from "@/lib/engine/types";

export interface DemoThread {
  id: string;
  title: string;
  /** One line on what this thread is for. */
  summary: string;
  /** Hindsight only. Shown in the UI as an answer key, never given to the engine. */
  truth: "scam" | "legitimate" | "unknown";
  pairId?: string;
  /** The attacker's goal, for the narration. Never an input to detection. */
  goal?: string;
  events: ThreadEvent[];
}

const UNKNOWN_CALLER = "Unknown +1 940 555 0147";

/**
 * The port-out takeover. This is the five-minute demo.
 *
 * Beat by beat: a plausible notice arrives, the customer does the right thing
 * and replies NO, the attacker supplies a callback number, a call connects, the
 * attacker discourages independent verification, a real T-Mobile passcode
 * arrives mid-call, the attacker asks the customer to read it out, and the
 * port-out is driven through. Scam Shield blocks none of this: the number is
 * clean and the customer is the one who stayed on the line.
 */
export const PORT_OUT_SCAM: DemoThread = {
  id: "HERO-SCAM",
  title: "Line takeover",
  summary:
    "A plausible account notice turns into a call, a held passcode and an attempted port-out.",
  truth: "scam",
  pairId: "HERO-PAIR",
  goal: "Move the customer's phone number to an attacker-controlled SIM.",
  events: [
    {
      id: "h1",
      at: 0,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "T-MOBILE",
      text: "T-Mobile: a request to transfer the number ending 4417 to another carrier was received today. If this was not you, reply NO.",
    },
    {
      id: "h2",
      at: 48,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "NO",
    },
    {
      id: "h3",
      at: 95,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "T-MOBILE",
      text: "Thank you. Our fraud prevention team will call you from 940-555-0147 within 5 minutes to cancel the transfer. Please answer.",
    },
    {
      id: "h4",
      at: 310,
      channel: "call",
      actor: "external",
      kind: "call_start",
      label: UNKNOWN_CALLER,
    },
    {
      id: "h5",
      at: 365,
      channel: "customer",
      actor: "customer",
      kind: "customer_call_summary",
      label: "You told us about this call",
      text: "He says someone in another state is trying to take my number and he is stopping it right now.",
    },
    {
      id: "h6",
      at: 430,
      channel: "rcs",
      actor: "external",
      kind: "message",
      label: "+1 940 555 0147",
      text: "Please stay on the line and do not hang up. Do not call T-Mobile separately, that will just lock the ticket and delay the cancellation.",
    },
    {
      id: "h7",
      at: 488,
      channel: "sms",
      actor: "system",
      kind: "otp_received",
      otpIssuer: "T-Mobile",
      label: "Passcode arrived",
    },
    {
      id: "h8",
      at: 521,
      channel: "rcs",
      actor: "external",
      kind: "message",
      label: "+1 940 555 0147",
      text: "I have the cancellation screen open. Read me the 6 digits you just received so I can stop the transfer before it completes.",
    },
    {
      id: "h9",
      at: 604,
      channel: "customer",
      actor: "system",
      kind: "account_action_requested",
      accountAction: "port_out",
      label: "Account change requested",
    },
  ],
};

/**
 * The matched legitimate twin. Byte-identical opening message.
 *
 * A real carrier notice, followed by real carrier behaviour: it tells you what
 * it will never do, and points you at a channel you already trust. The product
 * must not treat this as an attack, and must not treat the shared opener as
 * evidence of anything.
 */
export const PORT_OUT_LEGITIMATE: DemoThread = {
  id: "HERO-LEGIT",
  title: "Line takeover — the real notice",
  summary: "The same first message, from the real carrier. Nothing should fire.",
  truth: "legitimate",
  pairId: "HERO-PAIR",
  events: [
    {
      id: "l1",
      at: 0,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "T-MOBILE",
      text: "T-Mobile: a request to transfer the number ending 4417 to another carrier was received today. If this was not you, reply NO.",
    },
    {
      id: "l2",
      at: 48,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "NO",
    },
    {
      id: "l3",
      at: 102,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "T-MOBILE",
      text: "The transfer has been blocked and Port Out Protection is on. We will never call you for a verification code. To confirm any of this, open the T-Life app yourself or call the number printed on your bill.",
    },
  ],
};

/** A phishing arc that jumps straight to Escalation, to show forward jumps. */
export const BANK_PHISH: DemoThread = {
  id: "HERO-BANK",
  title: "Bank credential phish",
  summary: "No build-up at all. One message, straight to the credential ask.",
  truth: "scam",
  goal: "Harvest online-banking credentials through a lookalike page.",
  events: [
    {
      id: "b1",
      at: 0,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "+1 332 555 0188",
      text: "Chase Fraud Alert: a $4,212.00 wire to BRANSON HOLDINGS is pending. If you did not authorise it, cancel now at https://chase-secure-verify.example.com/stop — you have 30 minutes before it settles.",
    },
    {
      id: "b2",
      at: 141,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "+1 332 555 0188",
      text: "Our agent is standing by. Do not contact the branch, they cannot stop a wire once it is queued. Confirm your online banking password on the page so we can halt it.",
    },
  ],
};

/** A romance-to-investment pivot, which only a thread-level view catches. */
export const ROMANCE_PIVOT: DemoThread = {
  id: "HERO-PIVOT",
  title: "The slow pivot",
  summary:
    "Forty days of harmless conversation, then a turn. No single message here looks like fraud.",
  truth: "scam",
  goal: "Move the customer into a fake trading platform.",
  events: [
    {
      id: "p1",
      at: 0,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "Sorry! I think I have the wrong number. Is this not the tennis club?",
    },
    {
      id: "p2",
      at: 86400,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "Haha no worries. Honestly it is nice to talk to someone new. How was your week?",
    },
    {
      id: "p3",
      at: 1900000,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "I feel like I can trust you more than people I have known for years. You are the only one I tell about my work.",
    },
    {
      id: "p4",
      at: 3100000,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "My uncle runs a private trading platform with guaranteed returns. I started small. Do not tell your family yet, they will only say it is too good to be true.",
    },
    {
      id: "p5",
      at: 3200000,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "You can start with whatever you are comfortable with. Transfer the deposit to the individual account and I will show you how to watch it grow.",
    },
  ],
};

/** A legitimate message that trips several detectors. The honest false-positive case. */
export const LEGIT_URGENT: DemoThread = {
  id: "HERO-FP",
  title: "A real alert that looks wrong",
  summary:
    "A genuine bank fraud alert. Urgent, has a link, gives a callback number. This is what our false positives cost.",
  truth: "legitimate",
  events: [
    {
      id: "f1",
      at: 0,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "CHASE",
      text: "Chase: Did you attempt a $312.40 purchase at a merchant in Lagos, NG? Reply YES or NO. If you need to speak to us, call the number on the back of your card.",
    },
  ],
};

export const CUSTOM_THREAD: DemoThread = {
  id: "CUSTOM-THREAD",
  title: "Your own conversation",
  summary: "Start with an empty timeline. Type fictional messages in the incoming-message field to see the engine respond without a preloaded scenario.",
  truth: "unknown",
  events: [],
};

export const DEMO_THREADS: DemoThread[] = [
  PORT_OUT_SCAM,
  CUSTOM_THREAD,
  PORT_OUT_LEGITIMATE,
  BANK_PHISH,
  ROMANCE_PIVOT,
  LEGIT_URGENT,
];

export const HERO_PAIR = { scam: PORT_OUT_SCAM, legitimate: PORT_OUT_LEGITIMATE };
