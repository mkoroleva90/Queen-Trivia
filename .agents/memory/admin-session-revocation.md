---
name: Admin session revocation
description: How host-session revocation applies to persisted HTTP sessions, active Socket.IO connections, and older email-auth session payloads.
---

Email-authenticated host session revocation must remove both persisted PostgreSQL session rows and active Socket.IO connections. A session that has `adminEmail` but no account ID is an older email-auth session, not a code-based legacy session; only sessions with neither identity field use the legacy path.

**Why:** Socket.IO snapshots the Express session at handshake, so deleting its persisted row does not stop an already connected host from receiving private game events. Older email sessions otherwise become indistinguishable from intended code-based legacy sessions after the account is deleted.

**How to apply:** Any account deletion, password reset, mobile reset, or password change that revokes host sessions must revoke both identities (account ID and email) and disconnect matching sockets. When retaining the current browser after a password change, exclude its session ID from both actions.