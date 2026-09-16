---
name: Access code security model
description: How trivia and admin access codes are validated, stored, and rate-limited after the 2026-08 hardening pass.
---

## Rules

### Trivia access code
- 8–12 alphanumeric characters only.
- Case-insensitive on entry (server normalises to uppercase before storing; comparisons always use `.toUpperCase()`).
- Generated without confusable chars (no 0/O, 1/I/l) — alphabet in `TRIVIA_CODE_ALPHABET`.
- Generated game codes are 10 characters.
- Verification rate limit: a dedicated failure-counting limiter (`roomCodeVerifyRateLimit`, key namespace `room-verify:`) — 30 FAILED verifications per 15 minutes per source IP, PostgreSQL-backed across replicas. Successful verifications never count: whole rooms of players join from one venue/household/carrier-NAT IP, and the strict success-counting limiter (8/15 min) locked all of them out of the app in production. Because the invalid-code response is HTTP 200, the route records the outcome in `res.locals["roomCodeValid"]` and the limiter reads it via `requestWasSuccessful` — never rely on status codes here.
- Player admission and code verification refuse legacy codes shorter than 8 characters.

### Admin access code
- 12–64 characters; spaces allowed (passphrase-friendly).
- Rejects: sequential runs ≥4, repeated chars ≥3, keyboard rows ≥4, common-password list.
- Stored as bcrypt hash (cost 12). **Never returned to client.**
- `GET /api/settings` returns `{ triviaAccessCode, adminCodeIsSet: boolean }` — no hash.
- `PATCH /api/settings`: omit or send empty string → server keeps existing hash unchanged.
- Rate limit: `authRateLimit` — 8 per 15 minutes.
- The auth limiter uses the shared PostgreSQL store and must not exempt
  development loopback traffic: the Replit preview proxy can present external
  anonymous requests as loopback.

**Why:** Four-character host-selected codes have only 10,000 numeric possibilities and can be enumerated quickly. Eight characters preserve usability while making online guessing impractical (36^8 ≈ 2.8e12 codes; at 30 failed guesses per 15 minutes enumeration is hopeless). Code verification returns HTTP 200 for both valid and invalid guesses, so a limiter that detects success from the HTTP status does not protect it — success must be signalled explicitly through `res.locals`. Admin codes are long-lived and control game content, so they must also resist offline attacks if the database is exposed.

**How to apply:** Do not add a development or loopback bypass to any of the
authentication limiters. Test preview-facing authentication controls through the
same proxy path used by anonymous visitors. On the verification route, pair
`skipSuccessfulRequests` with a `requestWasSuccessful` callback that reads the
`res.locals["roomCodeValid"]` flag (HTTP status is meaningless there). Never put
a player-facing endpoint on the strict `auth:`-namespaced limiter: its 8/15-min
success-counting budget is sized for host account actions, and sharing it lets
ordinary player traffic block email registration and password resets for the
whole IP. Keep server validation, API schemas, host forms, seeded games, and
test fixtures aligned to the 8-character minimum.

## Bootstrap migration
`bootstrapAccessCodes()` runs at server startup. If `adminAccessCode` does not start with `$2a$`/`$2b$` (i.e. was plain text), it rotates to a new random plaintext, hashes it, and logs the plaintext to the server console — operator must record it before the process exits. The plaintext is never stored.

## Files
- Canonical validation: `artifacts/api-server/src/lib/accessCodeValidation.ts`
- Rate limits: `artifacts/api-server/src/middleware/authRateLimit.ts`
- Settings route: `artifacts/api-server/src/routes/settings.ts`
- Player join (case-insensitive): `artifacts/api-server/src/routes/session.ts` + `auth.ts`
- Bootstrap + migration: `artifacts/api-server/src/lib/bootstrapAccessCodes.ts`
- Web form: `SettingsSection` in `artifacts/trivia-game/src/pages/Admin.tsx` (helpers `stTriviaErr`/`stAdminErr` above it)
- Mobile form: `artifacts/mobile/components/admin/RoomsTab.tsx`
