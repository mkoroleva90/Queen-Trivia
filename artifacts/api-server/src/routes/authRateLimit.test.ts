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

async function clearRateLimitHits(...ips: string[]): Promise<void> {
  await pool.query(`DELETE FROM rate_limit_hits WHERE key = ANY($1::text[])`, [ips]);
}

describe("anonymous authentication rate limiting", () => {
  before(async () => {
    await clearRateLimitHits(VERIFY_IP, LOGIN_IP);
  });

  after(async () => {
    await clearRateLimitHits(VERIFY_IP, LOGIN_IP);
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
});