---
name: PDF code restore
description: Lessons from restoring the full codebase from a PDF code export (pdftotext extraction pitfalls).
---

- The app in this project was restored from a PDF export of the codebase (attached_assets/Trivia_Night*.pdf), not written fresh.
- **Why these lessons matter:** pdftotext-based extraction silently corrupts code in two ways:
  1. Wrapped long lines: joining continuation lines can drop the space at the wrap boundary (`as unknown` → `asunknown`, missing spaces inside string literals). Typecheck catches syntax cases, but string literals may still hold cosmetic glitches (e.g. missing spaces in prompts/UI copy).
  2. YAML indentation: `pdftotext -layout` columns drift with proportional fonts. Exact indentation was recovered from `pdftotext -bbox-layout` word x-coordinates (indent level = round(relative-x / ~4.86pt) × 2 spaces).
- **How to apply:** if more content must be pulled from that PDF (or a similar export), reuse the bbox-coordinate approach for whitespace-sensitive files and expect dropped spaces at line-wrap points elsewhere.
- Empty OpenAPI object schemas generate `zod.looseObject` (zod v4 API) which fails typecheck against zod v3 classic import — add `additionalProperties: false` to empty object schemas.
