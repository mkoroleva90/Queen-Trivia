ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mobile_tokens_revoked_at TIMESTAMPTZ;

ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS mobile_tokens_revoked_at TIMESTAMPTZ;