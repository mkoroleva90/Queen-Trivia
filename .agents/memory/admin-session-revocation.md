---
name: Session revocation
description: How HTTP and mobile-token revocation applies to persisted sessions, active Socket.IO connections, and handshake races.
---

Email-authenticated host session revocation must remove both persisted PostgreSQL session rows and active Socket.IO connections. A session that has `adminEmail` but no account ID is an older email-auth session, not a code-based legacy session; only sessions with neither identity field use the legacy path.

**Why:** Socket.IO snapshots the Express session at handshake, so deleting its persisted row does not stop an already connected host from receiving private game events. Older email sessions otherwise become indistinguishable from intended code-based legacy sessions after the account is deleted.

**How to apply:** Any account deletion, password reset, mobile reset, or password change that revokes host sessions must revoke both identities (account ID and email) and disconnect matching sockets. When retaining the current browser after a password change, exclude its session ID from both actions.

Mobile bearer logout must advance persisted, identity-scoped revocation state and clients must retain the credential if the server cannot confirm logout. Socket room joins must reload cookie sessions or re-check bearer revocation state rather than trusting only the handshake snapshot.

**Why:** A one-time cross-replica socket enumeration can race with an in-progress handshake, leaving a newly registered socket authorized after the logout snapshot.

**How to apply:** On explicit logout, attempt bearer revocation, socket disconnection, and session destruction even if one step fails; report failure unless every applicable authorization path was revoked. Only a currently active bearer may advance the revocation watermark; stale-token logout replays must not invalidate newer logins or disconnect their identity-scoped sockets.