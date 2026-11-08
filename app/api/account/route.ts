import { NextResponse } from "next/server";
import { currentAccountId, deleteAccount } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { crossSite, error, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Permanently delete the account and everything stored with it. */
export async function DELETE(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  const body = await readJson(request);
  if (body?.confirm !== "DELETE") return error("Type DELETE to confirm.", 400);
  await deleteAccount(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
