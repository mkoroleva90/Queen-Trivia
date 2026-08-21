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

// All fixed-window limiters share rate_limit_hits. The reports limiter has the
// longest active window (one hour), so pruning must retain its rows even when a
// shorter-window auth limiter happens to receive the next request.
const FIXED_WINDOW_CLEANUP_RETENTION_MS = 2 * 60 * 60 * 1000;

export interface RollingRateLimitInfo {
  totalHits: number;
  resetTime: Date;
}

/**
 * PostgreSQL-backed rolling-window counter for credentials that are valid for
 * a short, sliding lifetime (such as a password-reset OTP).
 *
 * The first failed attempt starts a window for the supplied key. A
 * transaction-scoped advisory lock makes the read/update sequence atomic even
 * when multiple API replicas receive requests for the same credential.
 */
export class PgRollingRateLimitStore {
  constructor(private readonly windowMs: number) {}

  async increment(key: string): Promise<RollingRateLimitInfo> {
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      // Serialize all counter updates for this key. The rate_limit_hits primary
      // key also contains window_start, so a normal UPSERT alone cannot prevent
      // two replicas from creating separate rolling windows simultaneously.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);

      const now = new Date();
      const cutoff = new Date(now.getTime() - this.windowMs);
      const existing = await client.query<{ window_start: Date; hits: number }>(
        `SELECT window_start, hits
         FROM rate_limit_hits
         WHERE key = $1
         ORDER BY window_start DESC
         LIMIT 1
         FOR UPDATE`,
        [key],
      );

      let totalHits: number;
      let resetTime: Date;

      if (
        existing.rows[0] &&
        existing.rows[0].window_start > cutoff
      ) {
        const windowStart = existing.rows[0].window_start;
        const updated = await client.query<{ hits: number }>(
          `UPDATE rate_limit_hits
           SET hits = hits + 1
           WHERE key = $1 AND window_start = $2
           RETURNING hits`,
          [key, windowStart.toISOString()],
        );
        totalHits = updated.rows[0]!.hits;
        resetTime = new Date(windowStart.getTime() + this.windowMs);
      } else {
        // This key only represents one credential at a time. Remove any stale
        // row before beginning a fresh rolling window.
        await client.query("DELETE FROM rate_limit_hits WHERE key = $1", [key]);
        const inserted = await client.query<{ hits: number }>(
          `INSERT INTO rate_limit_hits (key, window_start, hits)
           VALUES ($1, $2, 1)
           RETURNING hits`,
          [key, now.toISOString()],
        );
        totalHits = inserted.rows[0]!.hits;
        resetTime = new Date(now.getTime() + this.windowMs);
      }

      await client.query("COMMIT");
      transactionOpen = false;
      // Best-effort cleanup of old OTP counters keeps the shared table bounded.
      pool
        .query(
          `DELETE FROM rate_limit_hits WHERE window_start < NOW() - ($1 * interval '1 millisecond')`,
          [this.windowMs * 2],
        )
        .catch(() => {
          /* non-fatal */
        });
      return { totalHits, resetTime };
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK").catch(() => {
          /* Preserve the original database error. */
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

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

      // Best-effort cleanup of expired rows; errors here are non-fatal. Use a
      // shared retention period rather than this limiter's window so requests
      // to a short-window limiter cannot prune still-valid report counters.
      await pool
        .query(
          `DELETE FROM rate_limit_hits WHERE window_start < NOW() - ($1 * interval '1 millisecond')`,
          [FIXED_WINDOW_CLEANUP_RETENTION_MS],
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
