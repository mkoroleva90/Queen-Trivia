-- Migration: add password_changed_at to admin_accounts
-- Purpose: enables mobile bearer token revocation after in-app password change.
-- The column is nullable; NULL means the password has never been changed in-app
-- and all tokens for that account remain valid based on their iat + TTL alone.
ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
