# Trivia Night

A multiplayer pub-quiz web app: players enter with an access code, join live games, answer timed questions (multiple choice, true/false, matching, image, write-in), and see live leaderboards; admins manage games, questions (with Gemini AI generation/fact-check and OpenTDB import), and settings.

## Product notes

- Restored from a PDF code export (attached_assets/Trivia_Night2_*.pdf).
- Access codes live in the `admin_settings` table (single row). Seeded defaults: player `PLAY2026`, admin `ADMIN2026` — changeable in the admin Settings page.
- Real-time updates use Socket.IO at path `/api/socket.io` (routed under the existing `/api` proxy path).
- AI question generation (`gemini.ts` routes) requires the `GOOGLE_API_KEY` env var; the rest of the app works without it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
