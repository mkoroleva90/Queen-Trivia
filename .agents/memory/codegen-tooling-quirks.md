---
name: Codegen & migration tooling quirks
description: Workarounds for broken orval codegen and non-TTY drizzle push in this workspace
---

# Codegen & migration tooling quirks

**Rule:** `pnpm run codegen` in `lib/api-spec` (orval) crashes on Node 24 (`js-yaml` ESM default-export error). When the OpenAPI spec changes, hand-patch ALL generated artifacts consistently: `lib/api-zod/src/generated/api.ts` (zod runtime schemas), `lib/api-zod/src/generated/types/*.ts` (TS interfaces), and `lib/api-client-react/src/generated/api.schemas.ts` — then run `pnpm -w run typecheck:libs` (tsc --build) so consumers see the new types.

**Why:** Missing any one of the three locations causes silent contract drift — zod `.parse()` strips fields not in the runtime schema even if the TS type has them.

**Also:** `drizzle-kit push` (and `push-force`) fails in non-interactive shells ("Interactive prompts require a TTY"). Apply DDL directly via executeSql and keep the Drizzle schema file in sync; publish flow handles prod migration.
