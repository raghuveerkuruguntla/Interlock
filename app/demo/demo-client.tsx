"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ModelReadout,
  ReceiptPanel,
  RiskMeter,
  SafeguardCard,
  SignalList,
  StageRail,
} from "@/components/assessment";
import { Composer, PhoneThread } from "@/components/phone";
import { useSettings } from "@/components/settings";
import { DEMO_THREADS, type DemoThread } from "@/lib/data/hero";
import { assessThread } from "@/lib/engine/killchain";
import { signatureOf, type CampaignMatch } from "@/lib/engine/signature";
import { EXPOSURE_KINDS, type ExposureKind, type Safeguard, type ThreadEvent } from "@/lib/engine/types";
import { useScorer } from "@/lib/ui/use-scorer";

interface CorpusScenario {
  id: string;
  familyLabel: string;
  split: string;
  label: string;
  events: ThreadEvent[];
}

interface CorpusPair {
  pairId: string;
  familyLabel: string;
  split: string;
  identicalOpening: boolean;
  opening: string;
  scamId: string;
  benignId: string;
}

const STEP_MS = 1700;

export function DemoClient() {
  const { scorer, loading, error } = useScorer();
  const { copy, locale } = useSettings();

  const [thread, setThread] = useState<DemoThread>(DEMO_THREADS[0]);
  const [cursor, setCursor] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [extra, setExtra] = useState<ThreadEvent[]>([]);
  const [otpRevealed, setOtpRevealed] = useState(false);
  const [campaign, setCampaign] = useState<CampaignMatch | null>(null);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [showExposure, setShowExposure] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [corpus, setCorpus] = useState<{ pairs: CorpusPair[]; scenarios: CorpusScenario[] } | null>(
    null,
  );
  const [showTruth, setShowTruth] = useState(false);

  const events = useMemo(
    () => [...thread.events.slice(0, cursor), ...extra],
    [thread, cursor, extra],
  );

  const firstExternalText = useMemo(
    () => events.find((e) => e.actor === "external" && e.text)?.text ?? "",
    [events],
  );

  // A campaign match only means anything while there is a message to match.
  const activeCampaign = firstExternalText ? campaign : null;

  const assessment = useMemo(
    () =>
      assessThread(events, {
        scorer,
        locale,
        campaign: activeCampaign,
        reportingConsent: reportState === "sent",
      }),
    [events, scorer, locale, activeCampaign, reportState],
  );

  const atEnd = cursor >= thread.events.length;

  // Playback ------------------------------------------------------------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing || atEnd) return;
    // Both state writes happen in the timeout callback rather than the effect
    // body, so reaching the end of a thread stops playback without cascading
    // an extra render on every tick.
    timer.current = setTimeout(() => {
      const next = cursor + 1;
      setCursor(next);
      if (next >= thread.events.length) setPlaying(false);
    }, STEP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, cursor, atEnd, thread.events.length]);

  const reset = useCallback((next?: DemoThread) => {
    setPlaying(false);
    setCursor(1);
    setExtra([]);
    setOtpRevealed(false);
    setCampaign(null);
    setReportState("idle");
    setShowExposure(false);
    setShowTruth(false);
    if (next) setThread(next);
  }, []);

  // Campaign lookup ------------------------------------------------------
  // Only a signature goes to the server. This is the one request the detection
  // path makes, and it carries no text.
  useEffect(() => {
    // The empty case is derived rather than written back as state — setting
    // state synchronously here would cascade a render on every thread change.
    if (!firstExternalText) return;
    const signature = signatureOf(firstExternalText);
    let live = true;
    fetch(`/api/campaigns?signature=${signature}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { match: CampaignMatch | null } | null) => {
        if (live) setCampaign(data?.match ?? null);
      })
      .catch(() => {
        if (live) setCampaign(null);
      });
    return () => {
      live = false;
    };
  }, [firstExternalText]);

  // Actions --------------------------------------------------------------
  const lastAt = events.length ? events[events.length - 1].at : 0;

  const append = useCallback(
    (event: Omit<ThreadEvent, "id" | "at">) => {
      setExtra((xs) => [
        ...xs,
        { ...event, id: `x${xs.length}-${Date.now()}`, at: lastAt + 30 * (xs.length + 1) },
      ]);
    },
    [lastAt],
  );

  const sendMessage = useCallback(
    (text: string) => {
      setPlaying(false);
      append({ channel: "sms", actor: "external", kind: "message", text, label: copy.demo.typedLive });
    },
    [append, copy.demo.typedLive],
  );

  const markVerified = useCallback(() => {
    append({ channel: "customer", actor: "customer", kind: "out_of_band_verified" });
  }, [append]);

  const openRecovery = useCallback(
    (exposure: ExposureKind) => {
      setShowExposure(false);
      append({ channel: "customer", actor: "customer", kind: "customer_report", exposure });
    },
    [append],
  );

  const reportToNetwork = useCallback(async () => {
    if (!firstExternalText) return;
    setReportState("sending");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature: signatureOf(firstExternalText),
          stage: assessment.stage,
          tier: assessment.tier,
          family: "Other",
        }),
      });
      setReportState(res.ok ? "sent" : "failed");
      if (res.ok) {
        const data = (await res.json()) as { campaign: CampaignMatch["campaign"] };
        setCampaign({ campaign: data.campaign, distance: 0, confidence: 1 });
      }
    } catch {
      setReportState("failed");
    }
  }, [firstExternalText, assessment.stage, assessment.tier]);

  const onSafeguardAction = useCallback(
    (safeguard: Safeguard) => {
      switch (safeguard.action?.kind) {
        case "reveal_code":
          setOtpRevealed(true);
          break;
        case "dial_verified_number":
        case "mark_verified":
          markVerified();
          break;
        case "open_recovery":
          setShowExposure(true);
          break;
        default:
          break;
      }
    },
    [markVerified],
  );

  // Corpus library -------------------------------------------------------
  const openLibrary = useCallback(() => {
    setShowLibrary(true);
    if (corpus) return;
    fetch("/data/corpus.json")
      .then((r) => r.json())
      .then((data: { pairs: CorpusPair[]; scenarios: CorpusScenario[] }) => setCorpus(data))
      .catch(() => setCorpus({ pairs: [], scenarios: [] }));
  }, [corpus]);

  const loadCorpusScenario = useCallback(
    (id: string, title: string, truth: "scam" | "legitimate") => {
      const scenario = corpus?.scenarios.find((s) => s.id === id);
      if (!scenario) return;
      setShowLibrary(false);
      reset({
        id: scenario.id,
        title,
        summary: `${scenario.familyLabel} · ${scenario.split} split · corpus scenario ${scenario.id}`,
        truth,
        events: scenario.events,
      });
    },
    [corpus, reset],
  );

  const otpGuardActive = assessment.safeguards.some(
    (s) => s.id === "otp_guard" && s.severity === "intervene",
  );

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header className="mb-9">
        <p className="section-kicker">INTERACTIVE PROTECTION LAB</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-ink sm:text-5xl">
          Watch protection in action.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          Replay a fictional scam conversation, message by message. Interlock evaluates
          only the events revealed so far, explains its assessment, and recommends
          safeguards as new risks appear.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">◉ Locally computed assessment</span>
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">✧ Synthetic scenarios only</span>
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">↗ No real account changes</span>
        </div>
      </header>

      {/* Thread picker */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
        {DEMO_THREADS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => reset(t)}
            aria-pressed={thread.id === t.id}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              thread.id === t.id
                ? "border-brand bg-brand-soft font-medium text-brand"
                : "border-line text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t.title}
          </button>
        ))}
        <button
          type="button"
          onClick={openLibrary}
          className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
        >
          336 corpus threads…
        </button>
      </div>

      <p className="mb-5 max-w-3xl text-sm text-muted">{thread.summary}</p>

      {error && (
        <p
          className="mb-5 rounded-card border px-4 py-3 text-sm"
          style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}
        >
          The scoring model could not be loaded ({error}). The deterministic safeguards below
          still work — they never needed it.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- phone */}
        <div className="demo-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-brand">CUSTOMER VIEW</p><h2 className="mt-1 text-base font-semibold tracking-tight text-ink">Conversation</h2></div>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand">SIMULATED</span>
          </div>
          <PhoneThread
            events={events}
            otpHeld={otpGuardActive}
            otpRevealed={otpRevealed}
            onRevealOtp={() => setOtpRevealed(true)}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              disabled={atEnd && !playing}
              className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {playing ? copy.demo.pause : atEnd ? copy.demo.finished : copy.demo.play}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setCursor((c) => Math.min(c + 1, thread.events.length));
              }}
              disabled={atEnd}
              className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-40"
            >
              {copy.demo.step}
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              {copy.demo.restart}
            </button>
            <span className="ml-auto font-mono text-xs text-faint">
              {Math.min(cursor, thread.events.length)}/{thread.events.length}
              {extra.length > 0 && ` +${extra.length}`}
            </span>
          </div>

          <Composer onSend={sendMessage} disabled={loading} />

          <p className="mt-2 text-xs leading-snug text-faint">
            {copy.demo.composerNote}
          </p>

          {/* Customer actions */}
          <div className="mt-5 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {copy.demo.whatYouCanDo}
            </h2>
            <button
              type="button"
              onClick={markVerified}
              className="w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              {copy.demo.verifyAction}
              <span className="mt-0.5 block text-xs text-faint">{copy.demo.verifyHint}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExposure(!showExposure)}
              aria-expanded={showExposure}
              className="w-full rounded-md border px-3 py-2 text-left text-sm"
              style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}
            >
              {copy.safeguards.recoveryMode.action}
              <span className="mt-0.5 block text-xs" style={{ color: "var(--text-faint)" }}>
                {copy.demo.recoveryHint}
              </span>
            </button>

            {showExposure && (
              <fieldset className="rounded-card border border-line bg-surface p-3">
                <legend className="px-1 text-xs font-semibold text-muted">
                  {copy.demo.exposureLegend}
                </legend>
                <div className="mt-1 grid gap-1">
                  {EXPOSURE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => openRecovery(kind)}
                      className="rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      {copy.exposures[kind]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-1 text-xs leading-snug text-faint">
                  {copy.demo.exposureNote}
                </p>
              </fieldset>
            )}

            <button
              type="button"
              onClick={reportToNetwork}
              disabled={reportState === "sending" || !firstExternalText}
              className="w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              {reportState === "sent"
                ? copy.demo.reportSent
                : reportState === "failed"
                  ? copy.demo.reportFailed
                  : copy.demo.reportAction}
              <span className="mt-0.5 block font-mono text-xs text-faint">
                sends: {firstExternalText ? signatureOf(firstExternalText) : "…"} · {assessment.stage} ·{" "}
                {assessment.tier}
              </span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------- engine */}
        <div className="space-y-4">
          <div className="mb-1 flex items-center justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-brand">INTERLOCK ENGINE</p><h2 className="mt-1 text-base font-semibold tracking-tight text-ink">Live protection assessment</h2></div><span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-muted">Updates each step</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RiskMeter assessment={assessment} />
            <StageRail assessment={assessment} />
          </div>

          <div className="rounded-card border border-line bg-surface px-4 py-3">
            <ModelReadout assessment={assessment} />
          </div>

          <section aria-label="Safeguards">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {copy.demo.safeguardsInPlay}
            </h2>
            {assessment.safeguards.length === 0 ? (
              <p className="rounded-card border border-dashed border-line bg-surface p-4 text-sm text-muted">
                {copy.demo.nothingFired}
              </p>
            ) : (
              <div className="space-y-3">
                {assessment.safeguards.map((s) => (
                  <SafeguardCard key={s.id} safeguard={s} onAction={onSafeguardAction} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Observed signals">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {copy.ui.whyLabel}
            </h2>
            <SignalList signals={assessment.signals} />
          </section>

          <ReceiptPanel assessment={assessment} />

          {/* The answer key, kept visibly separate from everything above. */}
          <section className="rounded-card border border-dashed border-line bg-surface-2 p-4">
            <button
              type="button"
              onClick={() => setShowTruth(!showTruth)}
              aria-expanded={showTruth}
              className="text-sm font-medium text-muted underline underline-offset-4"
            >
              {showTruth ? "Hide" : "Show"} the answer key for this thread
            </button>
            {showTruth && (
              <div className="mt-2 text-sm">
                <p>
                  Hindsight label:{" "}
                  <strong className="text-ink">{thread.truth}</strong>
                  {thread.goal && (
                    <>
                      {" "}
                      · attacker goal: <span className="text-ink">{thread.goal}</span>
                    </>
                  )}
                </p>
                <p className="mt-1.5 text-faint">
                  This label was never given to the engine. The corpus keeps hindsight labels
                  and observable events in separate columns precisely so they cannot leak into
                  a decision, and the engine is only ever handed the events.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Corpus library */}
      {showLibrary && (
        <div className="mt-8 rounded-card border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Matched counterfactual pairs</h2>
            <button
              type="button"
              onClick={() => setShowLibrary(false)}
              className="rounded-md border border-line px-2.5 py-1 text-sm"
            >
              Close
            </button>
          </div>
          <p className="mb-4 max-w-3xl text-sm text-muted">
            Each row is two threads whose first message is byte-identical: one ends in a
            fraudulent request, the other in legitimate guidance. Load either side and watch
            where they diverge. All 160 pairs in the corpus share an opening.
          </p>
          {!corpus ? (
            <p className="text-sm text-muted">Loading the corpus…</p>
          ) : (
            <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
              {corpus.pairs.slice(0, 60).map((pair) => (
                <li
                  key={pair.pairId}
                  className="rounded-md border border-line px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                      {pair.familyLabel}
                    </span>
                    <span className="text-xs text-faint">{pair.split}</span>
                    <span className="ml-auto flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          loadCorpusScenario(pair.scamId, `${pair.familyLabel} — attack`, "scam")
                        }
                        className="rounded border px-2 py-0.5 text-xs"
                        style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}
                      >
                        Attack
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          loadCorpusScenario(
                            pair.benignId,
                            `${pair.familyLabel} — legitimate`,
                            "legitimate",
                          )
                        }
                        className="rounded border px-2 py-0.5 text-xs"
                        style={{ borderColor: "var(--ok)", color: "var(--ok)" }}
                      >
                        Legitimate
                      </button>
                    </span>
                  </div>
                  <p className="mt-1.5 text-muted">“{pair.opening}”</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
