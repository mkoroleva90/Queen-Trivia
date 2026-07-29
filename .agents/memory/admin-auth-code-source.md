---
name: Admin code source of truth
description: Which credential the host/admin login actually validates against, and how to test it
---

The host console has two code paths that look similar but validate differently:

- `POST /api/auth/verify` (home/join flow) checks the **DB** `admin_settings` table codes.
- `POST /api/admin/login` (admin-login page) checks the **`ADMIN_ACCESS_KEY` env var first** and only falls back to the DB `admin_access_code` when the env var is unset.

**Why:** During e2e testing, the DB admin code was rejected at /admin-login because the env override was set — the two stores can silently disagree.

**How to apply:** When testing or debugging host login, use the `ADMIN_ACCESS_KEY` env value (tell the testing agent to read it from the environment; don't print it). Also note the shared socket singleton (`getSocket`) is disconnected by any consumer's hook cleanup (`useGameSocket`/`useLobbySocket`) — avoid mounting two socket consumers at once until reference counting is added.
