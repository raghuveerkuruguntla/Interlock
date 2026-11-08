import { describe, expect, it } from "vitest";
import { combineDemoEvents, type InsertedEvent } from "@/lib/ui/demo-timeline";
import type { ThreadEvent } from "@/lib/engine/types";

const scripted: ThreadEvent[] = [
  { id: "one", at: 0, channel: "sms", actor: "external", kind: "message", text: "Hello" },
  { id: "two", at: 30, channel: "sms", actor: "external", kind: "message", text: "Don't call anyone" },
  { id: "three", at: 60, channel: "sms", actor: "external", kind: "message", text: "Read me the code" },
];
const manual: InsertedEvent[] = [
  { after: 1, event: { id: "input-1", at: 0.001, channel: "customer", actor: "customer", kind: "message", text: "Who is this?" } },
  { after: 1, event: { id: "input-2", at: 0.002, channel: "sms", actor: "external", kind: "message", text: "I'm support" } },
  { after: 3, event: { id: "input-3", at: 60.001, channel: "customer", actor: "customer", kind: "out_of_band_verified" } },
];

describe("demo timeline", () => {
  it("inserts customer and sender input where they were entered", () => {
    expect(combineDemoEvents(scripted, 2, manual).map((x) => x.id))
      .toEqual(["one", "input-1", "input-2", "two"]);
  });

  it("never leaks events inserted after future scripted messages", () => {
    expect(combineDemoEvents(scripted, 1, manual).map((x) => x.id))
      .toEqual(["one", "input-1", "input-2"]);
  });

  it("includes recovery and verification events after completion", () => {
    expect(combineDemoEvents(scripted, 3, manual).map((x) => x.id))
      .toEqual(["one", "input-1", "input-2", "two", "three", "input-3"]);
  });

  it("supports an empty custom thread without inheriting scripted risk", () => {
    const custom: InsertedEvent[] = [
      {
        after: 0,
        event: { id: "typed", at: 0, actor: "external", channel: "sms",
          kind: "message", text: "Do not call support. Share your code." },
      },
    ];
    expect(combineDemoEvents([], 0, custom).map((x) => x.id)).toEqual(["typed"]);
    expect(combineDemoEvents([], 0, [])).toEqual([]);
  });

  it("can add a message before the first scripted step", () => {
    const before: InsertedEvent[] = [
      {
        after: 0,
        event: { id: "opening", at: 0, actor: "external", channel: "sms",
          kind: "message", text: "Hello" },
      },
    ];
    expect(combineDemoEvents(scripted, 0, before).map((x) => x.id)).toEqual(["opening"]);
    expect(combineDemoEvents(scripted, 1, before).map((x) => x.id)).toEqual(["opening", "one"]);
  });

  it("supports rewinding and replaying without duplicating manual input", () => {
    const rewind = combineDemoEvents(scripted, 1, manual);
    expect(rewind.filter((x) => x.id === "input-1")).toHaveLength(1);
    expect(combineDemoEvents(scripted, 2, manual)).toHaveLength(4);
    expect(combineDemoEvents(scripted, 0, manual)).toHaveLength(0);
  });
});
