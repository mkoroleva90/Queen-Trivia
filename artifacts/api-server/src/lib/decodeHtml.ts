
// Named HTML entity lookup table — covers all Latin-extended characters
// plus common punctuation and symbols that OpenTDB and other sources use.
const HTML_NAMED_ENTITIES: Record<string, string> = {
  // Core
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  // Spaces & punctuation
  nbsp: "\u00A0", shy: "\u00AD", ensp: "\u2002", emsp: "\u2003",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
  lsquo: "\u2018", rsquo: "\u2019", sbquo: "\u201A",
  ldquo: "\u201C", rdquo: "\u201D", bdquo: "\u201E",
  laquo: "\u00AB", raquo: "\u00BB",
  // Symbols
  trade: "\u2122", reg: "\u00AE", copy: "\u00A9", deg: "\u00B0",
  plusmn: "\u00B1", times: "\u00D7", divide: "\u00F7",
  frac14: "\u00BC", frac12: "\u00BD", frac34: "\u00BE",
  sup1: "\u00B9", sup2: "\u00B2", sup3: "\u00B3",
  // Latin extended (uppercase)
  Agrave: "\u00C0", Aacute: "\u00C1", Acirc: "\u00C2", Atilde: "\u00C3",
  Auml: "\u00C4", Aring: "\u00C5", AElig: "\u00C6", Ccedil: "\u00C7",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  ETH: "\u00D0", Ntilde: "\u00D1",
  Ograve: "\u00D2", Oacute: "\u00D3", Ocirc: "\u00D4", Otilde: "\u00D5",
  Ouml: "\u00D6", Oslash: "\u00D8",
  Ugrave: "\u00D9", Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC",
  Yacute: "\u00DD", THORN: "\u00DE", szlig: "\u00DF",
  // Latin extended (lowercase)
  agrave: "\u00E0", aacute: "\u00E1", acirc: "\u00E2", atilde: "\u00E3",
  auml: "\u00E4", aring: "\u00E5", aelig: "\u00E6", ccedil: "\u00E7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  eth: "\u00F0", ntilde: "\u00F1",
  ograve: "\u00F2", oacute: "\u00F3", ocirc: "\u00F4", otilde: "\u00F5",
  ouml: "\u00F6", oslash: "\u00F8",
  ugrave: "\u00F9", uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC",
  yacute: "\u00FD", thorn: "\u00FE", yuml: "\u00FF",
};

/**
 * Decode HTML entities in a string.
 * Handles named entities (e.g. &oacute;), decimal numeric entities (&#243;),
 * and hex numeric entities (&#xF3;).
 */
export function decodeHtml(html: string): string {
  return html
    .replace(/&([a-zA-Z]+);/g, (match, name: string) =>
      HTML_NAMED_ENTITIES[name] ?? match,
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#039;/g, "'");
}

/**
 * Decode HTML entities in all string fields of a question row as returned
 * by the database — questionText, correctAnswer, and choices inside options.
 */
export function decodeQuestionFields<
  T extends {
    questionText: string;
    correctAnswer?: string | null;
    options?: Record<string, unknown> | null;
  },
>(q: T): T {
  const decoded: T = {
    ...q,
    questionText: decodeHtml(q.questionText),
    ...(q.correctAnswer != null
      ? { correctAnswer: decodeHtml(q.correctAnswer) }
      : {}),
  };

  // Decode choices array inside options JSON if present
  const opts = q.options as { choices?: unknown[] } | null;
  if (opts && Array.isArray(opts.choices)) {
    (decoded as { options: Record<string, unknown> }).options = {
      ...opts,
      choices: opts.choices.map((c) =>
        typeof c === "string" ? decodeHtml(c) : c,
      ),
    };
  }

  return decoded;
}
