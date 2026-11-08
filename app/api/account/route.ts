import { NextResponse } from "next/server";
import { currentAccountId, deleteAccount } from "@/lib/server/accounts";
import { crossSite, error, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Permanently delete the account: Interlock's data and the Clerk user. */
export async function DELETE(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  const body = await readJson(request);
  if (body?.confirm !== "DELETE") return error("Type DELETE to confirm.", 400);
  try {
    await deleteAccount(id);
  } catch {
    return error("Your Interlock data was deleted, but the sign-in account could not be removed. Try again.", 502);
  }
  return NextResponse.json({ ok: true });
}
