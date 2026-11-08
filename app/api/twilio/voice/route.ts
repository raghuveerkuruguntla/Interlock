/**
 * Incoming call to the Interlock number.
 *
 * Plays a short notice so the caller knows the call is being analysed, starts
 * Twilio real-time transcription with the caller and the customer on separate
 * tracks, and forwards the call to the customer's phone. If no session is
 * armed, or the caller is a saved contact, the call is forwarded with no
 * transcription at all.
 */

import { activate, appendSegment, armedSession } from "@/lib/server/live";
import { sessionAllows } from "@/lib/server/live-consent";
import { isKnownNumber, maskNumber, publicBase, twiml, verifiedTwilioForm, xmlEscape } from "@/lib/server/twilio";

export const dynamic = "force-dynamic";

const NOTICE =
  "Hello. The person you are calling uses Interlock scam protection. With their consent, this call is transcribed live to check for scam warning signs. It is not recorded. Connecting you now.";

export async function POST(request: Request) {
  const verified = await verifiedTwilioForm(request);
  if (!verified.ok) return new Response(verified.message, { status: verified.status });
  const { params } = verified;

  const forwardTo = process.env.INTERLOCK_FORWARD_TO;
  const dial = forwardTo
    ? `<Dial answerOnBridge="true">${xmlEscape(forwardTo)}</Dial>`
    : `<Say>Interlock has no forwarding number configured. Goodbye.</Say><Hangup/>`;

  const session = await armedSession();
  if (!session || session.status !== "armed" || !(await sessionAllows(session, "call"))) {
    // Nothing armed: behave like an ordinary forwarded call. No notice, no analysis.
    return twiml(dial);
  }

  if (isKnownNumber(params.From)) {
    // Saved contacts are never transcribed. Record only that a call was skipped.
    await appendSegment(session, {
      speaker: "system",
      kind: "skipped_contact",
      label: "Saved contact — call not analysed",
    });
    return twiml(dial);
  }

  await activate(session, params.CallSid ?? "unknown");
  await appendSegment(session, {
    speaker: "system",
    kind: "call_start",
    label: `Unknown number ${maskNumber(params.From)}`,
  });

  const base = publicBase(request);
  const cb = `${base}/api/twilio/transcription?session=${session.id}`;
  const done = `${base}/api/twilio/voice/done?session=${session.id}`;
  const dialWithAction = forwardTo
    ? `<Dial answerOnBridge="true" action="${xmlEscape(done)}">${xmlEscape(forwardTo)}</Dial>`
    : dial;

  return twiml(
    `<Say>${NOTICE}</Say>` +
      `<Start><Transcription statusCallbackUrl="${xmlEscape(cb)}" track="both_tracks" ` +
      `inboundTrackLabel="caller" outboundTrackLabel="customer" partialResults="true" ` +
      `languageCode="en-US" profanityFilter="false"/></Start>` +
      dialWithAction,
  );
}
