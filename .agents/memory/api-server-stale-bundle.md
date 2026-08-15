---
name: API server stale bundle
description: api-server is esbuild-bundled; new routes 404 until the workflow rebuilds
---

The api-server has no hot reload: `pnpm run dev` = esbuild build → start, so the running process serves whatever was in `src/` at the last workflow restart. New routes added afterwards return Express 404 ("Cannot POST …") even though the source and router mount are correct.

**Why:** an SSO route 404'd in both dev and prod despite correct source; `dist/index.mjs` predated the route files (compare `stat` mtimes, `grep -c` the route path in `dist/index.mjs`).

**How to apply:** after any api-server source change, restart the `artifacts/api-server: API Server` workflow before testing; when a route 404s unexpectedly, check dist mtime vs source mtime first. Production needs a republish to pick up new server code.
