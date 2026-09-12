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

// ── Mobile email verification by code ────────────────────────────────────────
// Mirrors the reset-limiter test above for POST /auth/email/mobile-register and
// POST /auth/email/mobile-verify. RESEND_API_KEY is unset in tests, so the code
// email fails inside the route's try/catch and the generic response is returned;
// the code is written straight into verification_token_hash instead.

const verifyPool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const registerEmail = "otp-mobile-register-test@example.invalid";
const verifyLimitEmail = "otp-mobile-verify-limit-test@example.invalid";
const verifySuccessEmail = "otp-mobile-verify-success-test@example.invalid";
const validVerifyCode = "123456";
const verifyTokenHash = crypto.createHash("sha256").update(validVerifyCode).digest("hex");
const verifyIps = [
  "203.0.113.211",
  "203.0.113.212",
  "203.0.113.213",
  "203.0.113.214",
  "203.0.113.215",
  "203.0.113.216",
  "203.0.113.217",
  "203.0.113.218",
  "203.0.113.219",
];
const verifyAuthKeys = verifyIps.map((ip) => `auth:${ip}`);
let verifyLimitKey = "";
let verifySuccessKey = "";

function mobileVerifyKeyFor(accountId: number): string {
  return `mobile-email-verify:${crypto
    .createHmac("sha256", process.env["SESSION_SECRET"] ?? "")
    .update(`mobile-email-verify:v1:${accountId}`)
    .digest("hex")}`;
}

describe("POST /api/auth/email/mobile-register — code-based signup", () => {
  before(async () => {
    await verifyPool.query("DELETE FROM admin_accounts WHERE email = $1", [registerEmail]);
    await verifyPool.query("DELETE FROM rate_limit_hits WHERE key = ANY($1)", [verifyAuthKeys]);
  });

  after(async () => {
    await verifyPool.query("DELETE FROM admin_accounts WHERE email = $1", [registerEmail]);
  });

  it("creates an unverified account with a 15-minute code and responds generically", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-register")
      .set("X-Forwarded-For", verifyIps[0]!)
      .send({ email: registerEmail, password: "a-secure-test-password" });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.message, "string");

    const { rows } = await verifyPool.query<{
      email_verified: boolean;
      verification_token_hash: string | null;
      minutes_left: number;
    }>(
      `SELECT email_verified, verification_token_hash,
              EXTRACT(EPOCH FROM (verification_token_expiry - NOW())) / 60 AS minutes_left
         FROM admin_accounts WHERE email = $1`,
      [registerEmail],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.email_verified, false);
    assert.match(rows[0]!.verification_token_hash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(Number(rows[0]!.minutes_left) > 13 && Number(rows[0]!.minutes_left) <= 15);

    // Capture the current credential state so we can prove the unverified
    // account was taken over (password + fresh code) by the re-registration.
    const before = await verifyPool.query<{
      verification_token_hash: string | null;
      password_hash: string | null;
    }>(
      "SELECT verification_token_hash, password_hash FROM admin_accounts WHERE email = $1",
      [registerEmail],
    );

    // Re-registering an existing (still UNVERIFIED) address must be
    // indistinguishable from success AND take over the account.
    const again = await request(app)
      .post("/api/auth/email/mobile-register")
      .set("X-Forwarded-For", verifyIps[1]!)
      .send({ email: registerEmail, password: "another-password-1234" });
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, res.body);

    const count = await verifyPool.query("SELECT COUNT(*)::int AS n FROM admin_accounts WHERE email = $1", [registerEmail]);
    assert.equal(count.rows[0].n, 1);

    const after = await verifyPool.query<{
      verification_token_hash: string | null;
      password_hash: string | null;
      email_verified: boolean;
    }>(
      "SELECT verification_token_hash, password_hash, email_verified FROM admin_accounts WHERE email = $1",
      [registerEmail],
    );
    assert.notEqual(after.rows[0]!.verification_token_hash, before.rows[0]!.verification_token_hash);
    assert.notEqual(after.rows[0]!.password_hash, before.rows[0]!.password_hash);
    assert.equal(after.rows[0]!.email_verified, false);
  });
});

describe("POST /api/auth/email/mobile-verify — account rate limiting and sign-in", () => {
  before(async () => {
    await verifyPool.query(
      "DELETE FROM admin_accounts WHERE email = ANY($1)",
      [[verifyLimitEmail, verifySuccessEmail]],
    );
    const inserted = await verifyPool.query<{ id: number; email: string }>(
      `INSERT INTO admin_accounts
         (email, password_hash, email_verified, verification_token_hash, verification_token_expiry)
       VALUES ($1, $3, FALSE, $4, NOW() + interval '15 minutes'),
              ($2, $3, FALSE, $4, NOW() + interval '15 minutes')
       RETURNING id, email`,
      [verifyLimitEmail, verifySuccessEmail, "not-used-for-verify-test", verifyTokenHash],
    );
    for (const row of inserted.rows) {
      if (row.email === verifyLimitEmail) verifyLimitKey = mobileVerifyKeyFor(row.id);
      if (row.email === verifySuccessEmail) verifySuccessKey = mobileVerifyKeyFor(row.id);
    }
    await verifyPool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[verifyLimitKey, verifySuccessKey, ...verifyAuthKeys]],
    );
  });

  after(async () => {
    await verifyPool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[verifyLimitKey, verifySuccessKey, ...verifyAuthKeys]],
    );
    await verifyPool.query(
      "DELETE FROM admin_accounts WHERE email = ANY($1)",
      [[verifyLimitEmail, verifySuccessEmail]],
    );
    await verifyPool.end();
  });

  it("blocks the sixth invalid code despite IP rotation and code reissue", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/email/mobile-verify")
        .set("X-Forwarded-For", verifyIps[i]!)
        .send({ email: verifyLimitEmail, code: "000000" });

      assert.equal(res.status, 400, `invalid attempt ${i + 1}/5 should reach the verify handler`);
    }

    const reissuedTokenHash = crypto.createHash("sha256").update("654321").digest("hex");
    await verifyPool.query(
      "UPDATE admin_accounts SET verification_token_hash = $1 WHERE email = $2",
      [reissuedTokenHash, verifyLimitEmail],
    );

    const blocked = await request(app)
      .post("/api/auth/email/mobile-verify")
      .set("X-Forwarded-For", verifyIps[5]!)
      .send({ email: verifyLimitEmail, code: "654321" });

    assert.equal(blocked.status, 429);
    assert.equal(typeof blocked.body.error, "string");

    const { rows } = await verifyPool.query<{ email_verified: boolean }>(
      "SELECT email_verified FROM admin_accounts WHERE email = $1",
      [verifyLimitEmail],
    );
    assert.equal(rows[0]!.email_verified, false);
  });

  it("marks the email verified, clears the code, and returns an admin token", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-verify")
      .set("X-Forwarded-For", verifyIps[6]!)
      .send({ email: verifySuccessEmail, code: validVerifyCode });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.adminToken, "string");
    assert.ok(res.body.adminToken.length > 0);

    const { rows } = await verifyPool.query<{
      email_verified: boolean;
      verification_token_hash: string | null;
      verification_token_expiry: Date | null;
    }>(
      "SELECT email_verified, verification_token_hash, verification_token_expiry FROM admin_accounts WHERE email = $1",
      [verifySuccessEmail],
    );
    assert.equal(rows[0]!.email_verified, true);
    assert.equal(rows[0]!.verification_token_hash, null);
    assert.equal(rows[0]!.verification_token_expiry, null);

    // The token returned must be accepted as an admin Bearer token.
    const me = await request(app)
      .get("/api/games")
      .set("X-Forwarded-For", verifyIps[7]!)
      .set("Authorization", `Bearer ${res.body.adminToken}`);
    assert.equal(me.status, 200);

    // A consumed code cannot be replayed.
    const replay = await request(app)
      .post("/api/auth/email/mobile-verify")
      .set("X-Forwarded-For", verifyIps[8]!)
      .send({ email: verifySuccessEmail, code: validVerifyCode });
    assert.equal(replay.status, 400);
  });
});

// ── Mobile resend verification code ──────────────────────────────────────────

const resendPool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const resendUnverifiedEmail = "otp-resend-unverified-test@example.invalid";
const resendVerifiedEmail = "otp-resend-verified-test@example.invalid";
const resendMissingEmail = "otp-resend-missing-test@example.invalid";
const resendIps = [
  "203.0.113.221",
  "203.0.113.222",
  "203.0.113.223",
];
const resendAuthKeys = resendIps.map((ip) => `auth:${ip}`);
const resendKnownCode = "111111";
const resendKnownHash = crypto.createHash("sha256").update(resendKnownCode).digest("hex");

describe("POST /api/auth/email/mobile-resend-code", () => {
  before(async () => {
    await resendPool.query(
      "DELETE FROM admin_accounts WHERE email = ANY($1)",
      [[resendUnverifiedEmail, resendVerifiedEmail, resendMissingEmail]],
    );
    await resendPool.query("DELETE FROM rate_limit_hits WHERE key = ANY($1)", [resendAuthKeys]);
    await resendPool.query(
      `INSERT INTO admin_accounts
         (email, password_hash, email_verified, verification_token_hash, verification_token_expiry)
       VALUES ($1, $2, FALSE, $3, NOW() + interval '15 minutes')`,
      [resendUnverifiedEmail, "not-used-for-resend-test", resendKnownHash],
    );
    await resendPool.query(
      `INSERT INTO admin_accounts
         (email, password_hash, email_verified, verification_token_hash, verification_token_expiry)
       VALUES ($1, $2, TRUE, NULL, NULL)`,
      [resendVerifiedEmail, "not-used-for-resend-test"],
    );
  });

  after(async () => {
    await resendPool.query("DELETE FROM rate_limit_hits WHERE key = ANY($1)", [resendAuthKeys]);
    await resendPool.query(
      "DELETE FROM admin_accounts WHERE email = ANY($1)",
      [[resendUnverifiedEmail, resendVerifiedEmail, resendMissingEmail]],
    );
    await resendPool.end();
  });

  it("issues a fresh code for an unverified account", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-resend-code")
      .set("X-Forwarded-For", resendIps[0]!)
      .send({ email: resendUnverifiedEmail });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.message, "string");

    const { rows } = await resendPool.query<{
      verification_token_hash: string | null;
      minutes_left: number;
    }>(
      `SELECT verification_token_hash,
              EXTRACT(EPOCH FROM (verification_token_expiry - NOW())) / 60 AS minutes_left
         FROM admin_accounts WHERE email = $1`,
      [resendUnverifiedEmail],
    );
    assert.match(rows[0]!.verification_token_hash ?? "", /^[0-9a-f]{64}$/);
    assert.notEqual(rows[0]!.verification_token_hash, resendKnownHash);
    assert.ok(Number(rows[0]!.minutes_left) > 13 && Number(rows[0]!.minutes_left) <= 15);
  });

  it("does not re-issue a code for an already verified account", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-resend-code")
      .set("X-Forwarded-For", resendIps[1]!)
      .send({ email: resendVerifiedEmail });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const { rows } = await resendPool.query<{
      verification_token_hash: string | null;
      email_verified: boolean;
    }>(
      "SELECT verification_token_hash, email_verified FROM admin_accounts WHERE email = $1",
      [resendVerifiedEmail],
    );
    assert.equal(rows[0]!.verification_token_hash, null);
    assert.equal(rows[0]!.email_verified, true);
  });

  it("responds generically for a non-existent account without creating a row", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-resend-code")
      .set("X-Forwarded-For", resendIps[2]!)
      .send({ email: resendMissingEmail });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const count = await resendPool.query(
      "SELECT COUNT(*)::int AS n FROM admin_accounts WHERE email = $1",
      [resendMissingEmail],
    );
    assert.equal(count.rows[0].n, 0);
  });
});

// ── Mobile reset verifies the email ──────────────────────────────────────────

const resetVerifyPool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const resetVerifyEmail = "otp-reset-verifies-email-test@example.invalid";
const resetVerifyCode = "222222";
const resetVerifyHash = crypto.createHash("sha256").update(resetVerifyCode).digest("hex");
const resetVerifyIp = "203.0.113.231";
const resetVerifyAuthKey = `auth:${resetVerifyIp}`;
let resetVerifyResetKey = "";

describe("POST /api/auth/email/mobile-reset-password — verifies the email on success", () => {
  before(async () => {
    await resetVerifyPool.query("DELETE FROM admin_accounts WHERE email = $1", [resetVerifyEmail]);
    const inserted = await resetVerifyPool.query<{ id: number }>(
      `INSERT INTO admin_accounts
         (email, password_hash, email_verified, reset_token_hash, reset_token_expiry)
       VALUES ($1, $2, FALSE, $3, NOW() + interval '15 minutes')
       RETURNING id`,
      [resetVerifyEmail, "not-used-for-reset-verify-test", resetVerifyHash],
    );
    resetVerifyResetKey = `mobile-password-reset:${crypto
      .createHmac("sha256", process.env["SESSION_SECRET"] ?? "")
      .update(`mobile-password-reset:v1:${inserted.rows[0]!.id}`)
      .digest("hex")}`;
    await resetVerifyPool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[resetVerifyResetKey, resetVerifyAuthKey]],
    );
  });

  after(async () => {
    await resetVerifyPool.query(
      "DELETE FROM rate_limit_hits WHERE key = ANY($1)",
      [[resetVerifyResetKey, resetVerifyAuthKey]],
    );
    await resetVerifyPool.query("DELETE FROM admin_accounts WHERE email = $1", [resetVerifyEmail]);
    await resetVerifyPool.end();
  });

  it("flips email_verified to TRUE and clears the reset token", async () => {
    const res = await request(app)
      .post("/api/auth/email/mobile-reset-password")
      .set("X-Forwarded-For", resetVerifyIp)
      .send({ email: resetVerifyEmail, code: resetVerifyCode, password: "a-secure-test-password" });

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.adminToken, "string");

    const { rows } = await resetVerifyPool.query<{
      email_verified: boolean;
      reset_token_hash: string | null;
      reset_token_expiry: Date | null;
    }>(
      "SELECT email_verified, reset_token_hash, reset_token_expiry FROM admin_accounts WHERE email = $1",
      [resetVerifyEmail],
    );
    assert.equal(rows[0]!.email_verified, true);
    assert.equal(rows[0]!.reset_token_hash, null);
    assert.equal(rows[0]!.reset_token_expiry, null);
  });
});
