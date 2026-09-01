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

- **Browser/mobile/player client → API and Socket.IO** — All game and host actions cross this boundary. Clients are untrusted; every HTTP object and Socket.IO room must be authenticated and authorized server-side.
- **API → PostgreSQL** — Application code talks directly to Postgres via Drizzle. Queries must remain parameterized and tenant/object scoped.
- **API → external services** — Gemini, OpenTDB, Wikimedia, and Resend are called server-side. Gemini/image data and email content cross into trusted services and must be constrained.
- **Public / authenticated** — Health, auth, verification/reset, and reports are public; gameplay and host APIs require the appropriate session. Player authentication does not imply access to every game.
- **Host / platform owner** — Hosts may manage only their own games. The owner bearer key controls `/api/owner/*`.
- **Host tenant / game room** — HTTP host routes enforce game ownership, and Socket.IO `game:join` performs host ownership and player participation checks before admitting a socket. The room-code model is intentionally anonymous, so kick enforcement must account for new identities and distributed replicas.
- **Mobile update server** — `artifacts/mobile/server/serve.js` is a separate public static server. Platform values and static paths must remain constrained to the build root.

## Scan Anchors

- **Entry points:** `artifacts/api-server/src/routes/` (all route files), `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/lib/socket.ts`, and `artifacts/mobile/server/serve.js`.
- **Highest-risk areas:** host session logic in `routes/emailAuth.ts` and `lib/mobileAuth.ts`; tenant isolation in `lib/assertGameOwnership.ts`; player cross-game reads and gameplay integrity in `routes/games.ts`, `routes/questions.ts`, `routes/play.ts`, and `routes/results.ts`; Socket.IO room admission/lifecycle in `lib/socket.ts`; AI grading in `services/geminiApi.ts`; owner API key enforcement in `routes/owner.ts`.
- **Public surfaces:** `/api/healthz`, `/api/auth/*`, `/api/admin/me`, `/api/auth/email/verify`, `/api/auth/email/login`, `/api/auth/email/forgot-password`, `/api/auth/email/reset-password`, `/api/auth/email/register`, `POST /api/reports`, and `/mobile/`.
- **Host surface:** `/api/games`, `/api/questions`, `/api/stats`, Gemini/OpenTDB imports, results export, account, and kick routes. Host game operations must be scoped by `ownerAdminId`.
- **Owner-only surface:** `/api/owner/*` protected by `ADMIN_ACCESS_KEY`.
- **Player surface:** game join, answers, results, participant/question reads, and Socket.IO game rooms. Player access must be limited to games joined or otherwise explicitly authorized.
- **Dev-only:** `artifacts/mockup-sandbox/` is a design canvas and is not production-reachable.

## Threat Categories

### Spoofing

Host registration is open to visitors with a valid email address. Accounts remain inactive until verification. Email/SSO login establishes an admin session with `adminAccountId`; player login establishes a player session with `userId` and a durable per-game grant. Sessions use httpOnly, Secure, SameSite cookies, and login regenerates the session ID. Mobile bearer tokens use HMAC-SHA256 and expire; password reset, password change, and account deletion revoke prior admin sessions and attempt to revoke sockets. The mobile reset code is six digits, so the persistent account-scoped failed-attempt limit must remain in force.

**Required guarantees:**
- Email accounts MUST be inactive until verification.
- Session IDs MUST be regenerated on login.
- Cookies MUST be httpOnly, Secure in production, and SameSite constrained.
- SSO tokens MUST verify signature, issuer, audience, expiry, and subject.
- Player and host session types MUST not be confused when applying authorization.
- Per-game access codes MUST use a CSPRNG, have sufficient entropy even when host-customized, and MUST never appear in player responses.
- Password-reset, password-change, and account-deletion actions MUST revoke prior host sessions/tokens and every connected replica's sockets.
- Password-reset codes MUST have sufficient entropy and failed attempts MUST be bounded per account as well as per source.
- Browser login endpoints that establish sessions MUST reject cross-site form submissions using an anti-CSRF mechanism or equivalent origin/fetch-metadata policy.

### Tampering

Correct answers and score updates are computed server-side, and the active answer route accepts only the host-selected current question. The application enforces answer and participant uniqueness at the database boundary and uses transactions for join/kick/code-rotation ordering. A kicked player can nevertheless create a new anonymous identity and re-enter after the host rotates the room code, because the anonymous identity cannot be reliably bound to the removed person. Socket.IO room and revocation state is process-local in the autoscale deployment, so moderation transitions must also be coordinated across replicas.

**Required guarantees:**
- Game status, current question, release/deadline, points, correctness, and participant identity MUST be server-controlled.
- Every answer and host mutation MUST be scoped to the exact game and authorized subject.
- Active player question responses MUST not include matching mappings, ordering sequences, or any other answer-equivalent data.
- `(game_id, user_id)` participant identity and `(user_id, question_id)` answer identity MUST be enforced atomically at the database or transaction boundary.
- A host kick MUST revoke the player's effective access for the game, including anonymous re-authentication paths and sockets connected to other replicas.
- Socket.IO events MUST not permit a host to subscribe to another tenant's room.

### Information Disclosure

The server must keep game data and participant activity within the correct game/tenant boundary. Player list and game reads are scoped to grants or participation, and host reads/writes are scoped to `ownerAdminId`. Active-game question responses redact answer-equivalent matching and ordering data. Socket.IO admission checks current participant membership, but room membership and kick revocation are currently process-local in autoscale, so an already-connected player or host socket may survive a revocation handled by another replica. Host-controlled fact-check URLs are rendered as links and must remain untrusted URL data. Public access-code verification intentionally reveals whether a code is valid, but no public code-availability oracle is exposed.

**Required guarantees:**
- Player reads of game details, questions, participants, lists, and results MUST require participation or another explicit game authorization; a missing `adminAccountId` MUST not mean super-admin for player sessions.
- Player-facing responses MUST never include active-game access codes or correct answers unless explicitly intended after completion.
- Live player-visible statistics and score deltas MUST not reveal whether a probe answer was correct before the player has committed their answer; pre-completion correctness aggregates MUST be withheld or delayed.
- Host reads and writes MUST be scoped to `ownerAdminId`.
- Platform aggregate endpoints MUST scope results to the requesting host unless the data is intentionally public.
- Socket.IO room admission MUST enforce player membership and host ownership before joining, kick operations MUST evict already-connected unauthorized sockets across replicas, and account security revocation MUST evict stale host sockets across replicas.
- Errors and logs MUST not disclose secrets, reset tokens, or database internals.
- Player-facing URLs MUST be restricted to safe schemes such as HTTPS; image fetches MUST remain restricted to the Wikimedia allowlist; static file paths MUST remain under the mobile build root.

### Elevation of Privilege

Host routes use `requireAdmin`, player routes use `requireUser`, and shared reads use `requireAuth`; shared authorization helpers distinguish player sessions from account-backed admin sessions. The removed code-based login route must remain unavailable and old legacy sessions must not retain unrestricted tenant access. Owner routes require the separate bearer key. Account deletion, password changes, game mutation, question mutation, exports, and plan changes require exact subject/object authorization. The anonymous player model means a kick bypass through a new user identity is a moderation-control failure, though it does not grant host privileges. Cross-replica host socket survival currently preserves private observation after account security changes, but not HTTP administrative writes.

**Required guarantees:**
- Authentication MUST be followed by object-level authorization for every sensitive game, question, participant, report, and owner action.
- Client-side route guards and hidden controls MUST never substitute for server checks.
- Full game rows and credentials MUST not be returned through alternate read endpoints.
- `requireAdmin` MUST validate that the account-backed subject still exists and is active, and all account security changes MUST invalidate prior sessions and connected sockets across replicas.

### Denial of Service

Auth, player join, answer submission, Gemini, OpenTDB, and reports endpoints have rate limits. Public reports use a PostgreSQL-backed store, and Socket.IO game joins have per-socket request/concurrency limits. External service calls are bounded where supported and target fixed provider origins. Rate-limit stores currently fail open if PostgreSQL is unavailable, so outage behavior must not expose a practical brute-force or provider-abuse path. Gemini free-tier enforcement is enabled in production, but its check and usage recording are separate from provider work and must not permit concurrent requests to bypass the per-account monthly cap.

**Required guarantees:**
- Password, reset-code, and SSO endpoints MUST resist distributed brute force and abuse.
- Auth and reset-code limits MUST persist across restarts and replicas, and reset attempts MUST be bound to the target account.
- AI generation and import operations MUST remain authenticated, rate-limited, and usage-metered with an atomic per-account reservation or concurrency control.
- Socket.IO events that trigger database work MUST have bounded rate/concurrency and disconnect or backpressure abusive clients.
- Request bodies, uploaded/static content, and external calls MUST have bounded size/time.
- Public static/update servers MUST reject malformed request metadata such as an invalid Host authority without allowing an uncaught exception to terminate the process.

### Repudiation

Sensitive host and owner mutations should be attributable to the authenticated session and logged without recording passwords, bearer tokens, or reset links. Database and platform-owner auditability is important for account, plan, game, participant, answer, and report changes.
