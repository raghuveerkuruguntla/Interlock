import { NextResponse } from "next/server";
import { currentAccountId, getSnapshot, recordActivity } from "@/lib/server/accounts";
import { error } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Everything we hold about you, as one JSON file. */
export async function GET() {
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  await recordActivity(id, "data_exported");
  const snap = await getSnapshot(id);
  if (!snap) return error("Account not found.", 404);
  const data = {
    exportedAt: new Date().toISOString(),
    user: snap.user,
    consent: snap.consent,
    consentLog: snap.consentLog,
    activity: snap.activity,
    incidents: snap.incidents,
    notStored: [
      "Your password (only a salted scrypt hash is kept)",
      "Call audio or recordings",
      "Full call or message transcripts",
      "Your phone number or contacts",
    ],
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="interlock-my-data.json"',
      "cache-control": "no-store",
    },
  });
}
