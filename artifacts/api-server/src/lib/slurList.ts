/**
 * Curated hate-speech and slur list for Queen Trivia content filtering.
 *
 * INCLUSION CRITERIA
 *   A word belongs here only if a reasonable person would call it a slur or
 *   dehumanising hate term targeting an identifiable group by race, ethnicity,
 *   religion, sexual orientation, gender identity, or disability.
 *
 * EXCLUSION CRITERIA — words are NOT included if they are:
 *   • General profanity or swearing (e.g. "fuck", "shit", "damn").
 *   • Crude anatomical or sexual terms that are not group-targeting slurs
 *     (e.g. "dick", "cock", "ass", "sex", "penis").
 *   • Insults that are rude but do not target a protected group.
 *   • Drug, alcohol, or other non-group references.
 *
 * SOURCE
 *   Derived from established hate-speech lexicons including the Hatebase
 *   taxonomy (hatebase.org) and published academic hate-speech datasets.
 *   Terms are not invented; every entry has an attested history as a slur.
 *
 * ALLOWLIST
 *   ALLOWLIST_TERMS contains normalised forms that must never be flagged even
 *   if they appear in RAW_SLURS. Add entries here to resolve false positives
 *   without touching the banned list — they take precedence over everything.
 */

/**
 * Normalised forms that must never trigger the filter.
 * These are checked against the plain-normalised token before the banned-set
 * lookup, so an allowlisted form can never be blocked.
 *
 * Add a word here (in its plain lowercase, non-alpha-stripped form) whenever a
 * legitimate proper noun, place name, reclaimed term, or other innocent word
 * would otherwise be caught by the filter.
 */
export const ALLOWLIST_TERMS: readonly string[] = [
  // Country names whose normalised form resembles a slur entry.
  // "Niger" → normalises to "niger" (1 g); the racial slur normalises to
  // "nigger" (2 g's) — already distinct, but listed explicitly for clarity.
  'niger',

  // Legitimate common words that have historically doubled as slurs in some
  // contexts but whose primary modern meaning is innocent.
  'guinea',   // currency unit, Republic of Guinea, guinea pig
];

/**
 * Raw slur terms before normalisation.
 * The content filter normalises these and builds its banned Set at startup;
 * the raw strings here are never shipped to any client.
 *
 * Each entry is annotated with the group it targets.
 */
export const RAW_SLURS: readonly string[] = [
  // ── Anti-Black ───────────────────────────────────────────────────────────────
  'nigger',
  'nigga',
  'coon',
  'sambo',
  'pickaninny',

  // ── Anti-Asian ───────────────────────────────────────────────────────────────
  'chink',
  'gook',
  'jap',
  'nip',
  'slope',
  'zipperhead',

  // ── Anti-Hispanic / Latino ───────────────────────────────────────────────────
  'spic',
  'spick',
  'wetback',
  'beaner',

  // ── Anti-Arab / Middle Eastern / Muslim ─────────────────────────────────────
  'raghead',
  'towelhead',
  'sandnigger',

  // ── Anti-Jewish ──────────────────────────────────────────────────────────────
  'kike',
  'heeb',
  'hymie',

  // ── Anti-Italian / Anti-Irish / Other European ethnic ────────────────────────
  'wop',
  'dago',

  // ── Sexual-orientation slurs ─────────────────────────────────────────────────
  'faggot',

  // ── Gender-identity slurs ────────────────────────────────────────────────────
  'tranny',
  'shemale',

  // ── Disability slurs ─────────────────────────────────────────────────────────
  'retard',
  'mongoloid',
  'spastic',
];
