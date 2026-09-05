---
name: GitHub push authentication
description: How to publish commits when the workspace remote has no shell credentials.
---

Do not assume that a configured GitHub remote can authenticate from the shell. When HTTPS push is rejected, use the connected GitHub integration and the Git Data API to create blobs, a tree, and a commit, then update `refs/heads/main` without force after verifying the remote head equals the intended parent.

**Why:** The repository remote was present, but shell Git had no usable GitHub token. The connector could authenticate and publish the same committed file contents safely.

**How to apply:** Compare remote `main` to the local commit parent before writing. Abort on divergence; otherwise create the commit through the connector and fast-forward the branch.