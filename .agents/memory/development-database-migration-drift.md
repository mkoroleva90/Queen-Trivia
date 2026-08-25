---
name: Development database migration drift
description: Development player login depends on the game access-grants migration being applied.
---

The development database must include the `game_access_grants` table before testing player login, joining by room code, or player results.

**Why:** The API records a room-code access grant during player login. When that migration is absent, the insert fails and the endpoint returns a 500 error even though the mobile UI and credentials are valid.

**How to apply:** If player authentication unexpectedly fails with a missing `game_access_grants` relation, apply the existing access-grants migration to the development database before debugging the client flow further.