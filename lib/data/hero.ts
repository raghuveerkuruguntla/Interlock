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
  truth: "scam" | "legitimate";
  /** Scenario narration; deliberately not passed into the scoring engine. */
  outcome?: { title: string; explanation: string; nextStep: string };
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
  outcome: {
    title: "The takeover attempt was interrupted.",
    explanation: "The attacker asked for a passcode and initiated a number-transfer request. Interlock identified the critical moment and proposed a simulated cooling-off safeguard. No real carrier action occurred.",
    nextStep: "Hang up, do not share the code, and contact your carrier using its official app or an independently verified support number.",
  },
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
    {
      id: "h10",
      at: 635,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "I will not share that code. I am contacting my carrier directly.",
    },
    {
      id: "h11",
      at: 652,
      channel: "call",
      actor: "customer",
      kind: "call_end",
      label: "Customer ends suspicious call",
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
  outcome: {
    title: "The legitimate notice was independently checked.",
    explanation: "The fictional carrier response directed the customer to a trusted support channel and never requested a code. After independent verification, no account hold was needed.",
    nextStep: "Continue in the official carrier app, or call a number from an existing bill.",
  },
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
    {
      id: "l4",
      at: 170,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "I opened the official carrier app myself and checked the transfer status.",
    },
    {
      id: "l5",
      at: 230,
      channel: "customer",
      actor: "customer",
      kind: "out_of_band_verified",
      label: "Customer reports independent confirmation",
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
  outcome: {
    title: "The credential-stealing request has been exposed.",
    explanation: "The simulated attacker uses urgency, a lookalike link, and pressure to avoid official support. The customer reports opening the link, activating relevant recovery guidance.",
    nextStep: "Do not enter a password, use the official bank app, and follow the link-exposure recovery steps.",
  },
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
    {
      id: "b3",
      at: 190,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "Why can I not check this in the official bank app?",
    },
    {
      id: "b4",
      at: 238,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "+1 332 555 0188",
      text: "The branch and the app cannot help. You must use the secure link I sent and enter your password now or the wire will complete.",
    },
    {
      id: "b5",
      at: 301,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "I opened the link but did not enter a password. I am contacting my bank directly.",
    },
    {
      id: "b6",
      at: 346,
      channel: "customer",
      actor: "customer",
      kind: "customer_report",
      exposure: "link_opened",
      label: "Customer reports opening the suspicious link",
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
  outcome: {
    title: "A slow-moving investment scam is revealed.",
    explanation: "A relationship developed over weeks becomes secrecy pressure and a request to transfer money to a personal account. Interlock assesses the cumulative thread rather than condemning the opening greeting.",
    nextStep: "Do not transfer funds. Independently research the trading claim and discuss it with someone you trust.",
  },
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
    {
      id: "p6",
      at: 3230000,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "Why would I send money to a personal account? Can I verify this business?",
    },
    {
      id: "p7",
      at: 3230120,
      channel: "whatsapp",
      actor: "external",
      kind: "message",
      label: "Elena",
      text: "Please keep this between us. It is a private opportunity, and you must transfer today or lose your place.",
    },
    {
      id: "p8",
      at: 3230200,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "I will not send anything without independently checking the company.",
    },
  ],
};

/** A legitimate message that trips several detectors. The honest false-positive case. */
export const LEGIT_URGENT: DemoThread = {
  id: "HERO-FP",
  title: "A real alert that looks wrong",
  summary:
    "A genuine-looking bank alert that encourages verification through the official app rather than asking for a code.",
  truth: "legitimate",
  outcome: {
    title: "The customer safely verified a genuine alert.",
    explanation: "The fictional alert did not demand a password, a passcode, or a callback to an unknown number. The customer used a trusted channel and reported independent confirmation.",
    nextStep: "Use the bank's official app or the number on the back of your card. A low score is not a guarantee of safety.",
  },
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
    {
      id: "f2",
      at: 45,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "NO. I did not make that purchase.",
    },
    {
      id: "f3",
      at: 92,
      channel: "sms",
      actor: "external",
      kind: "message",
      label: "CHASE",
      text: "Thanks. To review the purchase, use your official bank app or call the number printed on the back of your card. We will never ask you to read out a one-time code.",
    },
    {
      id: "f4",
      at: 140,
      channel: "customer",
      actor: "customer",
      kind: "message",
      label: "You replied",
      text: "I opened the bank app myself, reviewed the alert, and confirmed the card is secure.",
    },
    {
      id: "f5",
      at: 174,
      channel: "customer",
      actor: "customer",
      kind: "out_of_band_verified",
      label: "Customer reports verifying in official app",
    },
  ],
};

export const DEMO_THREADS: DemoThread[] = [
  PORT_OUT_SCAM,
  PORT_OUT_LEGITIMATE,
  BANK_PHISH,
  ROMANCE_PIVOT,
  LEGIT_URGENT,
];

export const HERO_PAIR = { scam: PORT_OUT_SCAM, legitimate: PORT_OUT_LEGITIMATE };
