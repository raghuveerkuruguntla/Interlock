import { getSnapshot } from "./accounts";
import type { LiveSession } from "./live";

/**
 * Whether a session may still analyse this kind of content. Guest sessions
 * carry the consent given on the live page when they were armed; account
 * sessions are re-checked against the customer's saved settings every time.
 */
export async function sessionAllows(s: LiveSession, kind: "call" | "message"): Promise<boolean> {
  if (s.status === "ended") return false;
  if (!s.ownerId) return true;
  const snap = await getSnapshot(s.ownerId);
  if (!snap) return false;
  return kind === "call" ? snap.consent.callAnalysis : snap.consent.messageAnalysis;
}
