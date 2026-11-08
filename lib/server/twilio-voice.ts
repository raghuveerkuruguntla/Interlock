/**
 * What Twilio should do with an incoming call to the Interlock number.
 *
 * Two ways to join the protected customer and the other person:
 *
 * - `conference` (default, works on a Twilio trial account): both people call
 *   the Interlock number and are joined into a private conference for this
 *   session. Each call is transcribed on its own inbound track, so who said
 *   what is never mixed up. The customer is recognised by their phone number.
 *   Trial accounts block forwarding a call to another phone, but allow this.
 * - `forward` (paid accounts): the other person calls the Interlock number and
 *   the call is forwarded to the customer's phone, transcribed on both tracks.
 *
 * Kept free of request handling so both modes can be unit-tested.
 */

import { digits, xmlEscape } from "./twilio";

export type CallMode = "conference" | "forward";
export type CallRole = "customer" | "caller";

export function callMode(): CallMode {
  return process.env.INTERLOCK_CALL_MODE?.trim() === "forward" ? "forward" : "conference";
}

/** The protected customer's phone. INTERLOCK_FORWARD_TO is the older name. */
export function customerPhone(): string | undefined {
  const raw = (process.env.INTERLOCK_CUSTOMER_PHONE ?? process.env.INTERLOCK_FORWARD_TO)?.trim();
  return raw || undefined;
}

export function isCustomerNumber(n: string | undefined | null): boolean {
  const mine = digits(customerPhone()).slice(-10);
  return Boolean(mine) && digits(n).slice(-10) === mine;
}

export function conferenceName(sessionId: string): string {
  return `interlock-${sessionId}`;
}

const CALLER_NOTICE =
  "Hello. The person you are calling uses Interlock scam protection. With their consent, this call is transcribed live to check for scam warning signs. It is not recorded. Connecting you now.";
const CUSTOMER_NOTICE = "Interlock live protection is on. Connecting you now.";

interface VoiceOptions {
  mode: CallMode;
  /** Absent when no live session is armed: the call is not analysed. */
  sessionId?: string;
  /** Public origin of this site, for Twilio's callbacks. */
  base: string;
  role: CallRole;
  /** False for a saved contact: connect them, but never transcribe. */
  analyse: boolean;
  customerPhone?: string;
}

function transcription(callbackUrl: string, track: string, extra = ""): string {
  return (
    `<Start><Transcription statusCallbackUrl="${xmlEscape(callbackUrl)}" track="${track}" ` +
    `${extra}partialResults="true" languageCode="en-US" profanityFilter="false"/></Start>`
  );
}

export function voiceTwiml(o: VoiceOptions): string {
  if (o.mode === "forward") {
    if (!o.customerPhone) return `<Say>Interlock has no forwarding number configured. Goodbye.</Say><Hangup/>`;
    const number = xmlEscape(o.customerPhone);
    if (!o.sessionId || !o.analyse) return `<Dial answerOnBridge="true">${number}</Dial>`;
    const done = `${o.base}/api/twilio/voice/done?session=${o.sessionId}`;
    const cb = `${o.base}/api/twilio/transcription?session=${o.sessionId}`;
    return (
      `<Say>${CALLER_NOTICE}</Say>` +
      transcription(cb, "both_tracks", `inboundTrackLabel="caller" outboundTrackLabel="customer" `) +
      `<Dial answerOnBridge="true" action="${xmlEscape(done)}">${number}</Dial>`
    );
  }

  // Conference mode: nothing to join without an armed session.
  if (!o.sessionId) {
    return `<Say>Interlock live protection is not switched on right now. Goodbye.</Say><Hangup/>`;
  }
  const done = `${o.base}/api/twilio/voice/done?session=${o.sessionId}`;
  const conference =
    `<Dial action="${xmlEscape(done)}"><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">` +
    `${xmlEscape(conferenceName(o.sessionId))}</Conference></Dial>`;
  if (!o.analyse) return conference;
  const cb = `${o.base}/api/twilio/transcription?session=${o.sessionId}&speaker=${o.role}`;
  // Each person's own phone line is their inbound track, so speakers never mix.
  return (
    `<Say>${o.role === "customer" ? CUSTOMER_NOTICE : CALLER_NOTICE}</Say>` +
    transcription(cb, "inbound_track") +
    conference
  );
}
