-- Migration: add SSO foundation for Google and Apple host sign-in
-- Purpose: (1) new admin_auth_providers table links a host account to one or more
--          OAuth provider identities; (2) password_hash is made nullable so accounts
--          created exclusively via SSO never need a password; (3) display_name is
--          added to admin_accounts because Apple only returns the user's name on the
--          very first sign-in and never again.
-- Applied to the workspace database via executeSql (drizzle push requires an interactive TTY).
-- Production picks this up through the normal publish sync.
-- Mostly idempotent: the ADD COLUMN and CREATE TABLE/INDEX statements use IF NOT EXISTS,
-- but ALTER COLUMN ... DROP NOT NULL is not conditional and will error if re-run after
-- the column is already nullable. Safe to re-run only once per environment.

-- 1. Allow password_hash to be NULL on existing accounts (SSO-only hosts have none).
ALTER TABLE admin_accounts
  ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Store the display name supplied by the OAuth provider (critical for Apple).
ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3. Provider identity table.
CREATE TABLE IF NOT EXISTS admin_auth_providers (
  id                SERIAL PRIMARY KEY,
  admin_account_id  INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  provider          TEXT    NOT NULL,
  provider_subject  TEXT    NOT NULL,
  provider_email    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_providers_account_id
  ON admin_auth_providers (admin_account_id);
