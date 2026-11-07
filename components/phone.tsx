"use client";

/**
 * The customer's side of the demo: a phone thread.
 *
 * Messages, a call connecting, a passcode arriving, an account change being
 * requested. These are the events the engine actually consumes, rendered the
 * way the person being targeted would see them — which is the point. A scam is
 * experienced as a conversation, not as a row in a dataset.
 */

import { useSettings } from "@/components/settings";
import type { ThreadEvent } from "@/lib/engine/types";

const CHANNEL_LABEL: Record<string, string> = {
  sms: "SMS",
  rcs: "RCS",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  call: "Call",
  customer: "You",
};

function clock(seconds: number): string {
  if (seconds < 3600) return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `day ${days + 1}`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function SystemRow({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "alert" | "good";
}) {
  const color =
    tone === "alert" ? "var(--tier-critical)" : tone === "good" ? "var(--ok)" : "var(--text-faint)";
  return (
    <li className="rise my-2 flex items-center gap-2 px-1">
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--border)" }} />
      <span className="text-center text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
        {children}
      </span>
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--border)" }} />
    </li>
  );
}

export function PhoneThread({
  events,
  otpHeld,
  otpRevealed,
  onRevealOtp,
}: {
  events: ThreadEvent[];
  otpHeld: boolean;
  otpRevealed: boolean;
  onRevealOtp: () => void;
}) {
  const { copy } = useSettings();
  return (
    <div className="phone-shell flex h-[32rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-muted">
        <span className="font-medium text-ink">Messages</span>
        <span aria-hidden>▲ ▮ ⌁</span>
      </div>

      <ol
        className="thread-scroll flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {events.length === 0 && (
          <li className="grid h-full place-items-center px-6 text-center text-sm text-faint">
            Press play, or type a message below, and the engine scores it as it arrives.
          </li>
        )}

        {events.map((event) => {
          if (event.kind === "call_start") {
            return (
              <SystemRow key={event.id} tone="alert">
                Call connected · {event.label ?? "Unknown number"}
              </SystemRow>
            );
          }
          if (event.kind === "call_end") {
            return <SystemRow key={event.id}>Call ended</SystemRow>;
          }
          if (event.kind === "out_of_band_verified") {
            return (
              <SystemRow key={event.id} tone="good">
                You checked through a channel you trust
              </SystemRow>
            );
          }
          if (event.kind === "customer_report") {
            return (
              <SystemRow key={event.id} tone="alert">
                You told us you may have shared something
              </SystemRow>
            );
          }

          if (event.kind === "otp_received") {
            return (
              <li key={event.id} className="rise">
                <div
                  className={`rounded-card border px-3 py-2.5 ${otpHeld && !otpRevealed ? "pulse-ring" : ""}`}
                  style={{
                    borderColor: otpHeld && !otpRevealed ? "var(--tier-critical)" : "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {event.otpIssuer ?? "Your account"} · verification code
                  </p>
                  <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-ink">
                    {otpHeld && !otpRevealed ? "••••••" : "418 902"}
                  </p>
                  {otpHeld && !otpRevealed ? (
                    <>
                      <p className="mt-1.5 text-xs leading-snug text-muted">
                        Held for 60 seconds. You are on a call right now.
                      </p>
                      <button
                        type="button"
                        onClick={onRevealOtp}
                        className="mt-2 rounded-md border px-2.5 py-1 text-xs font-medium"
                        style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}
                      >
                        Show it anyway
                      </button>
                    </>
                  ) : (
                    <p className="mt-1.5 text-xs text-faint">
                      Demo value. Never type a real code into this app.
                    </p>
                  )}
                </div>
              </li>
            );
          }

          if (event.kind === "account_action_requested") {
            // Never "port-out" or "SIM swap" in the victim path. The whole
            // reason these changes get approved is that nobody outside a
            // carrier knows what the words mean.
            const action = event.accountAction ? copy.accountActions[event.accountAction] : undefined;
            return (
              <li key={event.id} className="rise">
                <div
                  className="rounded-card border px-3 py-2.5"
                  style={{ borderColor: "var(--tier-critical)", background: "var(--tier-critical-soft)" }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--tier-critical)" }}
                  >
                    Account change requested
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink">
                    {action?.plain ?? (event.accountAction ?? "").replace(/_/g, " ")}
                  </p>
                  {action && (
                    <p className="mt-1 text-xs leading-snug text-muted">{action.consequence}</p>
                  )}
                </div>
              </li>
            );
          }

          if (event.kind === "customer_call_summary") {
            return (
              <li key={event.id} className="rise">
                <div className="ml-auto max-w-[88%] rounded-card border border-dashed border-line bg-surface-2 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Your notes about the call
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{event.text}</p>
                  <p className="mt-1.5 text-[11px] leading-snug text-faint">
                    Your words. We do not record or transcribe calls.
                  </p>
                </div>
              </li>
            );
          }

          const mine = event.actor === "customer";
          return (
            <li key={event.id} className={`rise flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${mine ? "text-right" : ""}`}>
                <p className="mb-0.5 px-1 text-[11px] text-faint">
                  {event.label ?? CHANNEL_LABEL[event.channel] ?? event.channel}
                  <span className="mx-1" aria-hidden>
                    ·
                  </span>
                  <span className="font-mono">{clock(event.at)}</span>
                </p>
                <div
                  className="rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed"
                  style={
                    mine
                      ? { background: "var(--brand)", color: "white" }
                      : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
                  }
                >
                  {event.text}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("message") as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;
        onSend(text);
        input.value = "";
      }}
    >
      <label htmlFor="composer" className="sr-only">
        Type a message as the sender, to score it live
      </label>
      <input
        id="composer"
        name="message"
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder="Type a message as the sender…"
        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
