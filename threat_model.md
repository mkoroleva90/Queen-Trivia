# Threat Model

## Project Overview

Trivia Night is a multiplayer pub-quiz web application. Players join live games using an access code, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards. Admins manage games, questions (with Gemini AI generation / fact-check and OpenTDB import), and settings.

- **Stack:** Node.js 24 / TypeScript, Express 5, PostgreSQL + Drizzle ORM, Socket.IO, React frontend (Vite), pnpm workspaces.
- **Auth model:** Two parallel admin auth paths: (1) shared admin access code stored in `admin_settings`; (2) new email/password accounts in `admin_accounts` table (commit da8aba1). Players authenticate via a shared trivia code or per-game code.
- **Deployment:** Publicly deployed at `https://mktrivia.com` (autoscale, Replit-managed TLS). Mobile Expo update server deployed at `/mobile/`.

## Assets

- **Access codes** — The trivia and admin access codes are the only authentication factors for the original auth path. Compromise allows anyone to join games as a player or take full admin control.
- **Admin email accounts** — New per-admin accounts (email + bcrypt password) in `admin_accounts`. A compromised account grants the same full admin access as the shared code.
- **Player names** — Display names chosen at login; no email or PII beyond the chosen nickname.
- **Game and question data** — Game configs, questions, and correct answers are stored server-side. Correct answers are stripped from player-facing responses (except when the game is completed).
- **Admin session** — An active admin session grants full control over games, questions, settings, and result exports.
- **Google API key** — Used for Gemini AI generation; stored as an env secret. Exposure would allow abuse of the project's Gemini quota.

## Trust Boundaries

- **Browser → API** — All game and admin actions cross this boundary. Express session cookies authenticate the caller. The client is fully untrusted.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle ORM (parameterized queries). SQL injection risk is low given ORM usage.
- **API → External services** — Gemini API (Google) and OpenTDB are called server-side. Image URLs from Gemini are allowlisted to `upload.wikimedia.org/wikipedia/commons/` before any outbound fetch. OpenTDB is a fixed upstream endpoint. Resend (email) is called server-side for verification and password-reset emails.
- **Public / Authenticated** — `/api/health`, `/api/auth/*`, `/api/admin/me`, and the new `/api/auth/email/*` routes are public. All gameplay and admin endpoints require a valid session.
- **Player / Admin** — Admins have full CRUD over games, questions, and settings. Players can only join games, submit answers, and read leaderboards. Enforced server-side via `requireAdmin` and `requireUser` middleware.
- **Mobile server** — The Expo update server at `/mobile/` is a separate Node.js HTTP process (`artifacts/mobile/server/serve.js`). It serves static build assets and platform manifests. The `expo-platform` header is attacker-controlled input at this boundary.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts` (Express setup and CORS), `artifacts/mobile/server/serve.js` (mobile update server)
- **Highest-risk areas:** Email auth routes in `routes/emailAuth.ts` (open registration — CRITICAL open finding); Admin session logic in `routes/session.ts`; access code comparison in `routes/session.ts` and `routes/auth.ts`; per-game access code generation in `routes/games.ts`; AI grading in `services/geminiApi.ts` (`gradeWithAI` — residual prompt injection, open MEDIUM finding); manifest path construction in `artifacts/mobile/server/serve.js` (path traversal, open MEDIUM finding)
- **Public surface:** `/api/health`, `/api/auth/verify`, `/api/auth/login`, `/api/admin/login`, `/api/auth/me`, `/api/admin/me`, `/api/auth/email/register`, `/api/auth/email/verify`, `/api/auth/email/login`, `/api/auth/email/forgot-password`, `/api/auth/email/reset-password`
- **Admin surface:** `/api/settings`, `/api/games` (POST/PATCH/DELETE), `/api/questions` (POST/PATCH/DELETE), `/api/stats/summary`, Gemini and OpenTDB import routes, `/api/games/:id/results/export.csv`
- **Player surface:** `/api/games` (GET), `/api/games/:id/join`, `/api/games/:id/answers`, `/api/games/:id/results`
- **Dev-only:** `artifacts/mockup-sandbox/` — design canvas, not production-reachable

## Threat Categories

### Spoofing

Players and admins authenticate with shared access codes (original path). A second admin auth path was added in da8aba1: email/password accounts in `admin_accounts`. Both paths produce identical admin sessions (`req.session.isAdmin = true`). Codes are randomly generated at first boot; any legacy defaults are rotated at boot.

**Required guarantees:**
- Access codes MUST NOT be documented in the repository; random codes are seeded at first boot and rotated if legacy defaults are detected. ✅ Implemented.
- Sessions MUST be tied to httpOnly, Secure, SameSite cookies — correctly implemented. ✅
- Admin and player codes MUST remain distinct — enforced by settings PATCH validation (minimum 8 characters). ✅
- Auth endpoints are rate-limited (10 req / 15 min per IP) — correctly implemented. ✅
- **Session IDs MUST be regenerated on login** — `req.session.regenerate()` is called on all login paths. ✅
- **Per-game access codes MUST use a CSPRNG** — `routes/games.ts` uses `crypto.randomBytes`. ✅
- **Email admin registration MUST be gated** — `POST /api/auth/email/register` is currently open to anyone; no prior-admin approval, invite token, or domain restriction. ⚠️ CRITICAL open finding (`open-admin-registration-email-auth`).

### Tampering

Correct answers and question data are fetched from the database server-side. Score updates are computed server-side. Player submissions are scoped to the session user ID.

- **AI grader prompt injection:** `short_response` questions use Gemini AI to grade answers (`gradeWithAI` in `services/geminiApi.ts`). The player-controlled `userAnswer` is JSON-encoded before embedding in the prompt, which mitigates structural injection. However, the model is instructed to mentally decode the JSON and treat the content as text to evaluate — making semantic-level prompt injection (override instructions embedded in the answer) still viable. ⚠️ Open MEDIUM finding (`ai-grader-prompt-injection-short-response`).

### Information Disclosure

- **Correct answers:** Stripped from `GET /api/games/:gameId/questions` responses for non-admin sessions. Exposed only after a game is `completed`. ✅
- **CORS:** Restricted to an allowlist of this app's own Replit domains (`REPLIT_DOMAINS` env var). ✅
- **User enumeration:** Both GET and POST `/api/users/:userId` require `requireAdmin`. ✅
- **Image SSRF:** Gemini-generated image URLs are validated against a strict allowlist (`upload.wikimedia.org/wikipedia/commons/`) before any outbound fetch. ✅
- **CSV formula injection:** The results export sanitizes formula trigger characters in player names via `escapeCsv()`. ✅
- **Mobile manifest path traversal:** The `expo-platform` header is used as a path component in `serveManifest` without a `startsWith(STATIC_ROOT)` boundary check, allowing traversal to read any `manifest.json` file on the filesystem. ⚠️ Open MEDIUM finding (`mobile-server-manifest-path-traversal`).

### Elevation of Privilege

- Admin routes are protected by `requireAdmin` middleware checking `req.session.isAdmin`.
- Player routes use `requireUser` checking `req.session.userId`.
- `requireAuth` accepts either an admin or a player session for shared read-only endpoints.
- Answer history (`GET /games/:gameId/users/:userId/answers`) checks `req.session.userId === params.data.userId`.
- Socket.IO `game:join` events verify participant membership in the DB.
- **Password reset invalidates existing sessions** — `POST /api/auth/email/reset-password` deletes all session rows for the account from the sessions table via `DELETE FROM sessions WHERE sess->>'adminEmail' = ?`. ✅ Fixed.

### Denial of Service

- Auth endpoints (`/api/auth/login`, `/api/admin/login`, `/api/auth/verify`, `/api/auth/email/*`) are rate-limited (10 req / 15 min per IP).
- Answer submission is rate-limited (30 req / 60 sec per IP).
- Gemini generation is rate-limited (5 req / 10 min per IP); single operations rate-limited (20 req / 10 min).
- OpenTDB import is rate-limited (10 req / 10 min per IP).
- `POST /api/users` requires admin — the previously-noted DB flood vector is closed.
