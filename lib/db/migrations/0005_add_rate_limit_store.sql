-- Migration: add rate_limit_hits table for shared PostgreSQL rate-limit store
-- Purpose: back express-rate-limit with a shared PostgreSQL store so that
--          per-IP counters are consistent across all deployed replicas.
--          Used by the reports endpoint rate limiter (15 req/hr per IP).
-- Applied manually via executeSql (drizzle push requires an interactive TTY).
-- Idempotent: all statements use IF NOT EXISTS patterns.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Index on window_start to make the periodic cleanup DELETE efficient.
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_window_start
  ON rate_limit_hits (window_start);
