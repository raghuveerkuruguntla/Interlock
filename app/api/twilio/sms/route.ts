/**
 * Incoming text to the Interlock number — the controlled live-message demo.
 *
 * This is not access to anyone's real SMS. A teammate texts the demo number
 * while a session is armed, and the message appears on the customer's live
 * screen and is scored on their device. Texts from numbers configured as
 * saved contacts are not analysed.
 */

import { appendSegment, armedSession } from "@/lib/server/live";
import { sessionAllows } from "@/lib/server/live-consent";
import { isKnownNumber, maskNumber, twiml, verifiedTwilioForm } from "@/lib/server/twilio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const verified = await verifiedTwilioForm(request);
  if (!verified.ok) return new Response(verified.message, { status: verified.status });
  const { params } = verified;

  const session = await armedSession();
  if (session && (await sessionAllows(session, "message"))) {
    if (isKnownNumber(params.From)) {
      await appendSegment(session, {
        speaker: "system",
        kind: "skipped_contact",
        label: "Text from a saved contact — not analysed",
      });
    } else if (params.Body) {
      await appendSegment(session, {
        speaker: "caller",
        kind: "sms",
        text: params.Body.slice(0, 1600),
        label: `SMS · ${maskNumber(params.From)}`,
      });
    }
  }
  // Empty response: Interlock never replies to the sender.
  return twiml("");
}
