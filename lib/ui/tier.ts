/**
 * Visual encoding for risk tiers and stages.
 *
 * Colour is never the only channel. Every tier also carries a distinct glyph
 * and a word, so the interface still reads correctly in greyscale, in a
 * screenshot, under deuteranopia, or through a screen reader. That is a
 * requirement rather than a nicety: the ramp runs through amber, orange and
 * red, which is exactly the range that collapses for the most common form of
 * colour blindness.
 */

import type { Stage, Tier } from "@/lib/engine/types";

export interface TierStyle {
  /** Foreground/border colour variable. */
  fg: string;
  /** Background wash. */
  bg: string;
  /** Distinct shape, so the tier is legible without colour. */
  glyph: string;
  /** Short English name, used for `aria-label` and the greyscale fallback. */
  name: string;
}

export const TIER_STYLE: Record<Tier, TierStyle> = {
  none: { fg: "var(--tier-none)", bg: "var(--tier-none-soft)", glyph: "○", name: "no signal" },
  low: { fg: "var(--tier-low)", bg: "var(--tier-low-soft)", glyph: "◔", name: "low" },
  elevated: {
    fg: "var(--tier-elevated)",
    bg: "var(--tier-elevated-soft)",
    glyph: "◑",
    name: "elevated",
  },
  high: { fg: "var(--tier-high)", bg: "var(--tier-high-soft)", glyph: "◕", name: "high" },
  critical: {
    fg: "var(--tier-critical)",
    bg: "var(--tier-critical-soft)",
    glyph: "●",
    name: "critical",
  },
};

export const STAGE_ORDER: Stage[] = [
  "contact",
  "hook",
  "isolation",
  "escalation",
  "extraction",
  "recovery",
];

/** One line per stage, describing what the attacker is doing, not what we do. */
export const STAGE_BLURB: Record<Stage, string> = {
  contact: "Someone got in touch. On its own this means nothing.",
  hook: "A story is being set up — a problem, a deadline, a link.",
  isolation: "They are trying to cut you off from anyone who would check.",
  escalation: "They are asking for the thing they actually came for.",
  extraction: "Something irreversible is being moved right now.",
  recovery: "Containing it and working out what to do next.",
};

export const SEVERITY_STYLE = {
  info: { fg: "var(--text-muted)", bg: "var(--surface-2)", glyph: "·", name: "note" },
  caution: {
    fg: "var(--tier-elevated)",
    bg: "var(--tier-elevated-soft)",
    glyph: "▲",
    name: "caution",
  },
  intervene: {
    fg: "var(--tier-critical)",
    bg: "var(--tier-critical-soft)",
    glyph: "■",
    name: "action needed",
  },
} as const;

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
