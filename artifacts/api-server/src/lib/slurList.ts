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
 *   without touching the banned list — they take precedence over everything,
 *   and are enforced both at banned-set construction time AND at the point each
 *   submitted token is checked against the set.
 */

/**
 * Normalised forms that must never trigger the filter.
 *
 * The allowlist is applied in two places so it is impossible to circumvent:
 *   1. At startup, when building the BANNED Set — allowlisted forms are
 *      excluded from BANNED even if they appear in RAW_SLURS.
 *   2. At check time in containsBannedContent — every token is tested against
 *      ALLOWLIST before being tested against BANNED, so no code path can flag
 *      an allowlisted word regardless of how the banned set was constructed.
 *
 * Add a word here (in its plain lowercase, non-alpha-stripped form) whenever a
 * legitimate proper noun, place name, scientific term, or other innocent word
 * would otherwise be caught by the filter.
 */
export const ALLOWLIST_TERMS: readonly string[] = [
  // Country names whose normalised form resembles a slur entry.
  // "Niger" → normalises to "niger" (1 g); the racial slur normalises to
  // "nigger" (2 g's) — already distinct, but listed explicitly for clarity.
  'niger',

  // Legitimate common words that have historically doubled as slurs in some
  // contexts but whose everyday English meaning clearly dominates.
  'guinea',   // currency unit, Republic of Guinea, guinea pig

  // ── Allowlisted RAW_SLURS entries ───────────────────────────────────────────
  //
  // The following words are retained in RAW_SLURS (so the reasoning stays
  // visible) but must never be flagged because their dominant everyday meaning
  // in general English is innocent and would produce false positives in trivia.

  'slope',    // mathematics (gradient), geography (hillside), skiing — far more
              // common in trivia than the anti-Asian slur sense.

  'nip',      // "a nip in the air" (cold), "nip of whisky" (small measure),
              // "nip out" (leave briefly) — all common everyday phrases.

  'chink',    // "a chink in the armour/armor" is a standard English idiom for
              // a gap or weakness; appears regularly in history and literature.
];

/**
 * Raw slur terms before normalisation.
 * The content filter normalises these and builds its banned Set at startup;
 * the raw strings here are never shipped to any client.
 *
 * Each entry is annotated with the group it targets.
 * Entries that also appear in ALLOWLIST_TERMS are marked — they are retained
 * here so the reasoning for their original inclusion stays visible.
 */
export const RAW_SLURS: readonly string[] = [
  // ── Anti-Black ───────────────────────────────────────────────────────────────
  'nigger',
  'nigga',
  'coon',
  'sambo',
  'pickaninny',

  // ── Anti-Asian ───────────────────────────────────────────────────────────────
  'chink',        // allowlisted — "chink in the armour" idiom dominates
  'gook',
  'jap',
  'nip',          // allowlisted — weather/drink/movement senses dominate
  'slope',        // allowlisted — mathematical/geographical sense dominates
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
