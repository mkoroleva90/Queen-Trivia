# Memory index

- [Mobile regen/enhance API](mobile-regen-enhance-api.md) — useRegenerateQuestion/useEnhanceQuestion signatures differ from web; no topic in data, improvedQuestionText not questionText.

- [PDF code restore](pdf-code-restore.md) — how the Trivia Night app was reconstructed from a PDF code export; wrap-join loses spaces, YAML indentation must come from bbox coords.
- [Codegen tooling quirks](codegen-tooling-quirks.md) — orval codegen broken on Node 24: hand-patch all 3 generated locations; drizzle push needs TTY, apply DDL via SQL instead.
- [Node strip-types tests](node-strip-types-tests.md) — api-server tests need `.ts` import extensions; stripper rejects `!` in destructuring LHS.
- [Admin code source of truth](admin-auth-code-source.md) — /api/admin/login checks ADMIN_ACCESS_KEY env before the DB code; the two can disagree. Socket singleton: one hook cleanup disconnects all.
- [Live tally seeding](live-tally-seeding.md) — seed+socket live counts must use the synchronous ref store in lib/live-tally; React-state flags misroute transition events and double-count.
- [Access code security model](access-code-security.md) — trivia 4–6 chars / case-insensitive; admin 12–64 chars / bcrypt hashed / never returned to client; bootstrap auto-migrates plain text.
