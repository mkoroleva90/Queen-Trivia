import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/**
 * Shared PostgreSQL store for express-rate-limit.
 * Backs the per-IP rate limiter on the content-reports endpoint so that
 * counters are consistent across all deployed replicas.
 *
 * Schema must stay in sync with the raw SQL in pgRateLimitStore.ts:
 *   INSERT INTO rate_limit_hits (key, window_start, hits) …
 *   UPDATE rate_limit_hits SET hits = … WHERE key = … AND window_start = …
 *   DELETE FROM rate_limit_hits WHERE window_start < …
 */
export const rateLimitHitsTable = pgTable(
  "rate_limit_hits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index("idx_rate_limit_hits_window_start").on(table.windowStart),
  ],
);

export type RateLimitHit = typeof rateLimitHitsTable.$inferSelect;
