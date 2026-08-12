---
name: Player removal (kick) feature
description: Architecture and gotchas for the host-initiated player removal flow.
---

## Rule
`lib/db` uses `composite: true` in its tsconfig and emits `.d.ts` to `lib/db/dist/`.
When adding new schema tables, run `cd lib/db && npx tsc -p tsconfig.json` to regenerate
declaration files before running api-server typecheck — otherwise TS2724 "no exported member" errors appear.

**Why:** api-server project references read compiled `.d.ts` from `lib/db/dist/`, not source.
**How to apply:** Any time a new table is added to `lib/db/src/schema/`, rebuild with the command above.

## Identifier choice
Player removal blocks by `userId` (users table row ID, set in session on login).
Limitation: cleared cookies / incognito / new device creates a new userId and bypasses the block.
This is accepted; it prevents casual rejoin without requiring device fingerprinting.

## Socket event
`player:kicked` is in `ServerToClientEvents`. The server emits to the whole game room;
each client checks `p.userId === myUserId` and self-handles if they are the target.

## Tables
`removed_participants` table: (game_id, user_id) with UNIQUE constraint + CASCADE from games + users.
Migration: `lib/db/migrations/0003_add_removed_participants.sql` (applied to dev).

## Endpoint
`DELETE /api/games/:gameId/participants/:userId` — requireAdmin + assertGameOwnership.
Only works on active games (409 if status !== 'active').
