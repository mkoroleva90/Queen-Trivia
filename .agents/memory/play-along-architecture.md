---
name: Play-along feature architecture
description: How the host-plays-along feature works across DB, API, web, and mobile.
---

## The design

When a host enables play-along on game start, a dedicated player-user is auto-created (name = `"${emailLocalPart} (Host)"`) and stored in `games.hostUserId`. A separate admin-only endpoint handles their answers.

**Why:** Admin accounts (`admin_accounts`) and player accounts (`users`) are completely separate tables. Answers require a `users` row + `game_participants` row. Rather than merge the tables, we create a bridge user per game.

**How to apply:** Any code that touches participants or answers must account for `hostUserId` — the host player appears in standings and results alongside real players. Future work (Task #86) should filter/badge them in player-facing views.

## DB columns
- `games.host_plays_along` — boolean NOT NULL DEFAULT FALSE
- `games.host_user_id` — integer nullable FK to users(id) ON DELETE SET NULL

## API endpoint
`POST /api/games/:gameId/host-answer` — requireAdmin, uses `SubmitAnswerBody` schema, grades via `gradeAnswer()`, emits socket event. Returns `SubmitAnswerResponse`.

## Where play-along is activated
Web: `doGoLive()` in `ManageGamesSection` sends `{ status: 'active', hostPlaysAlong: true }` via `PATCH /api/games/:gameId`.
Mobile: `confirmStart()` in `GamesTab.tsx` does the same.

## Generated type files that need hand-patching (codegen broken on Node 24)
When adding fields to Game/GameUpdate, ALL of these must be updated:
1. `lib/api-zod/src/generated/api.ts` — ListGamesResponseItem, CreateGameResponse, GetGameResponse, UpdateGameBody, UpdateGameResponse
2. `lib/api-zod/src/generated/types/game.ts`
3. `lib/api-zod/src/generated/types/gameUpdate.ts`
4. `lib/api-client-react/src/generated/api.schemas.ts` — Game, GameUpdate interfaces
5. `lib/api-client-react/dist/generated/api.schemas.d.ts` — same (compiled dist)
6. `lib/db/src/schema/games.ts` — the schema source
7. Rebuild lib/db dist: `cd lib/db && npx tsc -p tsconfig.json`

## Known gap (Task #87)
The `POST /api/games/:gameId/host-answer` response includes `isCorrect` and `pointsEarned` but the web/mobile UIs discard them — the host doesn't see right/wrong feedback until game end. Fix: store `{ answer, isCorrect }` in hostAnswers state and render ✓/✗ inline.
