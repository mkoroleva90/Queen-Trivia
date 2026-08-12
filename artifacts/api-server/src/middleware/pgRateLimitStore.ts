/**
 * PostgreSQL-backed store for express-rate-limit.
 *
 * Uses a shared `rate_limit_hits` table so the per-IP counter is consistent
 * across all deployed replicas (including autoscaled instances). Each window
 * is aligned to the epoch modulo windowMs (fixed-window algorithm).
 *
 * Fail-open design: if the database is unavailable the store allows the request
 * through rather than hard-blocking it. This is intentional — for content
 * reports (a low-traffic endpoint), a brief DB outage should not prevent
 * legitimate players from submitting a report.
 *
 * Old rows are pruned automatically on every increment call to avoid unbounded
 * table growth. The prune deletes rows whose window has already expired.
 */

import type { Store, ClientRateLimitInfo, Options } from "express-rate-limit";
import { pool } from "@workspace/db";

export class PgRateLimitStore implements Store {
  private windowMs: number = 60_000;

  /** Called by express-rate-limit when the middleware is initialised. */
  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  /** Returns the start of the current fixed window (epoch-aligned). */
  private currentWindowStart(): Date {
    const now = Date.now();
    return new Date(now - (now % this.windowMs));
  }

  /**
   * Atomically increments the hit counter for `key` in the current window
   * and returns the new total and the window reset time.
   */
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const winStart = this.currentWindowStart();
    const resetTime = new Date(winStart.getTime() + this.windowMs);
    try {
      const result = await pool.query<{ hits: number }>(
        `INSERT INTO rate_limit_hits (key, window_start, hits)
         VALUES ($1, $2, 1)
         ON CONFLICT (key, window_start) DO UPDATE
           SET hits = rate_limit_hits.hits + 1
         RETURNING hits`,
        [key, winStart.toISOString()],
      );

      // Best-effort cleanup of expired rows; errors here are non-fatal.
      pool
        .query(
          `DELETE FROM rate_limit_hits WHERE window_start < NOW() - ($1 * interval '1 millisecond')`,
          [this.windowMs * 2],
        )
        .catch(() => {
          /* non-fatal */
        });

      return { totalHits: result.rows[0]!.hits, resetTime };
    } catch {
      // Fail open: allow the request if the store is unavailable.
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(key: string): Promise<void> {
    const winStart = this.currentWindowStart();
    try {
      await pool.query(
        `UPDATE rate_limit_hits
         SET hits = GREATEST(hits - 1, 0)
         WHERE key = $1 AND window_start = $2`,
        [key, winStart.toISOString()],
      );
    } catch {
      /* fail open */
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [key]);
    } catch {
      /* fail open */
    }
  }

  async resetAll(): Promise<void> {
    try {
      await pool.query(`DELETE FROM rate_limit_hits`);
    } catch {
      /* fail open */
    }
  }
}
