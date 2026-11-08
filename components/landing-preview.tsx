import Link from "next/link";

/**
 * An intentionally illustrative product preview.
 * Unlike /demo, this is not a live engine readout and must never be
 * presented as a measured verdict or a carrier-integrated safeguard.
 */
export function LandingPreview() {
  return (
    <div className="preview-stage" aria-label="Illustrative preview of Interlock protecting a fictional conversation">
      <div className="preview-glow" aria-hidden="true" />
      <div className="preview-card">
        <div className="preview-topline">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span className="preview-logo" aria-hidden="true">✳</span>
            Interlock <span className="font-normal text-faint">/ protection</span>
          </span>
          <span className="preview-status"><span className="preview-status-dot" />Illustrative preview</span>
        </div>

        <div className="preview-thread">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-muted">?</span>
            <div>
              <p className="text-sm font-semibold text-ink">Unknown sender</p>
              <p className="text-xs text-faint">Text message · simulated conversation</p>
            </div>
            <span className="ml-auto rounded-full border border-line bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">SMS</span>
          </div>

          <div className="space-y-3 px-4 py-5 sm:px-5">
            <div className="preview-bubble preview-bubble-them">
              Your phone number will be suspended in 15 minutes. Verify your account now.
            </div>
            <div className="preview-bubble preview-bubble-you">
              Can I call customer support first?
            </div>
            <div className="preview-bubble preview-bubble-them">
              Do not call support. Just send me the code you received.
            </div>
          </div>
        </div>

        <div className="preview-alert" role="group" aria-label="Illustrative warning">
          <div className="flex items-start gap-3">
            <span className="preview-alert-icon" aria-hidden="true">!</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">This conversation looks suspicious</p>
                <span className="preview-alert-pill">High risk pattern</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                The sender created urgency, discouraged verification, and asked for a one-time code.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="preview-signal">Time pressure</span>
                <span className="preview-signal">Isolation</span>
                <span className="preview-signal">Code request</span>
              </div>
            </div>
          </div>
        </div>

        <div className="preview-safe-step">
          <span className="preview-safe-icon" aria-hidden="true">✓</span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted">A safer next step</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-ink">
              Contact your carrier through its official app or published support number.
            </p>
          </div>
        </div>
        <div className="preview-footer">
          <span>No real account or message was accessed.</span>
          <Link href="/demo" className="font-semibold text-brand hover:underline">
            Try the actual engine <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <div className="preview-float preview-float-left" aria-hidden="true">
        <span className="preview-float-dot" /> Context matters more than one message
      </div>
      <div className="preview-float preview-float-right" aria-hidden="true">
        <span className="text-base">✦</span> Local-first analysis
      </div>
    </div>
  );
}
