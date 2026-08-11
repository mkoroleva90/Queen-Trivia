-- Migration: add content_reports table
-- Applied manually via executeSql (drizzle push requires an interactive TTY).
-- Idempotent: all statements use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS content_reports (
  id               SERIAL PRIMARY KEY,
  game_id          INTEGER REFERENCES games(id) ON DELETE SET NULL,
  question_id      INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason           TEXT NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_game_id
  ON content_reports(game_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_created_at
  ON content_reports(created_at DESC);
