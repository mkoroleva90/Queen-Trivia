---
name: OpenTDB supplement compatibility
description: Compatibility boundaries for optional AI-enriched OpenTDB imports.
---

Optional OpenTDB import modes are parsed and validated in the API route rather than added to the shared OpenAPI schema or generated clients. An omitted mode remains `standard`, which keeps the pre-existing OpenTDB-only request and insert path.

**Why:** The server enhancement must be available for future clients without changing the current web/mobile clients, shared schema, or generated API output. The standard path must make zero AI calls and retain its existing behavior.

**How to apply:** Keep `standard` isolated before AI quota checks and supplement generation. Add future client/schema support only as a separately approved compatibility change; do not make supplemental mode requirements retroactively alter standard imports.