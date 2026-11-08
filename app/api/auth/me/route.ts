import { NextResponse } from "next/server";
import { currentSnapshot } from "@/lib/server/accounts";
import { kv } from "@/lib/server/kv";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's Interlock account, created on first visit, or
 * `{ account: null }` for a guest. Only ever the caller's own data.
 */
export async function GET() {
  const account = await currentSnapshot();
  const store = kv();
  return NextResponse.json(
    { account, config: { store: { kind: store.kind, durable: store.durable } } },
    { headers: { "cache-control": "no-store" } },
  );
}
