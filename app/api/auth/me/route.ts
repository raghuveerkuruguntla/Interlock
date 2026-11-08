import { NextResponse } from "next/server";
import { currentAccountId, getSnapshot } from "@/lib/server/accounts";
import { authSecretConfigured } from "@/lib/server/auth";
import { kv } from "@/lib/server/kv";

export const dynamic = "force-dynamic";

/** The signed-in account, or `{ account: null }`. Never an error for a guest. */
export async function GET() {
  const id = await currentAccountId();
  const account = id ? await getSnapshot(id) : null;
  const store = kv();
  return NextResponse.json(
    {
      account,
      config: {
        authSecret: authSecretConfigured(),
        store: { kind: store.kind, durable: store.durable },
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
