/**
 * Twilio real-time transcription callbacks.
 *
 * One POST per utterance, partial or final, per track. The caller is the
 * inbound track (they dialled the Interlock number); the customer is the
 * outbound track (the forwarded leg). Finals are appended to the session;
 * partials only overwrite a single "currently speaking" line, so the screen
 * can show speech as it happens without storing every guess.
 */

import { appendSegment, finishCall, type Speaker, sessionByCall, setPartial } from "@/lib/server/live";
import { sessionAllows } from "@/lib/server/live-consent";
import { verifiedTwilioForm } from "@/lib/server/twilio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const verified = await verifiedTwilioForm(request);
  if (!verified.ok) return new Response(verified.message, { status: verified.status });
  const p = verified.params;

  const session = await sessionByCall(p.CallSid ?? "", new URL(request.url).searchParams.get("session"));
  // Unknown or ended session, or consent revoked: drop the text on the floor.
  if (!session || !(await sessionAllows(session, "call"))) return new Response(null, { status: 204 });

  if (p.TranscriptionEvent === "transcription-stopped") {
    await finishCall(session);
    return new Response(null, { status: 204 });
  }
  if (p.TranscriptionEvent !== "transcription-content") return new Response(null, { status: 204 });

  let text = "";
  try {
    text = String((JSON.parse(p.TranscriptionData ?? "{}") as { transcript?: unknown }).transcript ?? "");
  } catch {
    return new Response(null, { status: 204 });
  }
  text = text.trim().slice(0, 600);
  if (!text) return new Response(null, { status: 204 });

  const speaker: Speaker = p.Track === "outbound_track" ? "customer" : "caller";
  if (p.Final === "true") {
    await appendSegment(session, { speaker, kind: "speech", text });
  } else {
    await setPartial(session, speaker, text);
  }
  return new Response(null, { status: 204 });
}
