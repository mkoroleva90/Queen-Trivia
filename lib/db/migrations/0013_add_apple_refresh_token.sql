-- Migration: store the Sign in with Apple refresh token on the provider link.
-- Purpose: App Store guideline 5.1.1(v) requires revoking the Apple grant when
--          a user deletes their account. The token is obtained by exchanging the
--          authorization code at sign-in. Nullable so Google links and legacy
--          Apple links are unaffected.

ALTER TABLE admin_auth_providers
  ADD COLUMN IF NOT EXISTS apple_refresh_token TEXT;
