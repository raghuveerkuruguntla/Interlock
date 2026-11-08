import { NextResponse } from "next/server";
import { currentAccountId, getSnapshot, recordActivity } from "@/lib/server/accounts";
import { crossSite, error } from "@/lib/server/http";
import { endSession, getSession, type LiveSession, readPartials, readSegments } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * The session id is a random UUID and acts as the capability for a guest
 * session. A session armed by a signed-in customer is additionally bound to
 * that account, and re-checks their consent on every poll: switching call
 * analysis off in Privacy ends the session on the next tick.
 */
async function authorise(id: string): Promise<{ session: LiveSession } | { res: Response }> {
  const session = await getSession(id);
  if (!session) return { res: error("Session not found or expired.", 404) };
  if (session.ownerId) {
    const me = await currentAccountId();
    if (me !== session.ownerId) return { res: error("This session belongs to another account.", 403) };
    const snap = await getSnapshot(me);
    if (!snap?.consent.callAnalysis && session.status !== "ended") {
      await endSession(session);
      return { res: NextResponse.json({ status: "ended", revoked: true, segments: [], partials: {} }) };
    }
  }
  return { session };
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorise(id);
  if ("res" in auth) return auth.res;
  const after = Math.max(0, Number(new URL(request.url).searchParams.get("after") ?? 0) || 0);
  const { session } = auth;
  const [segments, partials] =
    session.status === "ended" ? [[], {}] : await Promise.all([readSegments(id, after), readPartials(id)]);
  return NextResponse.json(
    { status: session.status, segments, partials },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const { id } = await ctx.params;
  const auth = await authorise(id);
  if ("res" in auth) return auth.res;
  if (auth.session.status !== "ended") {
    await endSession(auth.session);
    if (auth.session.ownerId) await recordActivity(auth.session.ownerId, "live_session_ended", "Phone");
  }
  return NextResponse.json({ ok: true, deleted: ["transcript segments", "partial lines"] });
}
