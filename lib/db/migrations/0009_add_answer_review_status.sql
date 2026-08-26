-- Track short-response answers that need host review after automatic grading
-- is unavailable, and record the final review timestamp.
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS grading_status TEXT NOT NULL DEFAULT 'graded',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;