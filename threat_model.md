# Threat Model

## Project Overview

Trivia Night is a multiplayer pub-quiz web application. Players join live games using an access code, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards. Admins manage games, questions (with Gemini AI generation / fact-check and OpenTDB import), and settings.

- **Stack:** Node.js 24 / TypeScript, Express 5, PostgreSQL + Drizzle ORM, Socket.IO, React frontend (Vite), pnpm workspaces.
- **Auth model:** Simple shared-secret access codes (one player code, one admin code) stored in `admin_settings`. Verified at login, then tracked via `express-session` cookies.
- **Deployment:** Publicly deployed at `https://mktrivia.com` (autoscale, Replit-managed TLS).

## Assets

- **Access codes** — The trivia and admin access codes are the only authentication factors. Compromise allows anyone to join games as a player or take full admin control.
- **Player names** — Display names chosen at login; no email or PII beyond the chosen nickname.
- **Game and question data** — Game configs, questions, and correct answers are stored server-side. Correct answers are stripped from player-facing responses (except when the game is completed).
- **Admin session** — An active admin session grants full control over games, questions, settings, and result exports.
- **Google API key** — Used for Gemini AI generation; stored as an env secret. Exposure would allow abuse of the project's Gemini quota.

## Trust Boundaries

- **Browser → API** — All game and admin actions cross this boundary. Express session cookies authenticate the caller. The client is fully untrusted.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle ORM (parameterized queries). SQL injection risk is low given ORM usage.
- **API → External services** — Gemini API (Google) and OpenTDB are called server-side. Image URLs from Gemini are allowlisted to `upload.wikimedia.org/wikipedia/commons/` before any outbound fetch. OpenTDB is a fixed upstream endpoint.
- **Public / Authenticated** — `/api/health`, `/api/auth/*`, and `/api/admin/me` are public. All gameplay and admin endpoints require a valid session.
- **Player / Admin** — Admins have full CRUD over games, questions, and settings. Players can only join games, submit answers, and read leaderboards. Enforced server-side via `requireAdmin` and `requireUser` middleware.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts` (Express setup and CORS)
- **Highest-risk areas:** Admin session logic in `routes/session.ts`; access code comparison in `routes/session.ts` and `routes/auth.ts`; default credential documentation in `replit.md`
- **Public surface:** `/api/health`, `/api/auth/verify`, `/api/auth/login`, `/api/admin/login`, `/api/auth/me`, `/api/admin/me`
- **Admin surface:** `/api/settings`, `/api/games` (POST/PATCH/DELETE), `/api/questions` (POST/PATCH/DELETE), `/api/stats/summary`, Gemini and OpenTDB import routes, `/api/games/:id/results/export.csv`
- **Player surface:** `/api/games` (GET), `/api/games/:id/join`, `/api/games/:id/answers`, `/api/games/:id/results`
- **Dev-only:** `artifacts/mockup-sandbox/` — design canvas, not production-reachable

## Threat Categories

### Spoofing

Players and admins authenticate with shared access codes. There is no per-user password or MFA. Anyone who learns the admin access code can gain full admin access. Codes are randomly generated at first boot (no documented defaults); any legacy publicly documented default codes (`trivia-default-admin-credentials-in-source`) are automatically rotated at boot.

**Required guarantees:**
- Access codes MUST NOT be documented in the repository; random codes are seeded at first boot and rotated if legacy defaults are detected.
- Sessions MUST be tied to httpOnly, Secure, SameSite cookies — currently implemented correctly.
- Admin and player codes MUST remain distinct — enforced by settings PATCH validation (minimum 8 characters).
- Auth endpoints are rate-limited (10 req / 15 min per IP) — correctly implemented.

### Tampering

Correct answers and question data are fetched from the database server-side; the answer-grading logic uses the DB-stored `correctAnswer`, not any client-supplied value. Score updates are computed server-side. Player submissions are scoped to the session user ID.

### Information Disclosure

- **Correct answers:** Stripped from `GET /api/games/:gameId/questions` responses for non-admin sessions. Exposed only after a game is `completed`. Correctly implemented.
- **CORS:** Previously reflected any origin with credentials; now uses an allowlist restricted to `REPLIT_DOMAINS`. **Fixed.**
- **User enumeration:** Previously unauthenticated; both GET and POST `/api/users/:userId` now require `requireAdmin`. **Fixed.**
- **Image SSRF:** Gemini-generated image URLs are validated against a strict allowlist (`upload.wikimedia.org/wikipedia/commons/`) before any outbound fetch. Safe.

### Elevation of Privilege

- Admin routes are protected by `requireAdmin` middleware checking `req.session.isAdmin`.
- Player routes use `requireUser` checking `req.session.userId`.
- `requireAuth` accepts either an admin or a player session for shared read-only endpoints.
- Answer history (`GET /games/:gameId/users/:userId/answers`) checks `req.session.userId === params.data.userId` — a player can only view their own answers.
- Socket.IO `game:join` events verify participant membership in the DB before admitting a player to the room.

### Denial of Service

- Auth endpoints (`/api/auth/login`, `/api/admin/login`, `/api/auth/verify`) are rate-limited (10 req / 15 min per IP).
- Answer submission is rate-limited (30 req / 60 sec per IP).
- Gemini generation is rate-limited (5 req / 10 min per IP); single operations rate-limited (20 req / 10 min).
- OpenTDB import is rate-limited (10 req / 10 min per IP).
- `POST /api/users` requires admin — the previously-noted DB flood vector is closed.
