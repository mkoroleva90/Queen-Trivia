-- Migration: persist room-code authorization separately from client sessions.
-- Purpose: game joins must trust a server-side room-code grant, not an
--          allowedGameIds claim that could have been created by the retired
--          cross-game bridge endpoint.
-- Applied manually via executeSql (drizzle push requires an interactive TTY).
-- Idempotent: all statements use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS game_access_grants (
  id          SERIAL PRIMARY KEY,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_access_grants_user_id
  ON game_access_grants(user_id);