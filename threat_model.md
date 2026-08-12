# Threat Model

## Project Overview

Trivia Night is a multiplayer pub-quiz web application. Players join live games using an access code, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards. Admins (called "hosts") manage games, questions (with Gemini AI generation / fact-check and OpenTDB import), and settings.

- **Stack:** Node.js 24 / TypeScript, Express 5, PostgreSQL + Drizzle ORM, Socket.IO, React frontend (Vite), pnpm workspaces.
- **Auth model:** Open self-service host registration (`POST /api/auth/email/register`) — any visitor with a valid email address can create a host account. The account is inactive until the email verification link is clicked. The previously-supported shared admin access code login path (`POST /api/admin/login`) is fully removed (returns 410). Players authenticate via per-game access codes only.
- **Deployment:** Publicly deployed at `https://mktrivia.com` (autoscale, Replit-managed TLS). Mobile Expo update server deployed at `/mobile/`.

## Assets

- **Host (admin) email accounts** — Per-host accounts (email + bcrypt password) in `admin_accounts`. A compromised account grants full CRUD over that host's own games, questions, and settings for their tenant. The shared admin code field (`admin_settings.adminAccessCode`) is a legacy artifact — the code-based login path is removed; this field is no longer used for authentication.
- **Player names** — Display names chosen at login; no email or PII beyond the chosen nickname.
- **Game and question data** — Game configs, questions, and correct answers are stored server-side. Correct answers are stripped from player-facing responses (except when the game is completed). Each game is scoped to its owning host (`ownerAdminId`).
- **Admin session** — An active admin session grants full control over the host's own games, questions, and settings.
- **Google API key** — Used for Gemini AI generation; stored as an env secret. Exposure would allow abuse of the project's Gemini quota.
- **Owner access key** — `ADMIN_ACCESS_KEY` env var, used as a Bearer token for platform owner management routes (`/api/owner/*`). Exposure would allow full platform administration.

## Trust Boundaries

- **Browser → API** — All game and admin actions cross this boundary. Express session cookies authenticate the caller. The client is fully untrusted.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle ORM (parameterized queries). SQL injection risk is low given ORM usage.
- **API → External services** — Gemini API (Google) and OpenTDB are called server-side. Image URLs from Gemini are allowlisted to `upload.wikimedia.org/wikipedia/commons/` before any outbound fetch. OpenTDB is a fixed upstream endpoint. Resend (email) is called server-side for verification and password-reset emails.
- **Public / Authenticated** — `/api/health`, `/api/auth/*`, `/api/admin/me`, `/api/auth/email/verify`, `/api/auth/email/login`, `/api/auth/email/forgot-password`, `/api/auth/email/reset-password`, `/api/auth/email/register`, and `POST /reports` are public. All gameplay and admin endpoints require a valid session.
- **Host / Platform owner** — Hosts have full CRUD over their own games, questions, and settings. The platform owner uses `ADMIN_ACCESS_KEY` to manage hosts, plans, and reports via `/api/owner/*`. Enforced server-side via `requireAdmin`, `assertGameOwnership`, and `requireOwnerKey`.
- **Tenant isolation** — `assertGameOwnership` enforces that email-auth hosts (those with `adminAccountId` in session) can only access their own games. Legacy code-based sessions (no `adminAccountId`) are treated as super-admin, but the code-based login path is removed (410); no new legacy sessions can be created.
- **Mobile server** — The Expo update server at `/mobile/` is a separate Node.js HTTP process (`artifacts/mobile/server/serve.js`). It serves static build assets and platform manifests. The `expo-platform` header is strictly validated to `'ios'` or `'android'` before constructing any file path. Static file serving uses a `startsWith(STATIC_ROOT)` boundary check.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts` (Express setup and CORS), `artifacts/mobile/server/serve.js` (mobile update server)
- **Highest-risk areas:** Host session logic in `routes/emailAuth.ts`; tenant isolation in `lib/assertGameOwnership.ts`; AI grading in `services/geminiApi.ts` (`gradeWithAI` — residual prompt injection, open MEDIUM finding `ai-grader-prompt-injection-short-response`); owner API key enforcement in `routes/owner.ts`; shared settings mutation in `routes/settings.ts`
- **Public surface:** `/api/health`, `/api/auth/verify`, `/api/auth/login`, `/api/admin/login` (410 tombstone), `/api/auth/me`, `/api/admin/me`, `/api/auth/email/verify`, `/api/auth/email/login`, `/api/auth/email/register`, `/api/auth/email/forgot-password`, `/api/auth/email/reset-password`, `POST /api/reports`
- **Admin (host) surface:** `/api/settings` (PATCH/GET — any authenticated host can update the legacy `adminAccessCode` field; no practical impact since code-based login is removed), `/api/games` (CRUD scoped to ownerAdminId), `/api/questions` (CRUD scoped via assertGameOwnership), `/api/stats/summary`, Gemini and OpenTDB import routes, `/api/games/:id/results/export.csv`
- **Owner-only surface:** `/api/owner/*` — protected by `ADMIN_ACCESS_KEY` Bearer token
- **Player surface:** `/api/games` (GET), `/api/games/:id/join`, `/api/games/:id/answers`, `/api/games/:id/results`
- **Dev-only:** `artifacts/mockup-sandbox/` — design canvas, not production-reachable

## Threat Categories

### Spoofing

Host registration is open to any visitor with a valid email address. After email verification, the account receives an admin session (`isAdmin = true`) scoped to their tenant via `adminAccountId`. The code-based admin login path is fully removed (returns 410). Sessions are tied to httpOnly, Secure, SameSite cookies. Session IDs are regenerated on login. Per-game access codes use a CSPRNG (`crypto.randomBytes`).

**Required guarantees:**
- Host accounts are inactive until email is verified. ✅
- Sessions MUST be tied to httpOnly, Secure, SameSite cookies. ✅
- Auth endpoints are rate-limited (10 req / 15 min per IP). ✅
- Session IDs MUST be regenerated on login. ✅
- Per-game access codes MUST use a CSPRNG. ✅
- **Open registration:** Any visitor can register as a host. Tenant isolation (via `assertGameOwnership`) ensures hosts can only access their own games. No cross-tenant privilege escalation is possible via email auth.

### Tampering

Correct answers and question data are fetched from the database server-side. Score updates are computed server-side. Player submissions are scoped to the session user ID.

- **AI grader prompt injection:** `write_in` questions use Gemini AI to grade answers (`gradeWithAI` in `services/geminiApi.ts`). The player-controlled `userAnswer` is JSON-encoded, wrapped in delimiters, and the model is instructed to disregard instruction-like content. Server-side score clamping limits score inflation. ⚠️ Open MEDIUM finding (`ai-grader-prompt-injection-short-response`).

### Information Disclosure

- **Correct answers:** Stripped from `GET /api/games/:gameId/questions` responses for non-admin sessions. Exposed only after a game is `completed`. ✅
- **CORS:** Restricted to an allowlist of this app's own Replit domains (`REPLIT_DOMAINS` env var). ✅
- **User enumeration:** Both GET and POST `/api/users/:userId` require `requireAdmin`. ✅
- **Image SSRF:** Gemini-generated image URLs are validated against a strict allowlist (`upload.wikimedia.org/wikipedia/commons/`) before any outbound fetch. ✅
- **CSV formula injection:** The results export sanitizes formula trigger characters in player names via `escapeCsv()`. ✅
- **Mobile manifest path traversal:** `serveManifest` validates `expo-platform` to be exactly `'ios'` or `'android'` before constructing any file path. Static file serving uses a `startsWith(STATIC_ROOT)` boundary check. ✅

### Elevation of Privilege

- Admin routes are protected by `requireAdmin` middleware checking `req.session.isAdmin`.
- Player routes use `requireUser` checking `req.session.userId`.
- `requireAuth` accepts either an admin or a player session for shared read-only endpoints.
- `assertGameOwnership` enforces that email-auth hosts only access their own games.
- Answer history (`GET /games/:gameId/users/:userId/answers`) checks `req.session.userId === params.data.userId`.
- Socket.IO `game:join` events verify participant membership in the DB.
- **Password reset invalidates existing sessions.** ✅
- **Code-based admin login is removed (410 tombstone).** No new legacy "super-admin" sessions can be created. ✅
- **Shared settings mutation:** `PATCH /api/settings` is reachable by any authenticated host. It can modify the `adminAccessCode` field, but this field is no longer used for authentication (code-based login removed). No practical security impact. ℹ️

### Denial of Service

- Auth endpoints (`/api/auth/login`, `/api/admin/login`, `/api/auth/verify`, `/api/auth/email/*`) are rate-limited (10 req / 15 min per IP).
- Answer submission is rate-limited (30 req / 60 sec per IP).
- Gemini generation is rate-limited (5 req / 10 min per IP); single operations rate-limited (20 req / 10 min).
- OpenTDB import is rate-limited (10 req / 10 min per IP).
- `POST /api/users` requires admin — the DB flood vector is closed.
- `POST /api/reports` (public) is not rate-limited. ℹ️ Low-risk since it requires email-verified session context and inserts to a bounded table.
