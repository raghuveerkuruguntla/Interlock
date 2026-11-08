import type { ThreadEvent } from "@/lib/engine/types";

export interface InsertedEvent {
  /** One-based scripted event index when the user inserted this event. */
  after: number;
  event: ThreadEvent;
}

/**
 * Produce the exact chronological conversation visible at the current
 * playback position, including manual messages inserted mid-story.
 * Events added at future playback positions are never leaked into the engine.
 */
export function combineDemoEvents(
  scripted: ThreadEvent[],
  count: number,
  inserted: InsertedEvent[],
): ThreadEvent[] {
  const result: ThreadEvent[] = inserted.filter((extra) => extra.after === 0).map((extra) => extra.event);
  const end = Math.min(scripted.length, Math.max(0, Math.floor(count)));
  for (let i = 0; i < end; i += 1) {
    result.push(scripted[i]);
    for (const extra of inserted) {
      if (extra.after === i + 1) result.push(extra.event);
    }
  }
  return result;
}
