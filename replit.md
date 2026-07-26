# Trivia Night

A multiplayer pub-quiz web app: players enter with an access code, join live games, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards; admins manage games, questions (with Gemini AI generation/fact-check and OpenTDB import), and settings.

## Product notes

- Restored from a PDF code export (attached_assets/Trivia_Night2_*.pdf).
- Access codes live in the `admin_settings` table (single row). Random codes are generated at first boot (logged once to the server console) and are changeable in the admin Settings page (minimum 8 characters). Do not document actual code values in the repo.
- Each game also has its own unique `access_code` column (6-char, unambiguous alphabet) auto-generated on creation. Players entering a per-game code are bound to that game only.
- Real-time updates use Socket.IO at path `/api/socket.io` (routed under the existing `/api` proxy path).
- AI question generation (`gemini.ts` routes) requires the `GOOGLE_API_KEY` env var; the rest of the app works without it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (**broken on Node 24 — hand-patch instead, see Gotchas**)
- `pnpm --filter @workspace/db run push` — push DB schema changes (**needs TTY — use raw SQL instead, see Gotchas**)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

| What | Path |
|---|---|
| DB schema (source of truth) | `lib/db/src/schema/` |
| API contract (source of truth) | `lib/api-spec/openapi.yaml` |
| Generated Zod runtime schemas | `lib/api-zod/src/generated/api.ts` |
| Generated TS interfaces | `lib/api-zod/src/generated/types/` |
| Generated React Query hooks + fetch fns | `lib/api-client-react/src/generated/` |
| API server (Express routes, services, middleware) | `artifacts/api-server/src/` |
| Player + admin SPA (React/Vite) | `artifacts/trivia-game/src/` |
| Admin UI (single 4 400-line file) | `artifacts/trivia-game/src/pages/Admin.tsx` |
| Design canvas (dev-only, never deployed) | `artifacts/mockup-sandbox/` |
| Gemini AI service | `artifacts/api-server/src/services/geminiApi.ts` |
| Socket.IO real-time events | `artifacts/api-server/src/lib/socket.ts` |

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- Change only the files named in the request. Do not reformat, reorganise imports, or tidy adjacent code.
- Run `pnpm run typecheck` before reporting done. It must pass.
- Never commit or log an access code, API key, or session secret.
- If a request seems to need a change outside the named files, stop and say so rather than making it.

## Gotchas

- **orval codegen is broken on Node 24.** Regenerating requires hand-patching three generated locations: `lib/api-zod/src/generated/api.ts`, `lib/api-client-react/src/generated/api.ts`, and `lib/api-client-react/src/generated/api.schemas.ts`. Zod `.parse()` strips fields not in the runtime schema even if the TS type declares them — all three files must be kept in sync with `openapi.yaml`.
- **`drizzle push` needs a TTY and fails in the agent environment.** Apply schema changes by writing DDL as SQL and running it against `DATABASE_URL` (use the `executeSql` skill callback), then update `lib/db/src/schema/` by hand to match.
- **`artifacts/trivia-game/src/pages/Admin.tsx` is ~4 400 lines.** Prefer adding new admin UI in a new file over growing it further.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
