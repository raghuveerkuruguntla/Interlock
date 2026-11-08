import { NextResponse } from "next/server";
import { currentAccountId, deleteIncident } from "@/lib/server/accounts";
import { crossSite, error } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  const { id: incidentId } = await ctx.params;
  const ok = await deleteIncident(id, incidentId);
  return ok ? NextResponse.json({ ok: true }) : error("Report not found.", 404);
}
