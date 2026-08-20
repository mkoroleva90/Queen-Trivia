---
name: Node strip-types test runner quirks
description: Constraints for api-server unit tests run with node --experimental-strip-types
---
The api-server test script runs with `node --experimental-strip-types --test`. Constraints:

- Relative imports in any transitively loaded file must use explicit `.ts` extensions; tsconfig has `allowImportingTsExtensions` + `noEmit` for this (build is esbuild, so noEmit is fine).
- Node's type stripper rejects non-null assertions inside destructuring assignment targets (`[a[i]!, a[j]!] = ...` → "Not a pattern"). Use a temp-variable swap instead.
- Do not use `--input-type=module` when importing the built Express app for an inline integration check: worker processes inherit the flag and Node rejects it for file-based workers. Run a temporary `.mjs` module instead.

**Why:** tests and integration checks otherwise fail with confusing module-not-found, syntax, or worker-loader errors; these were the root cause of a long-broken grading test and a live route-check failure.
**How to apply:** whenever adding imports or writing tests under artifacts/api-server/src, keep `.ts` extensions and avoid `!` in destructuring LHS. For live app imports, prefer a temporary module file over Node inline-module mode.
