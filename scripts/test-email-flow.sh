#!/usr/bin/env bash
# End-to-end email flow smoke test
#
# Usage:
#   ADMIN_KEY=<ADMIN_ACCESS_KEY secret> \
#   DATABASE_URL=<postgres connection string> \
#   BASE_URL=https://<domain> \
#   bash scripts/test-email-flow.sh
#
# BASE_URL defaults to the first REPLIT_DOMAINS entry when not set.
#
# What this covers:
#   1. Config-check          — RESEND_API_KEY, EMAIL_FROM, REPLIT_DOMAINS are set and URLs are correct
#   2. Admin session         — sign in via access code so register (admin-gated) can proceed
#   3. Register              — creates a test account (triggers a real verification email)
#   4. Verify (DB token)     — patches the DB with a known token, calls /verify → auto-login
#   5. Session confirm       — GET /admin/me returns isAdmin:true
#   6. Forgot-password       — triggers a real reset email for the test account
#   7. Reset-password (DB)   — patches the DB with a known reset token, calls /reset-password
#   8. Login new password    — confirms the reset flow produced a valid credential
#   9. Cleanup               — DELETE /api/auth/email/admin-account removes the test account
#
# Steps 4 and 7 patch tokens directly in the DB so the test completes without
# a real inbox, while still exercising the exact same server-side code paths
# that a real email click would use.

set -euo pipefail

ADMIN_KEY="${ADMIN_KEY:?Set ADMIN_KEY to your ADMIN_ACCESS_KEY secret}"
BASE_URL="${BASE_URL:-https://$(printenv REPLIT_DOMAINS 2>/dev/null | cut -d, -f1)}"
# Resend rejects reserved domains like example.com; use their official test sink
# address (delivered@resend.dev) which always succeeds without actual delivery.
# Override TEST_EMAIL to use a real inbox when you want to verify inbox receipt.
TEST_EMAIL="${TEST_EMAIL:-delivered@resend.dev}"
TEST_PASS="TestPass@$(date +%s)"
API="${BASE_URL}/api"

ADMIN_JAR=$(mktemp)   # admin session from access-code login
VERIFY_JAR=$(mktemp)  # session established after email verification
RESET_JAR=$(mktemp)   # session after password-reset login

cleanup() { rm -f "$ADMIN_JAR" "$VERIFY_JAR" "$RESET_JAR"; }
trap cleanup EXIT

log()  { echo "▶ $*"; }
ok()   { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

# ── 1. Config check ──────────────────────────────────────────────────────────
log "1/9  Config check"
cfg=$(curl -sf -X GET "${API}/auth/email/config-check" \
  -H "x-admin-key: ${ADMIN_KEY}") \
  || fail "Config-check request failed — is the server running?"
echo "$cfg" | grep -q '"ok":true' || fail "Config issues: $cfg"
echo "$cfg" | python3 -m json.tool 2>/dev/null || echo "$cfg"
ok "Config check passed"

# ── 2. Establish admin session (access-code login) ───────────────────────────
log "2/9  Signing in via admin access code"
login_resp=$(curl -sf -c "$ADMIN_JAR" -X POST "${API}/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"${ADMIN_KEY}\"}") \
  || fail "Admin login request failed"
echo "$login_resp" | grep -q '"ok":true' || fail "Admin login rejected: $login_resp"
ok "Admin session established"

# ── 3. Register test account ─────────────────────────────────────────────────
log "3/9  Registering test account: ${TEST_EMAIL}"
reg=$(curl -sf -b "$ADMIN_JAR" -X POST "${API}/auth/email/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}") \
  || fail "Register request failed"
echo "$reg" | grep -q '"ok":true' || fail "Register failed: $reg"
ok "Registration accepted — real verification email sent to ${TEST_EMAIL}"

# ── 4. Verify via DB token ────────────────────────────────────────────────────
log "4/9  Patching verification token in DB and calling /verify"
KNOWN_TOKEN="smoketest$(date +%s)abc123"
KNOWN_HASH=$(echo -n "${KNOWN_TOKEN}" | openssl dgst -sha256 | awk '{print $2}')
EXPIRY=$(date -u -d '+1 hour' '+%Y-%m-%d %H:%M:%S+00' 2>/dev/null \
         || date -u -v+1H '+%Y-%m-%d %H:%M:%S+00')

psql "${DATABASE_URL:?Set DATABASE_URL to patch the test token}" -q -c \
  "UPDATE admin_accounts
      SET verification_token_hash='${KNOWN_HASH}',
          verification_token_expiry='${EXPIRY}'
    WHERE email='${TEST_EMAIL}';" \
  || fail "Could not patch verification token in DB"

verify=$(curl -sf -c "$VERIFY_JAR" -X POST "${API}/auth/email/verify" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${KNOWN_TOKEN}\"}") \
  || fail "Verify request failed"
echo "$verify" | grep -q '"ok":true' || fail "Verify failed: $verify"
ok "Verification endpoint accepted token and established session"

# ── 5. Confirm admin session ──────────────────────────────────────────────────
log "5/9  Confirming admin session is live after verification"
me=$(curl -sf -b "$VERIFY_JAR" "${API}/admin/me")
echo "$me" | grep -q '"isAdmin":true' || fail "Admin session not live after verify: $me"
ok "Admin session confirmed (isAdmin: true)"

# ── 6. Forgot-password ────────────────────────────────────────────────────────
log "6/9  Triggering forgot-password (real reset email sent)"
fp=$(curl -sf -X POST "${API}/auth/email/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\"}") \
  || fail "Forgot-password request failed"
echo "$fp" | grep -q '"ok":true' || fail "Forgot-password failed: $fp"
ok "Forgot-password accepted — real reset email sent"

# ── 7. Reset-password via DB token ───────────────────────────────────────────
log "7/9  Patching reset token in DB and calling /reset-password"
RESET_TOKEN="smokereset$(date +%s)xyz789"
RESET_HASH=$(echo -n "${RESET_TOKEN}" | openssl dgst -sha256 | awk '{print $2}')
RESET_EXPIRY=$(date -u -d '+1 hour' '+%Y-%m-%d %H:%M:%S+00' 2>/dev/null \
              || date -u -v+1H '+%Y-%m-%d %H:%M:%S+00')
NEW_PASS="NewPass@$(date +%s)"

psql "${DATABASE_URL}" -q -c \
  "UPDATE admin_accounts
      SET reset_token_hash='${RESET_HASH}',
          reset_token_expiry='${RESET_EXPIRY}'
    WHERE email='${TEST_EMAIL}';" \
  || fail "Could not patch reset token in DB"

reset=$(curl -sf -X POST "${API}/auth/email/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${RESET_TOKEN}\",\"password\":\"${NEW_PASS}\"}") \
  || fail "Reset-password request failed"
echo "$reset" | grep -q '"ok":true' || fail "Reset-password failed: $reset"
ok "Password reset accepted"

# ── 8. Login with new password ────────────────────────────────────────────────
log "8/9  Logging in with reset password"
login2=$(curl -sf -c "$RESET_JAR" -X POST "${API}/auth/email/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${NEW_PASS}\"}") \
  || fail "Login request failed"
echo "$login2" | grep -q '"ok":true' || fail "Login with new password failed: $login2"
ok "Login with reset password works"

# ── 9. Cleanup ────────────────────────────────────────────────────────────────
log "9/9  Deleting test account"
del=$(curl -sf -b "$RESET_JAR" -X DELETE "${API}/auth/email/admin-account") \
  || fail "Delete-account request failed"
echo "$del" | grep -q '"ok":true' || fail "Delete account failed: $del"
ok "Test account deleted and session cleared"

echo ""
echo "════════════════════════════════════════════"
echo "  ALL CHECKS PASSED — email flow is healthy"
echo "════════════════════════════════════════════"
