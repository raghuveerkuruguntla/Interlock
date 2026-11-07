"use client";

/**
 * The evidence charts.
 *
 * Each one exists to answer a question a judge will actually ask, and each one
 * ships a table view, because the honest version of "here is our accuracy" is
 * one you can read the numbers off.
 */

import { useId, useState } from "react";

export function StatTile({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "var(--ok)" : tone === "warn" ? "var(--tier-elevated)" : "var(--text)";
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </p>
      {note && <p className="mt-1.5 text-xs leading-snug text-faint">{note}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- reliability */

export interface ReliabilityBin {
  bin_low: number;
  bin_high: number;
  count: number;
  mean_confidence: number | null;
  observed_rate: number | null;
}

/**
 * The reliability diagram.
 *
 * A model that says 0.8 should be right about 80% of the time. This is the
 * number that drives whether a person should act on the warning, which is why
 * it is here instead of an F1 score. Points below the diagonal are
 * overconfidence: the model claimed more certainty than the outcomes justify.
 */
export function ReliabilityChart({
  bins,
  ece,
  title,
}: {
  bins: ReliabilityBin[];
  ece: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  const W = 420;
  const H = 300;
  const PAD = { top: 16, right: 18, bottom: 46, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const STRIP = 22;

  const x = (v: number) => PAD.left + v * plotW;
  const y = (v: number) => PAD.top + (1 - v) * plotH;

  const points = bins
    .filter((b): b is ReliabilityBin & { mean_confidence: number; observed_rate: number } =>
      b.mean_confidence !== null && b.observed_rate !== null && b.count > 0,
    )
    .sort((a, b) => a.mean_confidence - b.mean_confidence);

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="viz-root m-0">
      <figcaption className="mb-1 text-sm font-semibold text-ink">{title}</figcaption>
      <p className="mb-3 text-xs leading-snug text-muted">
        Expected calibration error{" "}
        <strong className="font-semibold text-ink">{(ece * 100).toFixed(1)}%</strong>. Points
        below the grey line mean the model claimed more confidence than the outcomes
        justified.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reliability diagram. Expected calibration error ${(ece * 100).toFixed(1)} percent. Numbers are in the table below.`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--viz-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--viz-muted)"
              >
                {Math.round(t * 100)}%
              </text>
              <text
                x={x(t)}
                y={PAD.top + plotH + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--viz-muted)"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {/* Perfect calibration. Hairline, solid, recessive — it is reference,
              not a series. */}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
            stroke="var(--viz-axis)"
            strokeWidth={1}
            clipPath={`url(#${clipId})`}
          />
          {/* Parked below-right of the diagonal, where the data sits above it
              (that region is empty whenever the model is overconfident, which
              is the case this chart exists to show). */}
          <text
            x={x(0.98)}
            y={y(0.52)}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--viz-muted)"
          >
            grey line = perfectly calibrated
          </text>

          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${x(p.mean_confidence)},${y(p.observed_rate)}`).join(" ")}
              fill="none"
              stroke="var(--viz-s1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.mean_confidence)}
              cy={y(p.observed_rate)}
              r={hover === i ? 6.5 : 5}
              fill="var(--viz-s1)"
              stroke="var(--viz-surface)"
              strokeWidth={2}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {`Predicted ${(p.mean_confidence * 100).toFixed(0)}%, actually scam ${(p.observed_rate * 100).toFixed(0)}% of ${p.count} cases`}
              </title>
            </circle>
          ))}

          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="var(--viz-axis)"
            strokeWidth={1}
          />

          {/* How many cases sit in each confidence bin. A reliability diagram
              without this hides that some points rest on three examples. */}
          {bins.map((b, i) => {
            const bw = plotW / bins.length;
            const h = (b.count / maxCount) * STRIP;
            return (
              <rect
                key={i}
                x={PAD.left + i * bw + 1}
                y={H - 10 - h}
                width={Math.max(bw - 2, 1)}
                height={h}
                rx={2}
                fill="var(--viz-s1)"
                opacity={0.28}
              >
                <title>{`${b.count} cases scored between ${Math.round(b.bin_low * 100)}% and ${Math.round(b.bin_high * 100)}%`}</title>
              </rect>
            );
          })}

          <text x={PAD.left} y={H - 1} fontSize={10} fill="var(--viz-muted)">
            cases per bin
          </text>
          <text
            x={PAD.left + plotW / 2}
            y={PAD.top + plotH + 36}
            textAnchor="middle"
            fontSize={11}
            fill="var(--viz-ink-2)"
          >
            what the model predicted
          </text>
        </svg>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">Read the numbers</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1 font-medium">Bin</th>
              <th className="py-1 font-medium">Cases</th>
              <th className="py-1 font-medium">Predicted</th>
              <th className="py-1 font-medium">Actually scam</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {bins.map((b, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-1">
                  {Math.round(b.bin_low * 100)}–{Math.round(b.bin_high * 100)}%
                </td>
                <td className="py-1">{b.count}</td>
                <td className="py-1">
                  {b.mean_confidence === null ? "—" : `${(b.mean_confidence * 100).toFixed(0)}%`}
                </td>
                <td className="py-1">
                  {b.observed_rate === null ? "—" : `${(b.observed_rate * 100).toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/* ------------------------------------------------------------- attack chart */

export interface AttackRow {
  id: string;
  label: string;
  rationale: string;
  modelOnly: number;
  engineWithDefence: number;
  engineWithoutDefence: number;
}

const SERIES = [
  { key: "modelOnly", name: "Text model alone", color: "var(--viz-s1)" },
  { key: "engineWithoutDefence", name: "Engine, defence off", color: "var(--viz-s2)" },
  { key: "engineWithDefence", name: "Engine, defence on", color: "var(--viz-s3)" },
] as const;

/**
 * Degradation under attack, as a dot plot.
 *
 * Three values per attack on one shared 0-100% scale. The connector runs from
 * the engine with its normalisation defence turned off to the same engine with
 * it on, so the length of that line is literally what the defence buys. Every
 * "defence on" value is also printed, which is the relief the light-mode
 * contrast warning on this hue requires.
 */
export function AttackChart({ rows, baseline }: { rows: AttackRow[]; baseline: number }) {
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="viz-root m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-ink">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color, boxShadow: "0 0 0 2px var(--viz-surface)" }}
              />
              {s.name}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          aria-expanded={showTable}
          className="ml-auto rounded border border-line px-2 py-1 text-xs text-muted hover:text-ink"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      <p className="mb-4 text-xs leading-snug text-muted">
        Share of holdout scam threads still caught after each transform. Unattacked, the
        engine catches{" "}
        <strong className="font-semibold text-ink">{Math.round(baseline * 100)}%</strong>.
      </p>

      {showTable ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1.5 font-medium">Attack</th>
              <th className="py-1.5 font-medium">Model</th>
              <th className="py-1.5 font-medium">Defence off</th>
              <th className="py-1.5 font-medium">Defence on</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="py-1.5 pr-3 text-ink">{r.label}</td>
                <td className="py-1.5 font-mono">{Math.round(r.modelOnly * 100)}%</td>
                <td className="py-1.5 font-mono">{Math.round(r.engineWithoutDefence * 100)}%</td>
                <td className="py-1.5 font-mono font-semibold text-ink">
                  {Math.round(r.engineWithDefence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => {
            const gain = row.engineWithDefence - row.engineWithoutDefence;
            return (
              <li key={row.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-ink">{row.label}</span>
                  <span className="shrink-0 font-mono text-xs" style={{ color: "var(--viz-s3)" }}>
                    {Math.round(row.engineWithDefence * 100)}%
                    {gain > 0.001 && (
                      <span className="ml-1 text-faint">
                        (+{Math.round(gain * 100)} from the defence)
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className="relative h-5 rounded"
                  style={{ background: "var(--viz-grid)", opacity: 1 }}
                  title={row.rationale}
                >
                  {/* Connector: defence off -> defence on. */}
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded"
                    style={{
                      left: `${Math.min(row.engineWithoutDefence, row.engineWithDefence) * 100}%`,
                      width: `${Math.abs(gain) * 100}%`,
                      background: "var(--viz-s3)",
                      opacity: 0.45,
                    }}
                  />
                  {SERIES.map((s) => {
                    const value = row[s.key];
                    return (
                      <span
                        key={s.key}
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${value * 100}%`,
                          background: s.color,
                          boxShadow: "0 0 0 2px var(--viz-surface)",
                        }}
                        title={`${s.name}: ${Math.round(value * 100)}%`}
                      />
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div
        aria-hidden
        className="mt-2 flex justify-between font-mono text-[10px] text-faint"
      >
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------- threshold sweep */

export interface SweepPoint {
  threshold: number;
  recall: number;
  false_positive_rate: number;
}

/**
 * Recall and false-positive rate across thresholds, with the chosen operating
 * point marked.
 *
 * "What's your false positive rate?" deserves the number, the cost, and where
 * the line was drawn — this is the third part.
 */
export function ThresholdChart({
  points,
  chosen,
}: {
  points: SweepPoint[];
  chosen: number;
}) {
  const W = 420;
  const H = 260;
  const PAD = { top: 14, right: 16, bottom: 42, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const sorted = [...points].sort((a, b) => a.threshold - b.threshold);
  const minT = sorted[0]?.threshold ?? 0;
  const maxT = sorted[sorted.length - 1]?.threshold ?? 1;
  const x = (t: number) => PAD.left + ((t - minT) / Math.max(maxT - minT, 1e-9)) * plotW;
  const y = (v: number) => PAD.top + (1 - v) * plotH;

  const series = [
    { name: "Scams caught", color: "var(--viz-s1)", get: (p: SweepPoint) => p.recall },
    {
      name: "False alarms on real messages",
      color: "var(--viz-s2)",
      get: (p: SweepPoint) => p.false_positive_rate,
    },
  ];

  return (
    <figure className="viz-root m-0">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5 text-ink">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded"
              style={{ background: s.color }}
            />
            {s.name}
          </li>
        ))}
      </ul>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Scams caught and false alarms as the threshold moves. Numbers in the table below."
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--viz-muted)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {/* Where we set the line. */}
        <line
          x1={x(chosen)}
          x2={x(chosen)}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="var(--viz-axis)"
          strokeWidth={1}
        />
        <text x={x(chosen) + 5} y={PAD.top + 11} fontSize={10.5} fill="var(--viz-ink-2)">
          we operate here ({chosen})
        </text>

        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={sorted.map((p) => `${x(p.threshold)},${y(s.get(p))}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {sorted.map((p) => (
              <circle
                key={p.threshold}
                cx={x(p.threshold)}
                cy={y(s.get(p))}
                r={4}
                fill={s.color}
                stroke="var(--viz-surface)"
                strokeWidth={2}
              >
                <title>{`Threshold ${p.threshold}: ${s.name.toLowerCase()} ${Math.round(s.get(p) * 100)}%`}</title>
              </circle>
            ))}
          </g>
        ))}

        {sorted.map((p) => (
          <text
            key={p.threshold}
            x={x(p.threshold)}
            y={PAD.top + plotH + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--viz-muted)"
          >
            {p.threshold}
          </text>
        ))}
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--viz-axis)"
          strokeWidth={1}
        />
        <text
          x={PAD.left + plotW / 2}
          y={PAD.top + plotH + 34}
          textAnchor="middle"
          fontSize={11}
          fill="var(--viz-ink-2)"
        >
          threshold
        </text>
      </svg>
    </figure>
  );
}
