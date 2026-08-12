-- Migration: add removed_participants table
-- Purpose: records players the host has removed from a game; prevents rejoining.
-- Applied manually via executeSql (drizzle push requires an interactive TTY).
-- Idempotent: all statements use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS removed_participants (
  id          SERIAL PRIMARY KEY,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  removed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_removed_participants_game_id
  ON removed_participants(game_id);
