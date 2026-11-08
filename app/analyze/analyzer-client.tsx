"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ModelReadout,
  ReceiptPanel,
  RiskMeter,
  SafeguardCard,
  SignalList,
  StageRail,
} from "@/components/assessment";
import { useScorer } from "@/lib/ui/use-scorer";
import { assessThread } from "@/lib/engine/killchain";
import type { ThreadEvent } from "@/lib/engine/types";
import { MAX_CONVERSATION_CHARS, parseSyntheticConversation } from "@/lib/ui/parse-conversation";

const EXAMPLES = [
  {
    label: "Account takeover",
    caption: "An urgent carrier impersonation attempt",
    text: [
      "Sender: T-Mobile: Someone requested a transfer of your phone number. Reply NO if this wasn't you.",
      "You: NO",
      "Sender: Our fraud team is calling now. Do not call T-Mobile separately or this case will be locked.",
      "Sender: Read me the 6-digit verification code you received, so I can cancel the transfer.",
    ].join("\n"),
  },
  {
    label: "Suspicious job offer",
    caption: "Pressure to pay money for a task",
    text: [
      "Sender: Congratulations! You have been selected for an easy remote job. Make $300 a day.",
      "You: What would I need to do?",
      "Sender: To release your earnings, purchase a prepaid gift card and send the code today. Do not tell your bank.",
    ].join("\n"),
  },
  {
    label: "Legitimate notice",
    caption: "Similar wording, safer follow-through",
    text: [
      "Sender: T-Mobile: Someone requested a transfer of your phone number. Reply NO if this wasn't you.",
      "You: NO",
      "Sender: Your request is recorded. We will never ask for your verification code. To confirm, open your official carrier app or use the support number on your statement.",
    ].join("\n"),
  },
] as const;

export function AnalyzerClient() {
  const { scorer, loading, error } = useScorer();
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [verified, setVerified] = useState(false);

  const parsed = useMemo(() => parseSyntheticConversation(submitted), [submitted]);
  const events = useMemo<ThreadEvent[]>(() => {
    if (!verified || parsed.length === 0) return parsed;
    return [...parsed, {
      id: "self-verified",
      at: parsed[parsed.length - 1].at + 1,
      actor: "customer",
      channel: "customer",
      kind: "out_of_band_verified",
      label: "You say you independently checked the sender",
    }];
  }, [parsed, verified]);

  const assessment = useMemo(() =>
    assessThread(events, { scorer, locale: "en" }),
  [events, scorer]);

  const hasResults = parsed.length > 0;
  const stale = hasResults && submitted !== draft;

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parseSyntheticConversation(draft).length === 0) return;
    setVerified(false);
    setSubmitted(draft);
  };

  const loadExample = (value: string) => {
    setDraft(value);
    setSubmitted(value);
    setVerified(false);
  };

  const reset = () => {
    setDraft("");
    setSubmitted("");
    setVerified(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <header className="mb-12 max-w-3xl" data-reveal>
        <p className="editorial-kicker">INTERLOCK / MESSAGE ANALYZER</p>
        <h1 className="mt-5 text-[clamp(2.9rem,5vw,5rem)] font-medium leading-[1.12] tracking-[-0.065em] text-ink">
          The context changes<br /><em className="font-serif font-normal text-brand">the picture.</em>
        </h1>
        <p className="mt-6 text-base leading-[1.85] text-muted">
          Paste a conversation and Interlock checks it for scam warning signs, right here on your device.
          Each incoming message contributes evidence; your own replies remain visible,
          but are not treated as the sender&apos;s behavior.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.93fr)_minmax(0,1.07fr)]">
        <div className="space-y-6" data-reveal>
          <section className="analyzer-panel">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="editorial-kicker">01 / INPUT</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">Your conversation</h2>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-faint">LOCAL ONLY</span>
            </div>
            <form onSubmit={analyze}>
              <label htmlFor="analyzer-text" className="block text-sm font-medium text-ink">
                Enter one message per line
              </label>
              <p className="mt-1 text-xs leading-relaxed text-faint">
                Start with <code>Sender:</code> for an incoming message or <code>You:</code> for your reply.
              </p>
              <textarea
                id="analyzer-text" rows={10} maxLength={MAX_CONVERSATION_CHARS}
                value={draft} onChange={(e) => setDraft(e.target.value)}
                spellCheck={false} autoComplete="off"
                placeholder={"Sender: Your account needs urgent verification.\nYou: Can I use the official app?\nSender: No. Read the code to me now."}
                className="analyzer-textarea mt-4 block w-full resize-y border border-line bg-bg px-4 py-4 text-sm leading-[1.8] text-ink placeholder:text-faint"
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-faint">
                <span>{draft.length.toLocaleString()} / {MAX_CONVERSATION_CHARS.toLocaleString()} characters</span>
                {stale && <span className="text-brand">Edits not yet analyzed</span>}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="submit" disabled={parseSyntheticConversation(draft).length === 0}
                  className="editorial-primary-link disabled:cursor-not-allowed disabled:opacity-40">
                  Analyze conversation <span aria-hidden="true">↗</span>
                </button>
                <button type="button" onClick={reset} className="editorial-outline-link">
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="analyzer-panel">
            <p className="editorial-kicker">OR / TRY A SCENARIO</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">Three example conversations</h2>
            <div className="mt-5 divide-y divide-line border-t border-line">
              {EXAMPLES.map((item, index) => (
                <button key={item.label} type="button"
                  onClick={() => loadExample(item.text)}
                  className="group flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-surface-2">
                  <span className="font-mono text-xs text-brand">0{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="mt-1 block text-xs text-faint">{item.caption}</span>
                  </span>
                  <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1">↗</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5" data-reveal>
          <div className="mb-1 flex items-center justify-between gap-3">
            <div>
              <p className="editorial-kicker">02 / ASSESSMENT</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">Engine output</h2>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-muted">Recomputed locally</span>
          </div>
          {!hasResults ? (
            <div className="analyzer-empty" role="status">
              <span className="analyzer-empty-symbol" aria-hidden="true">◎</span>
              <h3 className="mt-6 text-xl font-medium text-ink">Nothing analyzed yet.</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                Enter a conversation and select Analyze, or load one of the samples.
                You&apos;ll see the messages, signals, risk tier, and potential safeguards.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="analyzer-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Messages evaluated</h3>
                  <span className="font-mono text-xs text-faint">{parsed.length} message{parsed.length === 1 ? "" : "s"}</span>
                </div>
                <ol className="mt-4 space-y-2" aria-label="Messages included in this analysis">
                  {parsed.map((event, index) => (
                    <li key={event.id} className={`analyzer-transcript-line ${event.actor === "customer" ? "analyzer-transcript-you" : ""}`}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                        {index + 1}. {event.actor === "customer" ? "Your reply" : "Incoming message"}
                      </span>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{event.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
              {loading && (
                <p role="status" className="text-xs leading-relaxed text-muted">
                  Loading the local text model. Deterministic safeguards already work.
                </p>
              )}
              {error && (
                <p role="status" className="border-l-2 border-brand bg-surface-2 p-3 text-sm text-muted">
                  The text model did not load ({error}). Deterministic signals remain available.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <RiskMeter assessment={assessment} />
                <StageRail assessment={assessment} />
              </div>
              <div className="rounded-lg border border-line bg-surface p-4">
                <ModelReadout assessment={assessment} />
              </div>
              <section aria-label="Observed signals">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">What Interlock noticed</h3>
                <SignalList signals={assessment.signals} />
              </section>
              <section aria-label="Suggested safeguards">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Suggested next steps</h3>
                {assessment.safeguards.length ? (
                  <div className="space-y-3">
                    {assessment.safeguards.map((item) =>
                      <SafeguardCard key={item.id} safeguard={item} />)}
                  </div>
                ) : (
                  <p className="border border-dashed border-line bg-surface p-4 text-sm leading-relaxed text-muted">
                    No safeguards were triggered by these messages. That does not guarantee the sender is safe.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-faint">
                  These are recommendations. Interlock has not changed anything on your accounts.
                </p>
              </section>
              <div className="analyzer-panel">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink">
                  <input type="checkbox" checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="mt-1 accent-brand" />
                  I independently verified the sender through a channel I already trust.
                </label>
                <p className="mt-2 text-xs leading-relaxed text-faint">
                  Interlock can&apos;t confirm a company or phone number for you, so check through a channel you already trust.
                </p>
              </div>
              <ReceiptPanel assessment={assessment} />
              <p className="text-xs leading-relaxed text-faint">
                This is an estimate of risk, not a guarantee. It can be wrong in either direction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
