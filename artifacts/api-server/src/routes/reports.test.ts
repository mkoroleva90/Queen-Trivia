/**
 * Integration tests for POST /api/reports rate limiting.
 *
 * Verifies that the shared PostgreSQL-backed rate limiter enforces the
 * 15-requests-per-hour-per-IP cap on the public content-report endpoint,
 * preventing email-quota exhaustion and DB row flooding.
 *
 * NODE_ENV is set to "production" before the app is imported so that the
 * rate-limit middleware does NOT skip loopback addresses (the default
 * development bypass). This allows supertest requests from 127.0.0.1 to
 * accumulate against the real limiter.
 *
 * Requires:
 *   - dist/app.mjs  (run `pnpm run build` first)
 *   - DATABASE_URL  (rate_limit_hits table must exist — run migration 0005)
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/reports.test.ts
 */

// Must be set before the app bundle loads so `isDev` evaluates to false.
process.env["NODE_ENV"] = "production";
process.env["SESSION_SECRET"] = "test-secret-for-unit-tests-32chars!!";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import pg from "pg";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set to run reports.test.ts");
}

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

// Minimal body that passes Zod validation (gameId may not exist in the DB,
// but the rate-limit middleware runs before the route handler so the counter
// always increments regardless of DB-layer outcome).
const validBody = { gameId: 999_999_999, reason: "spam" };

// ── Rate-limit enforcement ───────────────────────────────────────────────────

describe("POST /api/reports — rate limiting", () => {
  before(async () => {
    // Remove any stale rate-limit rows for loopback addresses so each test
    // run starts from a clean counter.
    await pool.query(
      `DELETE FROM rate_limit_hits
       WHERE key IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')`,
    );
  });

  after(async () => {
    // Clean up rows written during the test.
    await pool.query(
      `DELETE FROM rate_limit_hits
       WHERE key IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')`,
    );
    await pool.end();
  });

  it("allows the first 15 requests (no 429)", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post("/api/reports")
        .send(validBody);

      assert.notEqual(
        res.status,
        429,
        `request ${i + 1}/15 should not be rate-limited (got ${res.status})`,
      );
    }
  });

  it("blocks the 16th request with 429", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send(validBody);

    assert.equal(
      res.status,
      429,
      `16th request should be rate-limited (got ${res.status})`,
    );
  });

  it("returns a JSON error body for the 429 response", async () => {
    // Send a 17th request — still over the limit.
    const res = await request(app)
      .post("/api/reports")
      .send(validBody);

    assert.equal(res.status, 429);
    assert.ok(
      res.headers["content-type"]?.includes("application/json"),
      `429 response must be JSON, got: ${res.headers["content-type"]}`,
    );
    assert.equal(typeof res.body.error, "string");
    assert.ok(res.body.error.length > 0, "error message must be non-empty");
  });
});
