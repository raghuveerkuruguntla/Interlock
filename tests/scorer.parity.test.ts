/**
 * Exact-parity test between the TypeScript scorer and scikit-learn.
 *
 * Interlock scores message text in the browser so the text never crosses the
 * privacy boundary. That is only an honest claim if the browser implementation
 * actually agrees with the model we evaluated and published metrics for.
 *
 * `ml/export_model.py` writes `public/model/parity.json` with the margin and
 * calibrated probability sklearn produced for a set of fixtures chosen to hit
 * the places a hand-written TF-IDF drifts: whitespace runs, newlines, unicode,
 * punctuation, single characters and the empty string.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Scorer, charNgrams, wordNgrams, type ScoringModel } from "@/lib/engine/scorer";

const MODEL_DIR = join(process.cwd(), "public", "model");

const model: ScoringModel = JSON.parse(readFileSync(join(MODEL_DIR, "model.json"), "utf8"));
const parity: {
  tolerance: number;
  cases: { text: string; margin: number; probability: number }[];
} = JSON.parse(readFileSync(join(MODEL_DIR, "parity.json"), "utf8"));

const scorer = new Scorer(model);

describe("scorer parity with scikit-learn", () => {
  it("has fixtures to check", () => {
    expect(parity.cases.length).toBeGreaterThan(50);
  });

  it.each(parity.cases.map((c, i) => [i, c] as const))(
    "case %i reproduces the sklearn margin and probability",
    (_i, expected) => {
      const actual = scorer.score(expected.text);
      expect(actual.margin).toBeCloseTo(expected.margin, 4);
      expect(actual.probability).toBeCloseTo(expected.probability, 4);
    },
  );

  it("agrees with sklearn on every fixture within tolerance", () => {
    const worst = parity.cases.reduce((acc, c) => {
      const diff = Math.abs(scorer.score(c.text).probability - c.probability);
      return Math.max(acc, diff);
    }, 0);
    expect(worst).toBeLessThan(parity.tolerance);
  });
});

describe("analyzer details that sklearn gets subtly right", () => {
  it("drops single-character tokens, as token_pattern \\b\\w\\w+\\b does", () => {
    expect(wordNgrams("a bb c dd", [1, 1])).toEqual(["bb", "dd"]);
  });

  it("keeps unicode letters in word tokens", () => {
    expect(wordNgrams("Café naïve", [1, 1])).toEqual(["café", "naïve"]);
  });

  it("emits unigrams before bigrams, joined by a single space", () => {
    expect(wordNgrams("pay me now", [1, 2])).toEqual([
      "pay",
      "me",
      "now",
      "pay me",
      "me now",
    ]);
  });

  it("collapses runs of two or more whitespace characters to one space", () => {
    expect(charNgrams("a  b", [3, 3])).toEqual(["a b"]);
  });

  it("leaves a single newline intact", () => {
    expect(charNgrams("a\nb", [3, 3])).toEqual(["a\nb"]);
  });

  it("slices by code point, not UTF-16 code unit", () => {
    // A single emoji is two code units but one code point. Slicing by code
    // unit would split the surrogate pair and produce lone surrogates.
    expect(charNgrams("a🙂b", [3, 3])).toEqual(["a🙂b"]);
  });

  it("returns an empty feature set for empty input", () => {
    expect(wordNgrams("", [1, 2])).toEqual([]);
    expect(charNgrams("", [3, 5])).toEqual([]);
  });

  it("scores empty input as the bare intercept rather than dividing by zero", () => {
    expect(Number.isFinite(scorer.score("").margin)).toBe(true);
    expect(scorer.score("").margin).toBeCloseTo(model.intercept, 10);
  });
});

describe("contributions", () => {
  it("surfaces the features that actually moved the margin", () => {
    const text = "Reply with the verification code to stop the transfer.";
    const contributions = scorer.contributions(text, 5);
    expect(contributions).toHaveLength(5);
    // Sorted by absolute influence.
    const magnitudes = contributions.map((c) => Math.abs(c.contribution));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
    // And they sum, with the rest, back to the margin.
    expect(contributions.every((c) => Number.isFinite(c.contribution))).toBe(true);
  });
});
