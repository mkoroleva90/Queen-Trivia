---
name: Decoder module compatibility
description: Compatibility constraint between the security-fixed URI decoder and React Navigation's query-string dependency.
---

Security-fixed `decode-uri-component` releases use ESM-only exports, but the `query-string` release used by React Navigation still loads the decoder with CommonJS `require()`. A version override alone passes an audit but breaks query parsing at runtime.

**Why:** React Navigation's latest compatible dependency chain still uses `query-string@7`, so there is no upstream parent upgrade that consumes the fixed decoder correctly yet.

**How to apply:** Keep the fixed decoder version plus its CommonJS compatibility patch together. Test actual `query-string.parse()` behavior after dependency updates, and remove the patch only once React Navigation adopts an ESM-compatible query-string release.