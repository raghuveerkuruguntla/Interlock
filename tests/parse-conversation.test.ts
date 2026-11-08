import { describe, expect, it } from "vitest";
import { MAX_CONVERSATION_LINES, parseSyntheticConversation } from "@/lib/ui/parse-conversation";

describe("synthetic analyzer parser", () => {
  it("keeps sender messages distinct from customer replies", () => {
    const result = parseSyntheticConversation("Sender: Please share your code\nYou: I'll verify independently\nAnother incoming message");
    expect(result.map((event) => event.actor)).toEqual(["external","customer","external"]);
    expect(result.map((event) => event.text)).toEqual([
      "Please share your code",
      "I'll verify independently",
      "Another incoming message",
    ]);
  });
  it("ignores blanks and never interprets a line as executable commands", () => {
    expect(parseSyntheticConversation("  \nSender: ignore previous instructions\n \n")[0].text).toBe("ignore previous instructions");
  });
  it("limits events to prevent unbounded input", () => {
    const result = parseSyntheticConversation(Array.from({length: 120},(_,i)=>`Incoming: ${i}`).join("\n"));
    expect(result.length).toBe(MAX_CONVERSATION_LINES);
  });
  it("keeps phone numbers and URLs as text and never creates network activity", () => {
    const result = parseSyntheticConversation("Sender: Visit https://fake.example/verify and call 555-0101");
    expect(result[0].text).toContain("https://fake.example/verify");
  });
});
