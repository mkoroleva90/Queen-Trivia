-- Migration: add display_name to removed_participants
-- Purpose: store the kicked player's display name at removal time so the join
--          route can block rejoin by name even when the player returns with a
--          fresh identity (cleared storage, incognito, new device).
-- Applied manually via executeSql (drizzle push requires an interactive TTY).
-- Idempotent: all statements use IF NOT EXISTS / DO NOTHING patterns.

ALTER TABLE removed_participants
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Functional index for efficient case-insensitive name lookups per game.
CREATE INDEX IF NOT EXISTS idx_removed_participants_game_name
  ON removed_participants (game_id, lower(display_name));
