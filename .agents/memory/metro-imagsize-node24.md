---
name: Metro image-size crash on Node.js 24
description: Metro needs a worker-thread fallback on Node.js 24+, and its archived image-size dependency is replaced by a maintained compatible fork.
---

## The rule
`image-size@1.x` crashes inside Metro worker threads on Node.js 22+ with:
`The "list" argument must be an instance of SharedArrayBuffer, ArrayBuffer or ArrayBufferView.`

The crash is in `imageSize()` called from `metro@0.83.3/src/Assets.js:getAssetData()`. It hits random PNG assets (non-deterministic: `unmatched.png`, `forward.png`, `pkg.png`…) because of concurrency in the worker thread pool.

**Why:** `image-size@1.2.1/dist/types/utils.js` uses a module-level `TextDecoder` instance. In Metro worker threads on Node.js 24, calling `decoder.decode()` on a `Uint8Array` slice can fail with this error due to changed internal validation for `SharedArrayBuffer`-backed buffers in worker contexts.

**How to apply:** The fix is already in place as a committed pnpm patch:
- `patches/metro@0.83.3.patch` — wraps the `imageSize(isImageInput)` call in a try-catch that silently falls back to `null` dimensions
- Listed in `package.json` under `pnpm.patchedDependencies`
- Applied automatically by `pnpm install` in every environment (dev + deployment)

The fallback to `null` dimensions is safe: Metro's `getAssetData` already handles `dimensions = null` by setting `width: undefined, height: undefined` in the asset metadata, which React Native handles gracefully.

## Security replacement
All workspace requests for `image-size` must resolve to `image-size-next@2.1.0` through the root pnpm override.

**Why:** The original package was archived at version 2.0.2 with two high-severity infinite-loop advisories and no published patched release. `image-size-next` is a maintained API-compatible fork, so aliasing it avoids the vulnerable package without requiring Metro changes.

**How to apply:** Keep the pnpm alias when updating Expo, React Native, or Metro, and run `pnpm audit` plus a Metro asset-size smoke test after changing it. Retain the Metro patch unless an updated Metro no longer needs the worker-thread fallback.

## Symptoms
- Deployment build fails at ~90%+ of iOS/Android Metro bundle with `SyntaxError: <path>.png: The "list" argument…`
- Local `npx expo export --platform web` also fails with the same error
- Different PNG files fail on each run (race condition)

## Related
- Only affects `metro@0.83.3` (the version loaded by `@expo+metro@54.2.0` / `@expo/metro-config@54.0.17`)
- `metro@0.83.7` is installed but NOT loaded by Expo's config
- The security replacement applies to every Metro resolution, including both `0.83.3` and `0.83.7`.
- If `metro` or `@expo/metro-config` is upgraded, check if the issue persists
