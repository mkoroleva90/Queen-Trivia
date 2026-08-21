---
name: Access code security model
description: How trivia and admin access codes are validated, stored, and rate-limited after the 2026-08 hardening pass.
---

## Rules

### Trivia access code
- 4–6 alphanumeric characters only.
- Case-insensitive on entry (server normalises to uppercase before storing; comparisons always use `.toUpperCase()`).
- Generated without confusable chars (no 0/O, 1/I/l) — alphabet in `TRIVIA_CODE_ALPHABET`.
- Rate limit: `triviaJoinRateLimit` — 120 per minute, `skipSuccessfulRequests: true` (groups can join at once).

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

**Why:** Admin code is long-lived and controls game content; must resist offline attacks if DB is exposed. Trivia code is ephemeral and party-game grade; short for usability.

**How to apply:** Do not add a development or loopback bypass to the strict
authentication limiter. Test preview-facing authentication controls through the
same proxy path used by anonymous visitors.

## Bootstrap migration
`bootstrapAccessCodes()` runs at server startup. If `adminAccessCode` does not start with `$2a$`/`$2b$` (i.e. was plain text), it rotates to a new random plaintext, hashes it, and logs the plaintext to the server console — operator must record it before the process exits. The plaintext is never stored.

## Files
- Canonical validation: `artifacts/api-server/src/lib/accessCodeValidation.ts`
- Rate limits: `artifacts/api-server/src/middleware/authRateLimit.ts` (`authRateLimit` + `triviaJoinRateLimit`)
- Settings route: `artifacts/api-server/src/routes/settings.ts`
- Player join (case-insensitive): `artifacts/api-server/src/routes/session.ts` + `auth.ts`
- Bootstrap + migration: `artifacts/api-server/src/lib/bootstrapAccessCodes.ts`
- Web form: `SettingsSection` in `artifacts/trivia-game/src/pages/Admin.tsx` (helpers `stTriviaErr`/`stAdminErr` above it)
- Mobile form: `artifacts/mobile/components/admin/RoomsTab.tsx`
