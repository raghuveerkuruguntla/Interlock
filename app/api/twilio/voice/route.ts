/**
 * Incoming call to the Interlock number.
 *
 * In conference mode (the default, and the only option on a Twilio trial) the
 * customer and the other person both call this number and are joined into a
 * private conference for the armed session; each call is transcribed on its
 * own. In forward mode the other person's call is forwarded to the customer's
 * phone. A saved contact is connected but never transcribed, and with no
 * session armed nothing is analysed. See lib/server/twilio-voice.ts.
 */

import { activate, appendSegment, armedSession } from "@/lib/server/live";
import { sessionAllows } from "@/lib/server/live-consent";
import { isKnownNumber, maskNumber, publicBase, twiml, verifiedTwilioForm } from "@/lib/server/twilio";
import { callMode, customerPhone, isCustomerNumber, voiceTwiml } from "@/lib/server/twilio-voice";

export const dynamic = "force-dynamic";

/** A conference session holds the customer and one other person. */
const MAX_LEGS = 2;

export async function POST(request: Request) {
  const verified = await verifiedTwilioForm(request);
  if (!verified.ok) return new Response(verified.message, { status: verified.status });
  const { params } = verified;

  const mode = callMode();
  const base = publicBase(request);
  const callSid = params.CallSid ?? "unknown";
  const role = isCustomerNumber(params.From) ? "customer" : "caller";
  const common = { mode, base, role, customerPhone: customerPhone() } as const;

  const session = await armedSession();
  const usable =
    session &&
    (mode === "conference" ? session.status === "armed" || session.status === "active" : session.status === "armed") &&
    (await sessionAllows(session, "call"));
  if (!session || !usable) return twiml(voiceTwiml({ ...common, analyse: false }));

  const legs = session.callSids ?? (session.callSid ? [session.callSid] : []);
  if (mode === "conference" && !legs.includes(callSid) && legs.length >= MAX_LEGS) {
    return twiml(`<Say>This Interlock line is already in use. Please try again later.</Say><Hangup/>`);
  }

  // Saved contacts are never transcribed. The customer's own phone is never "a contact".
  if (role === "caller" && isKnownNumber(params.From)) {
    await appendSegment(session, { speaker: "system", kind: "skipped_contact", label: "Saved contact — call not analysed" });
    await activate(session, callSid);
    return twiml(voiceTwiml({ ...common, sessionId: session.id, analyse: false }));
  }

  await activate(session, callSid);
  await appendSegment(
    session,
    role === "customer"
      ? { speaker: "system", kind: "notice", label: "Your phone joined the call" }
      : { speaker: "system", kind: "call_start", label: `Unknown number ${maskNumber(params.From)}` },
  );
  return twiml(voiceTwiml({ ...common, sessionId: session.id, analyse: true }));
}
