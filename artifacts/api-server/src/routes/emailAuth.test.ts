/**
 * Integration test for the account-scoped mobile password-reset limiter.
 *
 * NODE_ENV is set before the bundled app is imported so loopback requests are
 * not skipped. The endpoint returns 400 for each invalid code, then 429 after
 * the fifth failure for the same account, even when every request comes from
 * a different source IP or the reset code is reissued.
 */

process.env["NODE_ENV"] = "production";
process.env["SESSION_SECRET"] = "test-secret-for-unit-tests-32chars!!";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import request from "supertest";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set to run emailAuth.test.ts");
}

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const testEmail = "otp-rate-limit-test@example.invalid";
const validResetCode = "123456";
const resetTokenHash = crypto.createHash("sha256").update(validResetCode).digest("hex");
let resetKey = "";
const testIps = [
  "203.0.113.201",
  "203.0.113.202",
  "203.0.113.203",
  "203.0.113.204",
  "203.0.113.205",
  "203.0.113.206",
];
const authKeys = testIps.map((ip) => `auth:${ip}`);

const resetRequestBody = {
  email: testEmail,
  code: "000000",
  password: "a-secure-test-password",
};

describe("POST /api/auth/email/mobile-reset-password — account rate limiting", () => {
  before(async () => {
    await pool.query("DELETE FROM admin_accounts WHERE email = $1", [testEmail]);
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts
         (email, password_hash, email_verified, reset_token_hash, reset_token_expiry)
       VALUES ($1, $2, TRUE, $3, NOW() + interval '15 minutes')
       RETURNING id`,
      [testEmail, "not-used-for-reset-limit-test", resetTokenHash],
    );
    resetKey = `mobile-password-reset:${crypto
      .createHmac("sha256", process.env["SESSION_SECRET"] ?? "")
      .update(`mobile-password-reset:v1:${inserted.rows[0]!.id}`)
      .digest("hex")}`;
    await pool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[resetKey, ...authKeys]],
    );
  });

  after(async () => {
    await pool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[resetKey, ...authKeys]],
    );
    await pool.query("DELETE FROM admin_accounts WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("blocks the sixth invalid code despite IP rotation and code reissue", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/email/mobile-reset-password")
        .set("X-Forwarded-For", testIps[i]!)
        .send(resetRequestBody);

      assert.equal(
        res.status,
        400,
        `invalid attempt ${i + 1}/5 should reach the reset handler`,
      );
    }

    // A new code must not grant a fresh guessing budget for this account.
    const reissuedTokenHash = crypto.createHash("sha256").update("654321").digest("hex");
    await pool.query(
      "UPDATE admin_accounts SET reset_token_hash = $1 WHERE email = $2",
      [reissuedTokenHash, testEmail],
    );

    const blocked = await request(app)
      .post("/api/auth/email/mobile-reset-password")
      .set("X-Forwarded-For", testIps[5]!)
      .send(resetRequestBody);

    assert.equal(blocked.status, 429);
    assert.equal(typeof blocked.body.error, "string");
  });
});