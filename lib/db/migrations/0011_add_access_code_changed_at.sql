-- Migration: track when a host last changed a game's room code.
-- Purpose: a player removal revokes new admissions until the host rotates the
--          shared room code. Nullable preserves historical games safely.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS access_code_changed_at TIMESTAMPTZ;