/**
 * Integration tests for rate limiting anonymous authentication endpoints.
 *
 * Both routes use the PostgreSQL-backed auth limiter so counters remain
 * effective across API replicas and development-preview proxying.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/authRateLimit.test.ts
 * (Requires dist/app.mjs and DATABASE_URL.)
 */

process.env["NODE_ENV"] = "production";
process.env["SESSION_SECRET"] = "test-secret-for-unit-tests-32chars!!";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ipKeyGenerator } from "express-rate-limit";
import pg from "pg";
import request from "supertest";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set to run authRateLimit.test.ts");
}

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const VERIFY_IP = "198.51.100.250";
const LOGIN_IP = "198.51.100.251";
const CLEANUP_AUTH_IP = "198.51.100.252";
const REPORT_COUNTER_IP = "198.51.100.253";

async function clearRateLimitHits(...ips: string[]): Promise<void> {
  const keys = ips.map((ip) => `auth:${ipKeyGenerator(ip)}`);
  await pool.query(`DELETE FROM rate_limit_hits WHERE key = ANY($1::text[])`, [keys]);
}

describe("anonymous authentication rate limiting", () => {
  before(async () => {
    await clearRateLimitHits(VERIFY_IP, LOGIN_IP, CLEANUP_AUTH_IP);
    await pool.query("DELETE FROM rate_limit_hits WHERE key = $1", [REPORT_COUNTER_IP]);
  });

  after(async () => {
    await clearRateLimitHits(VERIFY_IP, LOGIN_IP, CLEANUP_AUTH_IP);
    await pool.query("DELETE FROM rate_limit_hits WHERE key = $1", [REPORT_COUNTER_IP]);
    await pool.end();
  });

  it("limits repeated game-code verification attempts", async () => {
    for (let i = 0; i < 8; i++) {
      const res = await request(app)
        .post("/api/auth/verify")
        .set("X-Forwarded-For", VERIFY_IP)
        .send({ code: `R${i}TE` });

      assert.equal(
        res.status,
        200,
        `request ${i + 1}/8 should not be limited: ${JSON.stringify(res.body)}`,
      );
      assert.equal(res.body.valid, false);
    }

    const limited = await request(app)
      .post("/api/auth/verify")
      .set("X-Forwarded-For", VERIFY_IP)
      .send({ code: "RATE" });

    assert.equal(limited.status, 429);
    assert.equal(typeof limited.body.error, "string");
    assert.ok(limited.headers["ratelimit"]);
    assert.ok(limited.headers["retry-after"]);
  });

  it("limits repeated host login attempts", async () => {
    for (let i = 0; i < 8; i++) {
      const res = await request(app)
        .post("/api/auth/email/login")
        .set("X-Forwarded-For", LOGIN_IP)
        .send({
          email: "rate-limit-test@example.test",
          password: "WrongPass!23456",
          rememberMe: false,
        });

      assert.equal(
        res.status,
        401,
        `request ${i + 1}/8 should reach login: ${JSON.stringify(res.body)}`,
      );
    }

    const limited = await request(app)
      .post("/api/auth/email/login")
      .set("X-Forwarded-For", LOGIN_IP)
      .send({
        email: "rate-limit-test@example.test",
        password: "WrongPass!23456",
        rememberMe: false,
      });

    assert.equal(limited.status, 429);
    assert.equal(typeof limited.body.error, "string");
    assert.ok(limited.headers["ratelimit"]);
    assert.ok(limited.headers["retry-after"]);
  });

  it("does not prune a report counter during its one-hour window", async () => {
    const stillValidReportCounter = new Date(Date.now() - 31 * 60 * 1000);
    await pool.query(
      `INSERT INTO rate_limit_hits (key, window_start, hits)
       VALUES ($1, $2, 15)`,
      [REPORT_COUNTER_IP, stillValidReportCounter.toISOString()],
    );

    const authRequest = await request(app)
      .post("/api/auth/verify")
      .set("X-Forwarded-For", CLEANUP_AUTH_IP)
      .send({ code: "TEST" });
    assert.equal(authRequest.status, 200);

    const persisted = await pool.query<{ hits: number }>(
      "SELECT hits FROM rate_limit_hits WHERE key = $1",
      [REPORT_COUNTER_IP],
    );
    assert.equal(persisted.rows.length, 1);
    assert.equal(persisted.rows[0]!.hits, 15);
  });
});