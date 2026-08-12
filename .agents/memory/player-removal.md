---
name: Player removal (kick) feature
description: Architecture and gotchas for the host-initiated player removal flow.
---

## Rule
`lib/db` uses `composite: true` in its tsconfig and emits `.d.ts` to `lib/db/dist/`.
When adding new schema tables, run `cd lib/db && npx tsc -p tsconfig.json` to regenerate
declaration files before running api-server typecheck — otherwise TS2724 "no exported member" errors appear.

**Why:** api-server project references read compiled `.d.ts` from `lib/db/dist/`, not source.
**How to apply:** Any time a new table or column is added to `lib/db/src/schema/`, rebuild with the command above.

## Critical: integration tests use the built dist, not source
`src/routes/play.test.ts` and `app.test.ts` both import from `../../dist/app.mjs`
(a pre-bundled production artifact). Source edits to routes or schema are NOT picked
up until you run `pnpm run build` in `artifacts/api-server/`.

**Why:** The test comment says "Requires dist/app.mjs — run `pnpm run build` first."
**How to apply:** Always run `pnpm run build` before `pnpm run test:integration` or `pnpm run test:all`.

## Schema: do not use `sql` expressions inside pgTable index definitions
Using `sql\`lower(${col})\`` inside a Drizzle `pgTable(...)` index causes silent
column-recognition failures at runtime. Define functional indexes only in migration SQL.

**Why:** The sql expression in the index definition confused Drizzle's schema parser,
causing it to not recognize new columns for INSERT operations.
**How to apply:** For functional indexes (e.g. `lower(display_name)`), write the
`CREATE INDEX` statement in a migration SQL file only — not in the Drizzle schema file.

## Identifier choice
Player removal blocks by two factors (both checked on join):
1. `userId` — catches the same browser session after the original kick.
2. Display name (case-insensitive, `lower()` SQL comparison) — catches a player
   who cleared storage or switched devices and rejoins under the same name.

`display_name` is stored in `removed_participants` at kick time (captured from the
`users` table via `innerJoin` in the kick route). Migration:
`lib/db/migrations/0004_removed_participants_display_name.sql`.

Residual gap: a player who uses a completely different display name on a fresh device
is not blocked. Accepted; device fingerprinting would be needed for stronger enforcement.

## Socket event
`player:kicked` is in `ServerToClientEvents`. The server emits to the whole game room;
each client checks `p.userId === myUserId` and self-handles if they are the target.

## Tables
`removed_participants` table: (game_id, user_id) with UNIQUE constraint + CASCADE from games + users.
Migration: `lib/db/migrations/0003_add_removed_participants.sql` (applied to dev).

## Endpoint
`DELETE /api/games/:gameId/participants/:userId` — requireAdmin + assertGameOwnership.
Only works on active games (409 if status !== 'active').
