---
name: Tenant aggregate isolation
description: Rule for host dashboard statistics and other cross-table aggregates.
---

Host-facing aggregates must start from the host's owned games and join outward
to participants, answers, or other game data; never count global player or
answer tables directly.

**Why:** Global counts disclose another host's activity even when individual
game reads are correctly tenant-scoped.

**How to apply:** Use the same owner filter for every aggregate in a dashboard
response. Legacy sessions have no tenant identity, so deny aggregate access
rather than returning platform or ownerless metrics.