import { NextResponse } from "next/server";
import { currentAccountId, recordActivity } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { crossSite, error } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (id) await recordActivity(id, "signed_out");
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
