"use client";

/**
 * A live, unscripted conversation, scored as it happens.
 *
 * Two ways in. Microphone mode uses the browser's own speech recognition on
 * this device — put the call on speaker and Interlock hears both sides. Phone
 * mode is a real call: a teammate dials the Interlock number, Twilio forwards
 * it to the customer's phone and transcribes it live, and this page receives
 * each finished sentence. Either way every sentence goes through the same
 * engine as the scripted demo, recomputed from scratch, on this device.
 *
 * Nothing starts without explicit consent, including confirmation that the
 * other person on the call has been told.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAccount } from "@/components/account";
import { RiskMeter, SignalList, StageRail, ReceiptPanel } from "@/components/assessment";
import { type DraftReport, IncidentReportView } from "@/components/incident-report";
import { LiveAlert, shouldWarn, VerifyPanel } from "@/components/live-alert";
import { PhoneThread } from "@/components/phone";
import { useSettings } from "@/components/settings";
import type { CustomerAction } from "@/lib/account/types";
import { assessThread } from "@/lib/engine/killchain";
import { buildIncidentReport } from "@/lib/engine/report";
import { EXPOSURE_KINDS, type ExposureKind, type ThreadEvent, type Tier } from "@/lib/engine/types";
import { useScorer } from "@/lib/ui/use-scorer";

/* ------------------------------------------------- speech recognition types */

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
}
interface SpeechEvent {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResult };
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ----------------------------------------------------------- phone session */

interface Segment {
  seq: number;
  at: number;
  speaker: "caller" | "customer" | "system";
  kind: "speech" | "sms" | "call_start" | "call_end" | "skipped_contact" | "notice";
  text?: string;
  label?: string;
}

interface PhoneConfig {
  phoneNumber: string | null;
  twilioConfigured: boolean;
  forwardConfigured: boolean;
  armCodeRequired: boolean;
  store: { kind: "memory" | "redis"; durable: boolean };
}

function segmentToEvent(s: Segment): ThreadEvent | null {
  const id = `seg-${s.seq}`;
  switch (s.kind) {
    case "speech":
      return {
        id,
        at: s.at,
        channel: "call",
        actor: s.speaker === "customer" ? "customer" : "external",
        kind: "live_transcript",
        text: s.text,
        label: s.speaker === "customer" ? "You · heard live" : "Caller · heard live",
      };
    case "sms":
      return { id, at: s.at, channel: "sms", actor: "external", kind: "message", text: s.text, label: s.label };
    case "call_start":
      return { id, at: s.at, channel: "call", actor: "system", kind: "call_start", label: s.label };
    case "call_end":
      return { id, at: s.at, channel: "call", actor: "system", kind: "call_end" };
    default:
      return null;
  }
}

const CALLER_IDEAS = [
  "Say you are from the customer's phone company or bank, and that something is wrong with the account.",
  "Create urgency — someone is moving their number, or a charge is about to go through.",
  "Tell them not to hang up and not to go to a store, because the store can't help.",
  "Ask them to read back the six-digit code you just “sent”.",
  "If they hesitate, ask for gift cards or a payment to “secure” the account.",
  "Or play it straight — a genuine conversation should stay quiet. That's the other half of the test.",
];

const noopSubscribe = () => () => {};

type Mode = "mic" | "phone";
type Phase = "setup" | "live" | "report";

export function LiveClient() {
  const { scorer } = useScorer();
  const { locale, copy } = useSettings();
  const { account, updateConsent } = useAccount();

  const [mode, setMode] = useState<Mode>("mic");
  const [phase, setPhase] = useState<Phase>("setup");
  const [agree, setAgree] = useState({ analysis: false, notified: false, boundary: false });

  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [interim, setInterim] = useState("");
  const [partials, setPartials] = useState<{ caller?: string; customer?: string }>({});
  const [speaker, setSpeaker] = useState<"caller" | "customer">("caller");
  const [acknowledged, setAcknowledged] = useState<Tier | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [lastAction, setLastAction] = useState<CustomerAction>("none");
  const [otpRevealed, setOtpRevealed] = useState(false);
  const [showExposure, setShowExposure] = useState(false);
  const [manual, setManual] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [report, setReport] = useState<DraftReport | null>(null);
  const [showIdeas, setShowIdeas] = useState(false);

  const [micState, setMicState] = useState<"off" | "listening" | "error">("off");
  const [micError, setMicError] = useState<string | null>(null);
  // Read through an external store so the server render (no window) and the
  // first client render agree, and the real answer lands straight after.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => recognitionCtor() !== null,
    () => true,
  );

  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(null);
  const [armCode, setArmCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const [arming, setArming] = useState(false);

  const startedAt = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  const listening = useRef(false);
  const speakerRef = useRef(speaker);
  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  // Phone configuration, so the page can say honestly whether phone mode works here.
  useEffect(() => {
    let live = true;
    fetch("/api/live/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: PhoneConfig | null) => {
        if (live) setPhoneConfig(c);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);

  const assessment = useMemo(
    () => assessThread(events, { scorer, locale }),
    [events, scorer, locale],
  );
  const firstExternalText = useMemo(
    () => events.find((e) => e.actor === "external" && e.text)?.text ?? "",
    [events],
  );
  const otpHeld = assessment.safeguards.some((s) => s.id === "otp_guard" && s.severity === "intervene");
  const warn = phase === "live" && !verifyOpen && shouldWarn(assessment, acknowledged);

  const now = () => Math.max(0, Math.round((Date.now() - startedAt.current) / 1000));

  const push = useCallback((e: Omit<ThreadEvent, "id" | "at">) => {
    setEvents((xs) => [
      ...xs,
      { ...e, id: `l${xs.length}-${Date.now()}`, at: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)) },
    ]);
  }, []);

  const addSpeech = useCallback(
    (text: string, who: "caller" | "customer") => {
      const clean = text.trim();
      if (!clean) return;
      push({
        channel: "call",
        actor: who === "customer" ? "customer" : "external",
        kind: "live_transcript",
        text: clean,
        label: who === "customer" ? "You · heard live" : "Caller · heard live",
      });
    },
    [push],
  );

  /* ------------------------------------------------------------ microphone */

  const stopMic = useCallback(() => {
    listening.current = false;
    try {
      recognition.current?.abort();
    } catch {
      /* already stopped */
    }
    recognition.current = null;
    setMicState("off");
    setInterim("");
  }, []);

  const startMic = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = locale === "es" ? "es-US" : "en-US";
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i];
        if (result.isFinal) addSpeech(result[0].transcript, speakerRef.current);
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setMicError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow it in the browser's address bar, then press Resume."
          : `Speech recognition stopped (${e.error}). Press Resume, or type what was said below.`,
      );
      listening.current = false;
      setMicState("error");
    };
    // Browsers end recognition after a pause. Keep it going for as long as the session is live.
    r.onend = () => {
      if (!listening.current) return;
      try {
        r.start();
      } catch {
        setMicState("error");
      }
    };
    recognition.current = r;
    listening.current = true;
    setMicError(null);
    try {
      r.start();
      setMicState("listening");
    } catch {
      setMicState("error");
    }
  }, [addSpeech, locale]);

  useEffect(() => () => stopMic(), [stopMic]);

  /* ----------------------------------------------------------------- phone */

  const afterRef = useRef(0);
  useEffect(() => {
    if (phase !== "live" || mode !== "phone" || !sessionId) return;
    let live = true;
    const tick = async () => {
      const res = await fetch(`/api/live/sessions/${sessionId}?after=${afterRef.current}`, { cache: "no-store" }).catch(() => null);
      if (!live || !res) return;
      if (!res.ok) {
        setPhoneError(res.status === 404 ? "The live session expired." : "Lost contact with the live session. Retrying…");
        return;
      }
      setPhoneError(null);
      const data = (await res.json()) as {
        status: string;
        revoked?: boolean;
        segments: Segment[];
        partials: { caller?: string; customer?: string };
      };
      if (!live) return;
      if (data.revoked) {
        setPhoneError("Live call analysis was switched off in your privacy settings, so this session ended.");
        setSessionId(null);
        return;
      }
      if (data.segments.length) {
        afterRef.current += data.segments.length;
        const mapped = data.segments.map(segmentToEvent).filter((e): e is ThreadEvent => e !== null);
        const skipped = data.segments.filter((s) => s.kind === "skipped_contact").map((s) => s.label ?? "Skipped");
        if (mapped.length) setEvents((xs) => [...xs, ...mapped]);
        if (skipped.length) setNotices((xs) => [...xs, ...skipped]);
        if (data.segments.some((s) => s.kind === "call_end")) setCallEnded(true);
      }
      setPartials(data.partials ?? {});
    };
    const timer = setInterval(tick, 1000);
    void tick();
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [phase, mode, sessionId]);

  /* ------------------------------------------------------------- lifecycle */

  const consentOk =
    agree.analysis && agree.notified && agree.boundary && (!account || account.consent.callAnalysis);

  async function start() {
    setEvents([]);
    setNotices([]);
    setAcknowledged(null);
    setVerifyOpen(false);
    setLastAction("none");
    setOtpRevealed(false);
    setReport(null);
    setCallEnded(false);
    setPhoneError(null);
    afterRef.current = 0;
    startedAt.current = Date.now();

    if (mode === "mic") {
      setPhase("live");
      push({ channel: "call", actor: "system", kind: "call_start", label: "Unknown number · live on this device" });
      if (supported) startMic();
      return;
    }

    setArming(true);
    const res = await fetch("/api/live/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: { analysis: true, participantsNotified: true }, armCode }),
    }).catch(() => null);
    setArming(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setPhoneError(data?.error ?? "Could not start a phone session.");
      return;
    }
    const data = (await res.json()) as { session: { id: string } };
    setSessionId(data.session.id);
    setPhase("live");
  }

  async function finish(action: CustomerAction, exposure: ExposureKind | null = null) {
    stopMic();
    if (sessionId) {
      // Ending the session deletes every transcript segment the server held.
      await fetch(`/api/live/sessions/${sessionId}`, { method: "DELETE" }).catch(() => null);
      setSessionId(null);
    }
    const finalEvents: ThreadEvent[] = [...events];
    if (!finalEvents.some((e) => e.kind === "call_end")) {
      finalEvents.push({ id: "end", at: now(), channel: "call", actor: "system", kind: "call_end" });
    }
    if (exposure) {
      finalEvents.push({ id: "exp", at: now(), channel: "customer", actor: "customer", kind: "customer_report", exposure });
    }
    const verified = finalEvents.some((e) => e.kind === "out_of_band_verified");
    const finalAssessment = assessThread(finalEvents, { scorer, locale });
    setEvents(finalEvents);
    setReport(
      buildIncidentReport(finalAssessment, {
        source: mode === "phone" && !finalEvents.some((e) => e.kind === "live_transcript") ? "live_message" : "live_call",
        customerAction: exposure ? "reported_exposure" : verified && action === "ended_call" ? "verified_independently" : action,
        exposure,
        locale,
      }),
    );
    setPhase("report");
  }

  function onContinue() {
    setAcknowledged(assessment.tier);
    setLastAction("continued");
  }

  function onVerifyDone(endCall: boolean) {
    setVerifyOpen(false);
    if (endCall) {
      push({ channel: "customer", actor: "customer", kind: "out_of_band_verified" });
      void finish("verified_independently");
      return;
    }
    push({ channel: "customer", actor: "customer", kind: "out_of_band_verified" });
    setAcknowledged(null);
  }

  /* ---------------------------------------------------------------- render */

  if (phase === "report" && report) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <p className="text-sm text-muted">
          The live session has ended.{" "}
          {mode === "phone"
            ? "Every transcript segment the server held for it has been deleted."
            : "The transcript existed only in this tab and is discarded when you leave."}
        </p>
        <div className="mt-4">
          <IncidentReportView report={report} onChange={setReport} firstExternalText={firstExternalText} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPhase("setup");
              setEvents([]);
              setReport(null);
            }}
            className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white"
          >
            Start another live session
          </button>
          {account && (
            <Link href="/account" className="rounded-md border border-line px-3.5 py-2 text-sm">
              Go to my dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Live call protection</h1>
        <p className="mt-2 text-muted">
          A real, unscripted conversation, scored sentence by sentence as it happens. Have a friend
          call you and improvise — Interlock has never seen what they are about to say.
        </p>

        <div role="tablist" aria-label="How to listen" className="mt-6 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["mic", "This device's microphone", "Put the call on speaker next to this laptop or phone. Works in Chrome, Edge and Safari."],
              ["phone", "A real phone call", "Your friend dials the Interlock number; it rings through to your phone and is transcribed live."],
            ] as const
          ).map(([m, title, body]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-card border p-4 text-left transition-colors ${
                mode === m ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{body}</span>
            </button>
          ))}
        </div>

        {mode === "mic" && !supported && (
          <p className="mt-4 rounded-md border border-dashed border-line bg-surface-2 p-3 text-sm">
            This browser has no built-in speech recognition (Firefox does not). You can still run a
            session and type what the caller says, or open this page in Chrome, Edge or Safari.
          </p>
        )}

        {mode === "phone" && phoneConfig && (
          <div className="mt-4 rounded-card border border-line bg-surface p-4 text-sm">
            {phoneConfig.twilioConfigured && phoneConfig.phoneNumber ? (
              <p>
                Demo number: <strong className="font-mono text-base">{phoneConfig.phoneNumber}</strong>.
                Once you start, the next call to it is forwarded to your phone and analysed live.
                Texts to the same number appear too.
              </p>
            ) : (
              <p>
                Phone mode is not configured on this deployment (it needs a Twilio number and the
                environment variables in the README). Use microphone mode instead.
              </p>
            )}
            {phoneConfig.twilioConfigured && !phoneConfig.store.durable && (
              <p className="mt-2 text-xs text-muted">
                Warning: no shared store is configured, so on serverless hosting the call and this
                page may not see each other. Connect Redis before relying on phone mode.
              </p>
            )}
            {phoneConfig.armCodeRequired && (
              <label className="mt-3 block">
                <span className="text-xs font-medium text-muted">Demo arm code</span>
                <input
                  value={armCode}
                  onChange={(e) => setArmCode(e.target.value)}
                  className="mt-1 block w-40 rounded-md border border-line bg-surface px-2 py-1.5 font-mono"
                  autoComplete="off"
                />
              </label>
            )}
          </div>
        )}

        <fieldset className="mt-6 rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Before we listen</legend>
          {account && !account.consent.callAnalysis && (
            <div className="mb-3 rounded-md bg-surface-2 p-3 text-sm">
              <p>Live call analysis is <strong>off</strong> in your privacy settings.</p>
              <button
                type="button"
                onClick={() => void updateConsent({ callAnalysis: true }, true)}
                className="mt-2 rounded-md border border-brand px-2.5 py-1 text-sm font-medium text-brand"
              >
                Turn on live call analysis
              </button>
              <span className="ml-2 text-xs text-muted">You can turn it off again at any time in Privacy.</span>
            </div>
          )}
          <div className="space-y-3 text-sm">
            <label className="flex gap-2.5">
              <input type="checkbox" className="mt-1" checked={agree.analysis} onChange={(e) => setAgree({ ...agree, analysis: e.target.checked })} />
              <span>
                I want Interlock to turn speech on this call into text and check it for scam warning
                signs, only until I end the session.
              </span>
            </label>
            <label className="flex gap-2.5">
              <input type="checkbox" className="mt-1" checked={agree.notified} onChange={(e) => setAgree({ ...agree, notified: e.target.checked })} />
              <span>
                Everyone on this call knows it is being analysed and has agreed.{" "}
                <span className="text-muted">Some states require every participant&apos;s consent.</span>
              </span>
            </label>
            <label className="flex gap-2.5">
              <input type="checkbox" className="mt-1" checked={agree.boundary} onChange={(e) => setAgree({ ...agree, boundary: e.target.checked })} />
              <span>
                {mode === "mic"
                  ? "I understand my browser does the speech-to-text, and some browsers (Chrome, for example) send the audio to their own speech service to do it. Interlock itself receives no audio."
                  : "I understand Twilio, the phone provider, transcribes the call and sends Interlock the text. No recording is made, and the text is deleted when I end the session."}
              </span>
            </label>
          </div>
          <p className="mt-3 text-xs text-muted">
            In a full product this only runs for numbers that are not in your contacts. Do not say
            real passwords, codes or card numbers during a demo. <Link href="/privacy" className="underline">Full privacy notice</Link>
          </p>
        </fieldset>

        {phoneError && <p className="mt-3 text-sm" style={{ color: "var(--tier-critical)" }}>{phoneError}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={!consentOk || arming || (mode === "phone" && !phoneConfig?.twilioConfigured)}
            className="rounded-md bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-40"
          >
            {arming ? "Starting…" : mode === "mic" ? "Start listening" : "Arm the demo number"}
          </button>
          {!account && (
            <span className="text-sm text-muted">
              <Link href="/signin?next=/live" className="underline">Sign in</Link> to save reports to your account.
            </span>
          )}
        </div>

        <section className="mt-8 rounded-card border border-dashed border-line p-4">
          <button type="button" onClick={() => setShowIdeas(!showIdeas)} aria-expanded={showIdeas} className="text-sm font-medium underline underline-offset-4">
            {showIdeas ? "Hide" : "Show"} ideas for the person playing the caller
          </button>
          {showIdeas && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {CALLER_IDEAS.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------- live
  const waitingForCall = mode === "phone" && !events.some((e) => e.kind === "call_start" || e.kind === "message");
  const pendingLine = mode === "mic" ? interim : partials.caller ?? partials.customer ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium" style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}>
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--tier-critical)" }} />
          Live analysis on
        </span>
        <span className="text-sm text-muted">
          {mode === "mic"
            ? micState === "listening"
              ? "Listening through this device's microphone."
              : supported
                ? "Microphone paused."
                : "Type what you hear — this browser has no speech recognition."
            : waitingForCall
              ? `Waiting for a call or text to ${phoneConfig?.phoneNumber ?? "the demo number"}…`
              : callEnded
                ? "The call has ended."
                : "Call in progress — transcribed live by Twilio."}
        </span>
        <button
          type="button"
          onClick={() => void finish(lastAction === "continued" ? "continued" : "ended_call")}
          className="ml-auto rounded-md px-3.5 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--tier-critical)" }}
        >
          {callEnded ? "See my report" : "End call & stop listening"}
        </button>
      </div>

      {(micError || phoneError) && (
        <p className="mb-4 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}>
          {micError ?? phoneError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <PhoneThread
            events={events}
            otpHeld={otpHeld}
            otpRevealed={otpRevealed}
            onRevealOtp={() => setOtpRevealed(true)}
            emptyText={waitingForCall ? "Waiting for the call to connect…" : "Start talking. Each finished sentence appears here and is scored on this device."}
          />
          <p className="mt-2 min-h-[1.5rem] px-1 text-sm italic text-muted" aria-live="off">
            {pendingLine ? `“${pendingLine}”` : ""}
          </p>

          {mode === "mic" && (
            <div className="mt-2 space-y-2">
              <div role="group" aria-label="Who is speaking" className="flex items-center gap-1 rounded-md border border-line p-0.5 text-sm">
                <span className="px-2 text-xs text-muted">Speaking now:</span>
                {(["caller", "customer"] as const).map((who) => (
                  <button
                    key={who}
                    type="button"
                    aria-pressed={speaker === who}
                    onClick={() => setSpeaker(who)}
                    className={`flex-1 rounded px-2 py-1 ${speaker === who ? "bg-brand-soft font-medium text-brand" : "text-muted"}`}
                  >
                    {who === "caller" ? "The caller" : "Me"}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-snug text-faint">
                One microphone hears both sides. Only the caller&apos;s words are scored, so switch
                to “Me” while you answer — or leave it on the caller and let the engine ignore
                negations like “I won&apos;t give you that code”.
              </p>
              {supported && micState !== "listening" && (
                <button type="button" onClick={startMic} className="rounded-md border border-line px-3 py-1.5 text-sm">
                  Resume microphone
                </button>
              )}
            </div>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSpeech(manual, speaker);
              setManual("");
            }}
          >
            <label htmlFor="manual" className="sr-only">Type what was said</label>
            <input
              id="manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={`Type what ${speaker === "caller" ? "the caller" : "you"} said…`}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
              autoComplete="off"
            />
            <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm">Add</button>
          </form>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => push({ channel: "sms", actor: "system", kind: "otp_received", otpIssuer: "Your phone company (simulated)" })}
              className="w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              A security code just arrived by text
              <span className="mt-0.5 block text-xs text-faint">
                Simulated. Shows OTP Guard: a code arriving during a call with an unknown number is held.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowExposure(!showExposure)}
              aria-expanded={showExposure}
              className="w-full rounded-md border px-3 py-2 text-left text-sm"
              style={{ borderColor: "var(--tier-critical)", color: "var(--tier-critical)" }}
            >
              I think I already shared something
            </button>
            {showExposure && (
              <fieldset className="rounded-card border border-line bg-surface p-3">
                <legend className="px-1 text-xs font-semibold text-muted">What do you think you shared?</legend>
                <div className="grid gap-1">
                  {EXPOSURE_KINDS.map((kind) => (
                    <button key={kind} type="button" onClick={() => void finish("reported_exposure", kind)} className="rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                      {copy.exposures[kind]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {notices.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {notices.map((n, i) => (
                <li key={`${n}-${i}`}>• {n}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {warn && (
            <LiveAlert
              assessment={assessment}
              onEnd={() => void finish("ended_call")}
              onVerify={() => setVerifyOpen(true)}
              onContinue={onContinue}
            />
          )}
          {verifyOpen && <VerifyPanel onDone={onVerifyDone} />}
          {!warn && !verifyOpen && acknowledged && (
            <p className="rounded-card border border-dashed border-line bg-surface p-3 text-sm text-muted">
              You chose to keep talking. We will warn you again if the risk goes up.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <RiskMeter assessment={assessment} />
            <StageRail assessment={assessment} />
          </div>
          <section aria-label="Observed signals">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Why</h2>
            <SignalList signals={assessment.signals} />
          </section>
          <ReceiptPanel assessment={assessment} />
        </div>
      </div>
    </div>
  );
}
