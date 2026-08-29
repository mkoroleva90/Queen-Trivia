# Memory index

- [API server stale bundle](api-server-stale-bundle.md) — no hot reload; new routes 404 until the workflow rebuilds dist; check dist vs src mtimes on unexpected 404s.

- [Mobile regen/enhance API](mobile-regen-enhance-api.md) — useRegenerateQuestion/useEnhanceQuestion signatures differ from web; no topic in data, improvedQuestionText not questionText.

- [PDF code restore](pdf-code-restore.md) — how the Trivia Night app was reconstructed from a PDF code export; wrap-join loses spaces, YAML indentation must come from bbox coords.
- [Codegen tooling quirks](codegen-tooling-quirks.md) — orval codegen broken on Node 24: hand-patch all 3 generated locations; drizzle push needs TTY, apply DDL via SQL instead.
- [Node strip-types tests](node-strip-types-tests.md) — api-server tests need `.ts` import extensions; stripper rejects `!` in destructuring LHS.
- [Metro imageSize crash on Node.js 24](metro-imagsize-node24.md) — image-size@1.x crashes in Metro worker threads on Node 24+; fixed via patches/metro@0.83.3.patch (pnpm committed patch).
- [Admin code source of truth](admin-auth-code-source.md) — /api/admin/login checks ADMIN_ACCESS_KEY env before the DB code; the two can disagree. Socket singleton: one hook cleanup disconnects all.
- [Live tally seeding](live-tally-seeding.md) — seed+socket live counts must use the synchronous ref store in lib/live-tally; React-state flags misroute transition events and double-count.
- [Access code security model](access-code-security.md) — trivia 4–6 chars / case-insensitive; admin 12–64 chars / bcrypt hashed / never returned to client; bootstrap auto-migrates plain text.
- [Game access authorization](game-access-authorization.md) — only server-side room-code grants or participation authorize a player to see or join a game.
- [Tenant aggregate isolation](tenant-aggregate-isolation.md) — host metrics must be derived through owned-game joins, never global player or answer totals.
- [Content filter](content-filter.md) — naughty-words list, collapse-3+-to-2 normalization (not to-1 or Niger false-positives), 4 server enforcement points, client surfacing pattern.
- [Player removal (kick)](player-removal.md) — lib/db dist must be rebuilt (npx tsc) after new schema tables; userId-based block; player:kicked socket to game room; active-games-only guard.
- [API server zod import](api-server-zod.md) — api-server has no direct zod dependency; use plain typeof guards for inline validation, or @workspace/api-zod for generated schemas. `zod/v4` import causes build failure.
- [Commons content filter matching](commons-content-filter-matching.md) — image safety terms must use whole-term matching; substring matching blocks ordinary metadata such as “category.”
- [Mobile OTP reset limits](mobile-otp-reset-limits.md) — OTP attempts need a rolling, account-stable HMAC key; fixed windows or per-token keys can be reset by timing or code reissue.
- [OpenTDB supplement compatibility](opentdb-supplement-compatibility.md) — import modes are server-validated locally so existing OpenAPI/Orval clients and standard imports remain unchanged.
- [Development database migration drift](development-database-migration-drift.md) — player login can 500 when the development DB lacks the game access-grants migration.
- [Admin session revocation](admin-session-revocation.md) — database revocation must disconnect active Socket.IO hosts; email-only migration sessions are account-backed, not legacy code sessions.
- [Expo Launch App Store state](expo-launch-app-state.md) — guided submission can retain a stale App Store record; compare Launch IDs with app.json/eas.json before changing bundle identifiers.
- [API eval worker flags](api-eval-worker-flags.md) — avoid `node --input-type=module` for one-off scripts importing the built API; Pino workers inherit the flag and crash.
