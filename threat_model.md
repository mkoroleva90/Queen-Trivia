# Threat Model

## Project Overview

Trivia Night is a multiplayer pub-quiz web application. Players join live games using an access code, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards. Admins manage games, questions (with Gemini AI generation / fact-check and OpenTDB import), and settings.

- **Stack:** Node.js 24 / TypeScript, Express 5, PostgreSQL + Drizzle ORM, Socket.IO, React frontend (Vite), pnpm workspaces.
- **Auth model:** Simple shared-secret access codes (one player code, one admin code) stored in `admin_settings`. Verified at login, then tracked via `express-session` cookies.
- **Deployment:** Not yet deployed (isDeployed: false). When deployed, Replit provides TLS.

## Assets

- **Access codes** — The trivia and admin access codes are the only authentication factors. Compromise allows anyone to join games as a player or take full admin control.
- **Player names** — Display names chosen at login; no email or PII beyond the chosen nickname, but still a data asset.
- **Game and question data** — Game configs, questions, and correct answers are stored server-side. Correct answers are stripped from player-facing responses (except when the game is completed).
- **Admin session** — An active admin session grants full control over games, questions, settings, and result exports.
- **Google API key** — Used for Gemini AI generation; stored as an env secret. Exposure would allow abuse of the project's Gemini quota.

## Trust Boundaries

- **Browser → API** — All game and admin actions cross this boundary. Express session cookies authenticate the caller. The client is fully untrusted.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle ORM (parameterized queries). SQL injection risk is low given ORM usage.
- **API → External services** — Gemini API (Google) and OpenTDB are called server-side. Both are outbound-only; no user-supplied URLs are fetched.
- **Public / Authenticated** — `/api/health` and `/api/auth/*` are public. All gameplay and admin endpoints require a session.
- **Player / Admin** — Admins have full CRUD over games, questions, and settings. Players can only join games, submit answers, and read leaderboards. Enforced server-side via `requireAdmin` and `requireUser` middleware.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts` (Express setup and CORS)
- **Highest-risk areas:** CORS config in `app.ts`; unauthenticated routes in `users.ts`; admin session logic in `session.ts` and `requireAdmin.ts`
- **Public surface:** `/api/health`, `/api/auth/verify`, `/api/auth/login`, `/api/admin/login`
- **Admin surface:** `/api/settings`, `/api/games` (POST/PATCH/DELETE), `/api/questions` (POST/PATCH/DELETE), `/api/stats/summary`, Gemini and OpenTDB import routes
- **Player surface:** `/api/games` (GET), `/api/games/:id/join`, `/api/games/:id/answers`, `/api/games/:id/results`
- **Dev-only:** `artifacts/mockup-sandbox/` — design canvas, not production-reachable

## Threat Categories

### Spoofing

Players and admins authenticate with shared access codes. There is no per-user password or MFA. Anyone who learns the admin access code can gain full admin access. The default codes (`PLAY2026` / `ADMIN2026`) are documented in `replit.md` and may be left in place in development or test deployments.

**Required guarantees:**
- Default access codes MUST be changed before public deployment.
- Sessions MUST be tied to httpOnly, Secure, SameSite cookies (currently done correctly).
- Admin and player codes MUST remain distinct (enforced by settings PATCH validation).

### Tampering

Correct answers and question data are fetched from the database server-side; the answer-grading logic uses the DB-stored `correctAnswer`, not any client-supplied value. Score updates are computed server-side. Player submissions are scoped to the session user ID.

**Potential gap:** The `alternates` field used in answer grading comes from `questionsTable.options.alternateAnswers`—a DB column. This is safe as long as question creation is admin-only (it is).

### Information Disclosure

- **Correct answers:** Stripped from `GET /api/games/:gameId/questions` responses for non-admin sessions. Exposed only after a game is `completed`. This is correctly implemented.
- **Player enumeration:** `GET /api/users/:userId` is unauthenticated, and the `users` table uses sequential integer IDs. A caller can enumerate all player names with a simple loop (see vulnerability report).
- **CORS credential theft:** The CORS policy reflects any origin with credentials allowed, enabling cross-origin session abuse (see vulnerability report).

### Elevation of Privilege

- Admin routes are protected by `requireAdmin` middleware checking `req.session.isAdmin`.
- Player routes use `requireUser` checking `req.session.userId`.
- `requireAuth` accepts either an admin or a player session; it is used for read-only endpoints accessible to both roles (game listing, game details, participant list, leaderboard).
- Answer history (`GET /games/:gameId/users/:userId/answers`) checks that `req.session.userId === params.data.userId`—a player can only view their own answers.

### Denial of Service

- Auth endpoints (`/api/auth/login`, `/api/admin/login`) are rate-limited (10 req / 15 min per IP).
- Answer submission is rate-limited (30 req / 60 sec per IP).
- `POST /api/users` has **no rate limit and no authentication**, making it an easy target for database flooding (see vulnerability report).
- Gemini and OpenTDB import endpoints are rate-limited per IP.
