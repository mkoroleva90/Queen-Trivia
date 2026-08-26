-- Persist the host-released question for active games. Applied manually via
-- executeSql because drizzle push requires an interactive TTY.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS current_question_id INTEGER;