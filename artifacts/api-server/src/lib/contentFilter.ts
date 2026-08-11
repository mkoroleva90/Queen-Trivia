/**
 * Server-side content filter for Queen Trivia.
 *
 * Screens user-submitted text for slurs and hate speech using the curated list
 * in ./slurList.ts. The list and all matching logic live entirely on the server
 * — neither the word list nor any fragment of it is shipped inside the web or
 * mobile bundle.
 *
 * NORMALISATION — two forms are produced per token; BOTH are checked:
 *
 *   PLAIN FORM  — lowercase → strip all non-alphabetic characters →
 *                 collapse runs of 3+ identical letters to 2.
 *                 Used as the primary token for ordinary text.
 *
 *   LEET FORM   — lowercase → apply common character-for-letter substitutions
 *                 (@/4→a  3→e  1/!/|→i  0→o  $/5→s  +→t) →
 *                 strip all non-alphabetic characters →
 *                 collapse runs of 3+ identical letters to 2.
 *                 Checked alongside the plain form to catch deliberate evasion
 *                 (e.g. "n1gger") without ever transforming numeric answers.
 *
 *   Checking BOTH forms non-destructively ensures that digits and symbols in
 *   ordinary trivia (years, arithmetic) cannot be converted into letter
 *   sequences that produce false positives.
 *
 * WHOLE-WORD MATCHING ONLY:
 *   Input is split on whitespace into tokens. Each token produces at most two
 *   normalised forms (plain + leet). Both are tested against the pre-computed
 *   normalised banned set via exact Set lookups. A banned term embedded inside
 *   a longer innocent word is NOT flagged — "assassination" is a single token
 *   and does not match any shorter term it contains.
 *
 * EVASION HANDLING:
 *   Runs of 3+ consecutive single-letter whitespace-separated tokens are
 *   concatenated and checked as an additional candidate, catching
 *   space-separated letter-by-letter spelling ("n i g g e r").
 *   Only tokens whose PLAIN form (no leet substitution) is a single letter are
 *   counted — digits or symbols that map to a letter via leet substitution
 *   (e.g. "1" → "i", "3" → "e") are excluded from run accumulation.
 *
 * ALLOWLIST:
 *   Normalised forms in ALLOWLIST_TERMS (./slurList.ts) are never flagged,
 *   even if they appear in the banned set. Add entries there to fix false
 *   positives without touching the banned list.
 */

import { logger } from './logger.ts';
import { RAW_SLURS, ALLOWLIST_TERMS } from './slurList.ts';

// ── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Leet-speak substitution pairs.
 * Applied only when computing the LEET form of a token — the PLAIN form
 * intentionally skips these so that digits stay as digits.
 */
const LEET_SUBS: [RegExp, string][] = [
  [/@|4/g, 'a'],
  [/3/g, 'e'],
  [/[1!|]/g, 'i'],
  [/0/g, 'o'],
  [/[$5]/g, 's'],
  [/[+]/g, 't'],
];

const TRIPLE_COLLAPSE = /(.)\1{2,}/g;

/**
 * Plain form: lowercase → strip non-alpha → collapse 3+ repeated letters to 2.
 * Digits are stripped, not converted. "1945" → "" (empty, excluded from checks).
 */
function normalisePlain(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '').replace(TRIPLE_COLLAPSE, '$1$1');
}

/**
 * Leet form: lowercase → leet subs → strip non-alpha → collapse 3+ to 2.
 * "n1gger" → "nigger". Used alongside the plain form to catch evasion.
 */
function normaliseLeet(s: string): string {
  let t = s.toLowerCase();
  for (const [p, r] of LEET_SUBS) t = t.replace(p, r);
  return t.replace(/[^a-z]/g, '').replace(TRIPLE_COLLAPSE, '$1$1');
}

// ── Word lists ────────────────────────────────────────────────────────────────

/** Allowlisted normalised forms — checked first; these can never be flagged. */
const ALLOWLIST = new Set<string>(
  ALLOWLIST_TERMS.map(normalisePlain).filter(Boolean),
);

/**
 * Pre-computed normalised banned set — built once at module load.
 * Allowlisted forms are removed during construction so the check path is a
 * single O(1) Set lookup with no branching.
 */
const BANNED = new Set<string>(
  RAW_SLURS.map(normalisePlain)
    .filter((w) => w.length > 0 && !ALLOWLIST.has(w)),
);

// ── Token extraction ──────────────────────────────────────────────────────────

/**
 * Splits `text` into the full set of normalised token candidates.
 *
 * For each whitespace-delimited token two candidates are produced:
 *   1. The plain form (digits stripped as-is).
 *   2. The leet form (digits substituted to letters, then stripped).
 *
 * Additionally, runs of 3+ consecutive tokens whose PLAIN form is a single
 * letter are concatenated and added as an extra candidate — catching
 * space-separated evasion such as "n i g g e r". Tokens whose plain form is
 * empty (pure digits / symbols) break a run and are never included in one.
 */
function extractTokens(text: string): string[] {
  const tokens = new Set<string>();
  const rawTokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  let singleLetterRun: string[] = [];

  for (const raw of rawTokens) {
    const plain = normalisePlain(raw);
    const leet  = normaliseLeet(raw);

    if (!plain) {
      // Pure digit / symbol token — breaks any ongoing single-letter run
      // and contributes nothing to the token set.
      if (singleLetterRun.length >= 3) {
        tokens.add(singleLetterRun.join('').replace(TRIPLE_COLLAPSE, '$1$1'));
      }
      singleLetterRun = [];
      continue;
    }

    // Add plain form.
    tokens.add(plain);

    // Add leet form only when it differs (avoids redundant lookups).
    if (leet && leet !== plain) tokens.add(leet);

    // Single-letter-run accumulation.
    // Only count tokens whose PLAIN form is exactly one letter. This excludes
    // digits ("1" plain → "", leet → "i") from joining a run, so arithmetic
    // like "5 + 3 - 1" cannot produce letter sequences via concatenation.
    if (plain.length === 1) {
      singleLetterRun.push(plain);
    } else {
      if (singleLetterRun.length >= 3) {
        tokens.add(singleLetterRun.join('').replace(TRIPLE_COLLAPSE, '$1$1'));
      }
      singleLetterRun = [];
    }
  }

  // Flush any trailing single-letter run.
  if (singleLetterRun.length >= 3) {
    tokens.add(singleLetterRun.join('').replace(TRIPLE_COLLAPSE, '$1$1'));
  }

  return [...tokens];
}

// ── Option text extraction ────────────────────────────────────────────────────

/**
 * Extracts all user-visible text strings from a question's `options` object.
 * Handles every question type that stores text in options:
 *   multiple_choice  → options.choices[]
 *   write_in / image_recognition → options.alternateAnswers[]
 *   ordering         → options.items[]
 *   matching         → options.pairs[].left, options.pairs[].right
 * Types without text in options (true_false, slider, image_hotspot) return [].
 */
export function extractOptionTexts(options: unknown): string[] {
  if (!options || typeof options !== 'object') return [];
  const opts = options as Record<string, unknown>;
  const texts: string[] = [];

  if (Array.isArray(opts.choices)) {
    for (const c of opts.choices) if (typeof c === 'string') texts.push(c);
  }
  if (Array.isArray(opts.alternateAnswers)) {
    for (const a of opts.alternateAnswers) if (typeof a === 'string') texts.push(a);
  }
  if (Array.isArray(opts.items)) {
    for (const item of opts.items) if (typeof item === 'string') texts.push(item);
  }
  if (Array.isArray(opts.pairs)) {
    for (const pair of opts.pairs as Array<Record<string, unknown>>) {
      if (typeof pair.left === 'string') texts.push(pair.left);
      if (typeof pair.right === 'string') texts.push(pair.right);
    }
  }

  return texts;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if `text` contains a banned word after normalisation.
 * Whole-word matching only — a banned term embedded inside a longer innocent
 * word does NOT trigger a match.
 */
export function containsBannedContent(text: string): boolean {
  if (!text?.trim()) return false;
  return extractTokens(text).some((t) => BANNED.has(t));
}

/**
 * Returns true if ANY of the provided strings contains banned content.
 * Null/undefined/empty values are skipped. Pass all text fields from a
 * single submission together.
 */
export function anyContainsBannedContent(
  texts: Array<string | null | undefined>,
): boolean {
  return texts.some((t) => t != null && t !== '' && containsBannedContent(t));
}

/**
 * Logs a blocked submission for later review.
 * Never logs the submitted text or any fragment of it.
 */
export function logFlaggedContent(context: string): void {
  logger.warn({ context }, 'Content filter: submission blocked');
}
