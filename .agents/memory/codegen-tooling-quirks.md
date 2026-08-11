---
name: Codegen & migration tooling quirks
description: Workarounds for broken orval codegen and non-TTY drizzle push in this workspace
---

# Codegen & migration tooling quirks

**Rule:** `pnpm run codegen` in `lib/api-spec` is the ONLY correct way to update generated types. Hand-patching generated files causes drift. Always run codegen, never hand-edit `lib/api-zod/src/generated/` or `lib/api-client-react/src/generated/`.

**Fix applied (Node 24 / orval 8.22.0):** orval 8.22.0 bundled `import jsYaml from "js-yaml"` which crashes on Node 24 (CJS default-export interop change). Fixed with `pnpm patch orval@8.22.0` — changed that one line to `import * as jsYaml from "js-yaml"` in `dist/config-CotJKggp.mjs`. Patch lives at `patches/orval@8.22.0.patch`; `package.json` `pnpm.patchedDependencies` records it. After editing patch dir, must run `pnpm install --force` to apply the patch to the live node_modules. **Do not upgrade orval to 8.24.0** — it generates `zod.int()` (zod v4 syntax) incompatible with the workspace's zod v3.

**Why:** Missing any one of the three generated locations causes silent contract drift — zod `.parse()` strips fields not in the runtime schema even if the TS type has them. The pnpm patch is reproducible and committed; running `pnpm install` on a fresh clone will apply it automatically.

**Also:** `drizzle-kit push` (and `push-force`) fails in non-interactive shells ("Interactive prompts require a TTY"). Apply DDL directly via executeSql and keep the Drizzle schema file in sync; publish flow handles prod migration.
