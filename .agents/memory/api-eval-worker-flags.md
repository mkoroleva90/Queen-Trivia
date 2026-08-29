---
name: API eval worker flags
description: Node invocation constraint for one-off scripts that import the built API bundle.
---

Do not launch an inline script that imports the built API bundle with
`node --input-type=module`; use a normal module file or the existing test runner.

**Why:** The API starts Pino worker threads, which inherit `--input-type=module`.
Node rejects that flag when a worker loads from a file, so the process crashes
before the script can exercise the application.

**How to apply:** Prefer committed integration tests for API concurrency checks.
If a disposable harness is unavoidable, run it as a regular `.mjs` file without
the `--input-type` flag.