import type { ThreadEvent } from "@/lib/engine/types";

export const MAX_CONVERSATION_CHARS = 6000;
export const MAX_CONVERSATION_LINES = 32;

/**
 * Parse a synthetic conversation locally. Each nonblank line is one message.
 * 'You:' or 'Customer:' is a reply, not evidence of the attacker's behavior.
 * Unprefixed lines and 'Sender:'/'Incoming:' are incoming messages.
 */
export function parseSyntheticConversation(input: string): ThreadEvent[] {
  return input
    .slice(0, MAX_CONVERSATION_CHARS)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_CONVERSATION_LINES)
    .map((line, index): ThreadEvent => {
      const prefix = /^(you|customer|sender|incoming|scammer)\s*:\s*/i.exec(line);
      const isCustomer = Boolean(prefix && /^(you|customer)$/i.test(prefix[1]));
      const text = prefix ? line.slice(prefix[0].length).trim() : line;
      return {
        id: `analyzer-${index}`,
        at: index * 45,
        channel: isCustomer ? "customer" : "sms",
        actor: isCustomer ? "customer" : "external",
        kind: "message",
        label: isCustomer ? "You" : "Incoming message",
        text,
      };
    })
    .filter((event) => Boolean(event.text));
}
