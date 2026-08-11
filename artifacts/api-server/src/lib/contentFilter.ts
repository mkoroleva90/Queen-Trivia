/**
 * Server-side content filter for Queen Trivia.
 *
 * Screens user-submitted text for slurs and hate speech using the naughty-words
 * English word list (https://www.npmjs.com/package/naughty-words) as the source.
 * The word list and all matching logic live entirely on the server — neither the
 * word list nor any fragment of it is shipped inside the web or mobile bundle.
 *
 * NORMALIZATION — applied identically to every input token and to every word
 * in the word list so the same transform produces a consistent key:
 *   1. Lowercase
 *   2. Common character-for-letter substitutions (leet speak):
 *        @/4 → a   3 → e   1/!/| → i   0 → o   $/5 → s   + → t
 *   3. Collapse consecutive repeated letters to one  ("niggger" → "niger")
 *   4. Strip all non-alphabetic characters — removes punctuation or spaces
 *      that were inserted between letters ("n.i.g" → "nig")
 *
 * WHOLE-WORD MATCHING ONLY:
 *   Input is split on whitespace into tokens. Each token is independently
 *   normalised and tested against the pre-computed normalised word set via an
 *   exact Set lookup. A banned term that appears only as a substring inside an
 *   innocent longer word is NOT flagged — "assassin" does not contain "ass" as
 *   a token, so it is never blocked.
 *
 * EVASION HANDLING:
 *   Runs of 3+ consecutive single-letter whitespace-separated tokens are
 *   concatenated and checked as an additional candidate token, catching
 *   space-separated letter-by-letter spelling ("n i g g e r").
 */

import { createRequire } from 'node:module';
import { logger } from './logger.ts';

// ── Word list ─────────────────────────────────────────────────────────────────

// createRequire is used so esbuild can bundle the JSON inline at build time.
const _require = createRequire(import.meta.url);
const _rawList: unknown = _require('naughty-words/en.json');
const rawWordList: string[] = Array.isArray(_rawList) ? (_rawList as string[]) : [];

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Leet-speak substitution pairs applied before any other transform.
 * Both the input and the word-list entries go through this table so the
 * comparison happens in the same normalised space.
 */
const LEET_SUBS: [RegExp, string][] = [
  [/@|4/g, 'a'],
  [/3/g, 'e'],
  [/[1!|]/g, 'i'],
  [/0/g, 'o'],
  [/[$5]/g, 's'],
  [/[+]/g, 't'],
];

function normaliseWord(w: string): string {
  let s = w.toLowerCase();
  for (const [pattern, replacement] of LEET_SUBS) {
    s = s.replace(pattern, replacement);
  }
  // Collapse runs of 3+ identical letters to 2 ("niggger" → "nigger").
  // Deliberately collapses to 2, not 1, so that legitimate words whose standard
  // spelling uses a doubled letter (e.g. "nigger" has two g's) stay distinct
  // from single-letter variants that happen to be innocent proper nouns
  // (e.g. "Niger" the country has only one g and normalises to "niger", which
  // does not appear in the banned set).
  s = s.replace(/(.)\1{2,}/g, '$1$1');
  s = s.replace(/[^a-z]/g, '');   // strip non-alphabetic characters
  return s;
}

/**
 * Pre-computed normalised banned word set — built once at module load.
 * Runtime lookups are O(1) Set membership tests.
 */
const BANNED = new Set<string>(
  rawWordList.map(normaliseWord).filter((w) => w.length > 0),
);

// ── Token extraction ──────────────────────────────────────────────────────────

/**
 * Splits `text` into normalised tokens for matching.
 * Also detects and collapses runs of 3+ single-letter tokens to catch
 * space-separated evasion such as "n i g g e r".
 */
function extractTokens(text: string): string[] {
  const tokens = new Set<string>();

  // Apply leet subs before splitting so multi-character tokens are corrected.
  let processed = text.toLowerCase();
  for (const [pattern, replacement] of LEET_SUBS) {
    processed = processed.replace(pattern, replacement);
  }

  const rawTokens = processed.split(/\s+/).filter(Boolean);
  let singleLetterRun: string[] = [];

  for (const raw of rawTokens) {
    const stripped = raw.replace(/[^a-z]/g, ''); // remove inserted punctuation
    if (!stripped) { singleLetterRun = []; continue; }

    const collapsed = stripped.replace(/(.)\1{2,}/g, '$1$1');
    tokens.add(collapsed);

    // Accumulate single-character tokens for space-separated evasion.
    if (stripped.length === 1) {
      singleLetterRun.push(stripped);
    } else {
      if (singleLetterRun.length >= 3) {
        const joined = singleLetterRun.join('').replace(/(.)\1{2,}/g, '$1$1');
        if (joined) tokens.add(joined);
      }
      singleLetterRun = [];
    }
  }

  // Flush any trailing single-letter run.
  if (singleLetterRun.length >= 3) {
    const joined = singleLetterRun.join('').replace(/(.)\1{2,}/g, '$1$1');
    if (joined) tokens.add(joined);
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
