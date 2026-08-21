# Threat Model

## Project Overview

Trivia Night is a multiplayer pub-quiz web application. Players join live games using an access code, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards. Hosts manage games, questions (including Gemini AI generation/fact-check and OpenTDB import), and settings.

- **Stack:** Node.js 24 / TypeScript, Express 5, PostgreSQL + Drizzle ORM, Socket.IO, React frontend (Vite), pnpm workspaces.
- **Auth model:** Open self-service host registration (`POST /api/auth/email/register`) — any visitor with a valid email address can create a host account. The account is inactive until the email verification link is clicked. The shared admin access-code login path (`POST /api/admin/login`) is removed (410). Players authenticate via per-game access codes only.
- **Deployment:** Publicly deployed at `https://mktrivia.com` (autoscale, Replit-managed TLS). Mobile Expo update server is deployed at `/mobile/`.

## Assets

- **Host email accounts** — Email/password or SSO accounts in `admin_accounts`. A compromised account grants full CRUD over that host's own games and questions.
- **Player names and IDs** — Display names chosen at login and participant identity data.
- **Game and question data** — Game configs, question banks, correct answers, participant lists, scores, and live answer activity. Correct answers are normally stripped from player-facing responses while a game is active.
- **Admin sessions and bearer tokens** — An active host session grants control over that host's games; mobile admin tokens are HMAC-signed with `SESSION_SECRET`.
- **Google API key** — Used for Gemini AI generation; stored as an environment secret. Exposure allows quota abuse.
- **Owner access key** — `ADMIN_ACCESS_KEY`, used as a Bearer token for `/api/owner/*`. Exposure grants platform administration, including host and report data and plan changes.

## Trust Boundaries

- **Browser/mobile client → API and Socket.IO** — All game and host actions cross this boundary. Clients are untrusted; every HTTP object and Socket.IO room must be authenticated and authorized server-side.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle. Queries must remain parameterized and tenant/object scoped.
- **API → external services** — Gemini, OpenTDB, Wikimedia, and Resend are called server-side. Gemini/image data and email content cross into trusted services and must be constrained.
- **Public / authenticated** — Health, auth, verification/reset, and reports are public; gameplay and host APIs require the appropriate session. Player authentication does not imply access to every game.
- **Host / platform owner** — Hosts may manage only their own games. The owner bearer key controls `/api/owner/*`.
- **Host tenant / game room** — HTTP host routes enforce game ownership, and Socket.IO `game:join` performs host ownership and player participation checks before admitting a socket.
- **Mobile update server** — `artifacts/mobile/server/serve.js` is a separate public static server. Platform values and static paths must remain constrained to the build root.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/lib/socket.ts`, and `artifacts/mobile/server/serve.js`.
- **Highest-risk areas:** host session logic in `routes/emailAuth.ts` and `lib/mobileAuth.ts`; tenant isolation in `lib/assertGameOwnership.ts`; player cross-game reads in `routes/games.ts`, `routes/questions.ts`, `routes/play.ts`, and `routes/results.ts`; Socket.IO room admission in `lib/socket.ts`; AI grading in `services/geminiApi.ts`; owner API key enforcement in `routes/owner.ts`.
- **Public surfaces:** `/api/healthz`, `/api/auth/*`, `/api/admin/me`, `/api/auth/email/verify`, `/api/auth/email/login`, `/api/auth/email/forgot-password`, `/api/auth/email/reset-password`, `/api/auth/email/register`, `POST /api/reports`, and `/mobile/`.
- **Host surface:** `/api/games`, `/api/questions`, `/api/stats`, Gemini/OpenTDB imports, results export, account, and kick routes. Host game operations must be scoped by `ownerAdminId`.
- **Owner-only surface:** `/api/owner/*` protected by `ADMIN_ACCESS_KEY`.
- **Player surface:** game join, answers, results, participant/question reads, and Socket.IO game rooms. Player access must be limited to games joined or otherwise explicitly authorized.
- **Dev-only:** `artifacts/mockup-sandbox/` is a design canvas and is not production-reachable.

## Threat Categories

### Spoofing

Host registration is open to visitors with a valid email address. Accounts remain inactive until verification. Email/SSO login establishes an admin session with `adminAccountId`; player login establishes a player session with `userId` and allowed game IDs. Sessions use httpOnly, Secure, SameSite cookies, and login regenerates the session ID. Mobile bearer tokens use HMAC-SHA256 and expire. Password reset and password-change flows must invalidate old sessions/tokens. The mobile reset flow currently uses a six-digit code, so distributed and persistent attempt controls are required to prevent account takeover.

**Required guarantees:**
- Email accounts MUST be inactive until verification.
- Session IDs MUST be regenerated on login.
- Cookies MUST be httpOnly, Secure in production, and SameSite constrained.
- SSO tokens MUST verify signature, issuer, audience, expiry, and subject.
- Player and host session types MUST not be confused when applying authorization.
- Per-game access codes MUST use a CSPRNG and MUST never appear in player responses.
- Password-reset codes MUST have sufficient entropy and failed attempts MUST be bounded per account as well as per source.

### Tampering

Correct answers and score updates are computed server-side. Player submissions are scoped to the session user and participant row, and duplicate submissions are rejected. AI grading treats player answers as untrusted and clamps the resulting score.

**Required guarantees:**
- Game status, points, correctness, and participant identity MUST be server-controlled.
- Every answer and host mutation MUST be scoped to the exact game and authorized subject.
- Socket.IO events MUST not permit a host to subscribe to another tenant's room.

### Information Disclosure

The server must keep game data and participant activity within the correct game/tenant boundary. Current scan findings include an unscoped `GET /games` listing reachable by player sessions, platform-wide aggregate statistics exposed to any authenticated host, and the unauthenticated `next-by-host` metadata endpoint. Legacy admin sessions without `adminAccountId` also retain a documented cross-tenant bypass in `assertGameOwnership`. During active games, the answer-submission response currently includes the correct answer for slider and image-hotspot questions.

**Required guarantees:**
- Player reads of game details, questions, participants, lists, and results MUST require participation or another explicit game authorization; a missing `adminAccountId` MUST not mean super-admin for player sessions.
- Player-facing responses MUST never include active-game access codes or correct answers unless explicitly intended after completion.
- Host reads and writes MUST be scoped to `ownerAdminId`.
- Platform aggregate endpoints MUST scope results to the requesting host unless the data is intentionally public.
- Socket.IO room admission MUST enforce player membership and host ownership before joining.
- Errors and logs MUST not disclose secrets, reset tokens, or database internals.
- Image fetches MUST remain restricted to the Wikimedia allowlist; static file paths MUST remain under the mobile build root.

### Elevation of Privilege

Host routes use `requireAdmin`, player routes use `requireUser`, and shared reads use `requireAuth`, but shared authorization helpers must distinguish player sessions from legacy admin sessions. The removed code-based login route must remain unavailable and old legacy sessions must not retain unrestricted tenant access. Owner routes require the separate bearer key. Account deletion, password changes, game mutation, question mutation, exports, and plan changes require exact subject/object authorization.

**Required guarantees:**
- Authentication MUST be followed by object-level authorization for every sensitive game, question, participant, report, and owner action.
- Client-side route guards and hidden controls MUST never substitute for server checks.
- Full game rows and credentials MUST not be returned through alternate read endpoints.

### Denial of Service

Auth, player join, answer submission, Gemini, OpenTDB, and reports endpoints have rate limits. Public reports use a PostgreSQL-backed store, but auth rate limiting currently uses the default per-process in-memory store. External service calls use bounded operations and timeouts. Limits should be shared across autoscale instances where the threat depends on a global budget, and resource-intensive operations should remain authenticated.

**Required guarantees:**
- Password, reset-code, and SSO endpoints MUST resist distributed brute force and abuse.
- Auth and reset-code limits MUST persist across restarts and replicas, and reset attempts MUST be bound to the target account.
- AI generation and import operations MUST remain authenticated, rate-limited, and usage-metered.
- Request bodies, uploaded/static content, and external calls MUST have bounded size/time.

### Repudiation

Sensitive host and owner mutations should be attributable to the authenticated session and logged without recording passwords, bearer tokens, or reset links. Database and platform-owner auditability is important for account, plan, game, and report changes.
