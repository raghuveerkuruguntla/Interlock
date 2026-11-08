"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { combineDemoEvents, type InsertedEvent } from "@/lib/ui/demo-timeline";

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
  const [extra, setExtra] = useState<InsertedEvent[]>([]);
  const [inputRole, setInputRole] = useState<"external" | "customer">("external");
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [runId, setRunId] = useState(0);
  const [holdAcknowledged, setHoldAcknowledged] = useState(false);
  const [showSafePeek, setShowSafePeek] = useState(false);
  const [otpRevealed, setOtpRevealed] = useState(false);
  const [campaign, setCampaign] = useState<{ signature: string; match: CampaignMatch | null } | null>(null);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [showExposure, setShowExposure] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [corpus, setCorpus] = useState<{ pairs: CorpusPair[]; scenarios: CorpusScenario[] } | null>(
    null,
  );
  const [showTruth, setShowTruth] = useState(false);

  const events = useMemo(
    () => combineDemoEvents(thread.events, cursor, extra),
    [thread, cursor, extra],
  );

  const sharedUrls = useMemo(() => {
    const links = events
      .filter((event) => event.actor === "external" && event.text)
      .flatMap((event) => (event.text?.match(/https?:\/\/[^\s<>"']+/g) ?? [])
        .map((url) => url.replace(/[).,!?;]+$/, "")));
    return [...new Set(links)].slice(0, 5);
  }, [events]);

  const firstExternalText = useMemo(
    () => events.find((e) => e.actor === "external" && e.text)?.text ?? "",
    [events],
  );

  // A campaign match only means anything while there is a message to match.
  const activeCampaign = firstExternalText && campaign?.signature === signatureOf(firstExternalText)
    ? campaign.match : null;

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

  const isCustomThread = thread.id === "CUSTOM-THREAD";
  const hasScriptedEvents = thread.events.length > 0;
  const atEnd = hasScriptedEvents && cursor >= thread.events.length;

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
    }, STEP_MS / speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, cursor, atEnd, thread.events.length, speed]);

  const reset = useCallback((next?: DemoThread) => {
    setPlaying(false);
    setCursor((next ?? thread).events.length > 0 ? 1 : 0);
    setRunId((id) => id + 1);
    setExtra([]);
    setOtpRevealed(false);
    setCampaign(null);
    setReportState("idle");
    setShowExposure(false);
    setShowTruth(false);
    setHoldAcknowledged(false);
    setShowSafePeek(false);
    setInputRole("external");
    if (next) setThread(next);
  }, [thread]);

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
        if (live) setCampaign({ signature, match: data?.match ?? null });
      })
      .catch(() => {
        if (live) setCampaign({ signature, match: null });
      });
    return () => {
      live = false;
    };
  }, [firstExternalText]);

  // Actions --------------------------------------------------------------
  const append = useCallback(
    (event: Omit<ThreadEvent, "id" | "at">) => {
      setPlaying(false);
      setExtra((items) => {
        const anchor = thread.events[Math.max(0, cursor - 1)]?.at ?? 0;
        const ordinal = items.filter((item) => item.after === cursor).length + 1;
        const nextAt = anchor + ordinal * 0.001;
        return [...items, {
          after: cursor,
          event: { ...event, id: `manual-${cursor}-${items.length}`, at: nextAt },
        }];
      });
    },
    [cursor, thread.events],
  );

  const sendMessage = useCallback(
    (text: string) => {
      append({
        channel: inputRole === "external" ? "sms" : "customer",
        actor: inputRole,
        kind: "message",
        text,
        label: inputRole === "external" ? "Message you entered · analyzed" : "Your reply",
      });
    },
    [append, inputRole],
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
        setCampaign({
          signature: signatureOf(firstExternalText),
          match: { campaign: data.campaign, distance: 0, confidence: 1 },
        });
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
        case "hold_action":
          setHoldAcknowledged(true);
          break;
        case "allow_action":
          setHoldAcknowledged(true);
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

  const recoveryStarted = assessment.recoveryActive;
  const progressPercent = hasScriptedEvents ? Math.round((cursor / thread.events.length) * 100) : 0;
  const isFullArc = thread.events.some((event) => event.kind === "account_action_requested");

  const otpGuardActive = assessment.safeguards.some(
    (s) => s.id === "otp_guard" && s.severity === "intervene",
  );

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header className="mb-9" data-reveal>
        <p className="section-kicker">THE INTERACTIVE LAB / 01</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-ink sm:text-5xl">
          See the moment it changes.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          Play a complete simulated attack, inspect each intervention, or enter a message
          of your own. Every assessment comes from the events visible on screen.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">◉ Locally computed assessment</span>
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">✧ Synthetic scenarios only</span>
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">↗ No real account changes</span>
        </div>
      </header>

      {/* Thread picker */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
        {DEMO_THREADS.map((t, index) => (
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
            {t.title}{index === 0 ? " · Full walkthrough" : ""}
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
        <div className="demo-panel" data-reveal>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-brand">CUSTOMER VIEW</p><h2 className="mt-1 text-base font-semibold tracking-tight text-ink">Conversation</h2></div>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand">SIMULATED</span>
          </div>
          <PhoneThread
            key={`${thread.id}-${runId}-${events.some((event) => event.kind === "otp_received") ? "otp" : "pre"}`}
            events={events}
            otpHeld={otpGuardActive}
            otpRevealed={otpRevealed}
            onRevealOtp={() => setOtpRevealed(true)}
          />

          <div className="mt-4">
            {isCustomThread && (
              <p className="mb-4 border-l-2 border-brand bg-surface-2 px-3 py-3 text-sm leading-relaxed text-muted">
                An empty conversation with no inherited risk. Enter a fictional message below
                to see how the live scoring engine evaluates it.
              </p>
            )}
            {hasScriptedEvents && (
              <>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>Scenario progress</span>
              <span className="font-mono tabular-nums">{cursor} / {thread.events.length} events</span>
            </div>
            <input
              type="range" min={1} max={thread.events.length} value={cursor}
              aria-label="Scrub scenario progress"
              onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }}
              className="demo-scrubber w-full"
              style={{ background: `linear-gradient(to right, var(--brand) 0 ${progressPercent}%, var(--surface-3) ${progressPercent}% 100%)` }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (atEnd) { reset(); setPlaying(true); }
                  else setPlaying(!playing);
                }}
                className="demo-play-button"
              >
                <span aria-hidden="true">{atEnd ? "↺" : playing ? "Ⅱ" : "▶"}</span>
                {atEnd ? "Replay story" : playing ? "Pause" : "Play story"}
              </button>
              <button
                type="button"
                onClick={() => { setPlaying(false); setCursor((c) => Math.min(c + 1, thread.events.length)); }}
                disabled={atEnd}
                className="demo-subtle-button disabled:opacity-40"
              >Next event →</button>
              <button type="button" onClick={() => reset()} className="demo-subtle-button">Reset</button>
              <button
                type="button" onClick={() => setSpeed(speed === 1 ? 2 : 1)}
                className="demo-speed-button ml-auto" aria-label={`Playback speed ${speed} times`}
              >{speed}×</button>
            </div>
              </>
            )}
            {!hasScriptedEvents && (
              <button type="button" className="demo-subtle-button" onClick={() => reset()}>
                Clear conversation ↺
              </button>
            )}
          </div>

          <div className="mt-7 border-t border-line pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Test your own message</h3>
              <span className="text-[11px] text-faint">Local scoring</span>
            </div>
            <div role="group" aria-label="Select message author" className="demo-input-role mb-3 flex gap-1 rounded-lg bg-surface-2 p-1">
              <button type="button" aria-pressed={inputRole === "external"}
                onClick={() => setInputRole("external")}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${inputRole === "external" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                Incoming message
              </button>
              <button type="button" aria-pressed={inputRole === "customer"}
                onClick={() => setInputRole("customer")}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${inputRole === "customer" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                Your reply
              </button>
            </div>
            <Composer onSend={sendMessage} disabled={false} />
            <p className="mt-2 text-xs leading-relaxed text-faint">
              {loading && !error ? "Loading local text model. Deterministic signals already work. " : ""}
              Incoming messages are analyzed as an external sender. Replies appear as yours and
              do not count as evidence against the sender. Pause the story and add either at any point.
            </p>
          </div>

          {atEnd && (
            <section aria-label="Scenario complete" className="demo-completion rise mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Story complete</p>
              <h3 className="mt-2 text-lg font-semibold">
                {recoveryStarted ? "Recovery guidance is active." : isFullArc ? "Now decide what happens next." : "You reached the end of this conversation."}
              </h3>
              <p className="mt-2 text-sm leading-relaxed">
                {recoveryStarted
                  ? "Explore the recovery guidance in the assessment panel, or replay another scenario."
                  : isFullArc
                    ? "Interlock recognized the account-change attempt. Try the recovery flow, or replay to compare the warnings along the way."
                    : "Try a different scenario, or enter your own message to see how the risk assessment changes."}
              </p>
              {isFullArc && !recoveryStarted && (
                <button type="button" onClick={() => setShowExposure(true)} className="mt-4 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bg">
                  Start simulated recovery →
                </button>
              )}
            </section>
          )}
          {reportState === "sent" && (
            <Link href="/network" className="mt-3 inline-flex text-sm font-semibold text-brand underline underline-offset-4">Explore the simulated campaign network ↗</Link>
          )}
          {holdAcknowledged && (
            <p role="status" className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted">
              The proposed account-change pause has been acknowledged. This is simulated; no real account was changed.
            </p>
          )}

          {sharedUrls.length > 0 && (
            <section className="mt-5 border border-line bg-surface-2 p-4" aria-label="Safe link inspection">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Link inspection</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">
                    This conversation contains {sharedUrls.length === 1 ? "a link" : "links"}.
                  </p>
                </div>
                <button type="button" onClick={() => setShowSafePeek(!showSafePeek)}
                  aria-expanded={showSafePeek} className="demo-subtle-button shrink-0">
                  {showSafePeek ? "Hide" : "Inspect"} →
                </button>
              </div>
              {showSafePeek && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  {sharedUrls.map((url) => {
                    let host = "Unrecognized destination";
                    try { host = new URL(url).hostname; } catch { /* Display fallback */ }
                    return (
                      <div key={url} className="rounded border border-line bg-surface p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Destination shown in message</p>
                        <p className="mt-1 break-all font-mono text-sm text-ink">{host}</p>
                        <p className="mt-2 text-xs leading-relaxed text-muted">
                          Not opened or verified against an official brand registry.
                          Go to the company&apos;s official app or type its known address yourself.
                        </p>
                      </div>
                    );
                  })}
                  <p className="text-xs leading-relaxed text-faint">
                    Safe Peek is a local URL display, not a live website scan.
                    Interlock will not navigate to these destinations.
                  </p>
                </div>
              )}
            </section>
          )}

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
        <div className="space-y-4" data-reveal>
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
          {thread.truth !== "unknown" && <section className="rounded-card border border-dashed border-line bg-surface-2 p-4">
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
          </section>}
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
