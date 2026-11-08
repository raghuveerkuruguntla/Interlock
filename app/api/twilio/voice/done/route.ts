import { finishCall, sessionByCall } from "@/lib/server/live";
import { twiml, verifiedTwilioForm } from "@/lib/server/twilio";

export const dynamic = "force-dynamic";

/** The forwarded leg ended. Mark the call over so the customer's screen can move to the report. */
export async function POST(request: Request) {
  const verified = await verifiedTwilioForm(request);
  if (!verified.ok) return new Response(verified.message, { status: verified.status });
  const session = await sessionByCall(
    verified.params.CallSid ?? "",
    new URL(request.url).searchParams.get("session"),
  );
  if (session) await finishCall(session);
  return twiml("<Hangup/>");
}
