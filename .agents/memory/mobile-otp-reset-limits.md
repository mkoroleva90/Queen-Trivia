---
name: Mobile OTP reset limits
description: Security rules for limiting mobile password-reset OTP guesses.
---

## Rule

Limit failed mobile password-reset OTP attempts with a PostgreSQL-backed rolling
window keyed to a stable account identifier protected by a domain-separated
HMAC. The limit must persist across IP changes, process restarts, replicas, and
reset-code reissues.

**Why:** A fixed epoch window can roll over while a short-lived OTP remains
valid. A key derived from the current reset token gives an attacker a new guess
budget every time they request a replacement code. A raw account/email digest
also allows offline correlation if the rate-limit table is exposed.

**How to apply:** Keep the attempt budget account-scoped for longer than the
OTP lifetime, derive the database key with a server-held secret, and test IP
rotation plus code reissue whenever modifying the reset flow.