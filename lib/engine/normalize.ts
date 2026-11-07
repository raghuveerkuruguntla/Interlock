/**
 * Text normalisation, used as an evasion defence and as the input to campaign
 * signatures.
 *
 * Attackers obfuscate. They swap a Latin "a" for a Cyrillic "а", sprinkle
 * zero-width joiners between letters, use fullwidth characters, stretch words,
 * or space out "s e n d  t h e  c o d e" so no keyword survives intact. None of
 * that changes what a human reads, which is the whole point: the message has
 * to stay legible to the victim to work.
 *
 * So the defence is to fold the obfuscation away before matching. The
 * adversarial suite in `tests/redteam.test.ts` measures how much this actually
 * buys, with and without it, and the result is reported honestly rather than
 * asserted.
 *
 * Note: this never runs before the scorer in the parity tests. The scorer is
 * held to exact agreement with scikit-learn on raw text; normalisation is a
 * separate, measurable layer applied by the engine.
 */

/** Zero-width and bidirectional control characters, which carry no meaning on screen. */
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;

/**
 * Characters from other scripts that render as Latin letters.
 *
 * Deliberately conservative: only mappings where the glyphs are genuinely
 * confusable at normal reading size, because folding too aggressively would
 * mangle legitimate non-English text. Spanish accented characters are
 * untouched for exactly this reason.
 */
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: "a", в: "b", с: "c", е: "e", н: "h", к: "k", м: "m", о: "o", р: "p",
  ѕ: "s", т: "t", у: "y", х: "x", і: "i", ј: "j", ԁ: "d", ɡ: "g",
  А: "A", В: "B", С: "C", Е: "E", Н: "H", К: "K", М: "M", О: "O", Р: "P",
  Ѕ: "S", Т: "T", У: "Y", Х: "X", І: "I", Ј: "J",
  // Greek
  α: "a", β: "b", ο: "o", ρ: "p", τ: "t", υ: "u", ν: "v", κ: "k", ι: "i",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N",
  Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
  // Latin lookalikes and symbols
  ı: "i", ɩ: "i", ʏ: "y", ʙ: "b", ᴏ: "o", ᴍ: "m", "ℓ": "l", "∕": "/",
  "０": "0", "１": "1", "３": "3", "５": "5", "８": "8",
};

const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join("")}]`, "g");

/**
 * Single characters separated by spaces, dots or dashes — "c o d e", "c.o.d.e".
 * Requires at least four in a row so that initialisms and ordinary punctuation
 * are left alone.
 */
const SPACED_OUT = /\b(?:[\p{L}\p{N}][ .\-_*]){3,}[\p{L}\p{N}]\b/gu;

/** Three or more of the same character: "urgeeeent". */
const STRETCHED = /(\p{L})\1{2,}/gu;

export interface NormalizeOptions {
  /** Fold confusable characters from other scripts to Latin. */
  homoglyphs?: boolean;
  /** Remove zero-width and bidi control characters. */
  invisible?: boolean;
  /** Rejoin deliberately spaced-out words. */
  spacing?: boolean;
  /** Collapse stretched characters to two. */
  stretching?: boolean;
}

const ALL: Required<NormalizeOptions> = {
  homoglyphs: true,
  invisible: true,
  spacing: true,
  stretching: true,
};

/**
 * Fold obfuscation without changing what the message says.
 *
 * Applied before signal detection and before scoring in the live engine.
 * Returns the original string unchanged when nothing matched, so the common
 * case costs nothing.
 */
export function foldObfuscation(text: string, options: NormalizeOptions = ALL): string {
  const opts = { ...ALL, ...options };
  // NFKC folds fullwidth forms, mathematical alphanumerics and ligatures into
  // their plain equivalents. It leaves accented Latin letters alone, so
  // "José" survives intact.
  let out = text.normalize("NFKC");
  if (opts.invisible) out = out.replace(INVISIBLE, "");
  if (opts.homoglyphs) out = out.replace(HOMOGLYPH_RE, (ch) => HOMOGLYPHS[ch] ?? ch);
  if (opts.spacing) {
    out = out.replace(SPACED_OUT, (run) => run.replace(/[ .\-_*]/g, ""));
  }
  if (opts.stretching) out = out.replace(STRETCHED, (_m, ch: string) => ch + ch);
  return out;
}

/**
 * Reduce a message to its campaign template.
 *
 * Everything that varies per victim is replaced by a placeholder, so two sends
 * of the same campaign collapse to the same string even though the name, the
 * amount, the tracking number and the short link all differ.
 *
 * This is the only representation of a message that is ever allowed to leave
 * the device, and only after hashing — see `signature.ts`.
 */
export function campaignTemplate(text: string): string {
  return foldObfuscation(text)
    .toLowerCase()
    .replace(/https?:\/\/[^\s<>"']+/g, " <url> ")
    .replace(/\b[a-z0-9-]+\.(?:com|net|org|io|co|info|xyz|top|link|app|shop|live|site)\b[^\s]*/g, " <url> ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, " <email> ")
    .replace(/[$€£]\s?\d[\d,]*(?:\.\d{2})?/g, " <amount> ")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, " <phone> ")
    .replace(/\b\d{4,}\b/g, " <num> ")
    .replace(/\b\d+\b/g, " <n> ")
    .replace(/[^\p{L}\p{N}<>\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
