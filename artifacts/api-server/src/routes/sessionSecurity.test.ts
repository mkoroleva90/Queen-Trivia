/**
 * Integration coverage for revoking email-admin browser sessions after account
 * security events. These tests use separate cookie jars to model a legitimate
 * browser and a previously stolen browser session.
 */

// Use non-secure test cookies so supertest can model separate HTTP browser
// sessions. The app uses Secure cookies in production behind HTTPS.
process.env["NODE_ENV"] = "development";
process.env["SESSION_SECRET"] = "test-secret-for-unit-tests-32chars!!";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import pg from "pg";
import request from "supertest";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set to run sessionSecurity.test.ts");
}

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const password = "session-security-test-password";
const passwordChanged = "session-security-test-password-changed";
const accounts = [
  "session-security-password@example.invalid",
  "session-security-account-delete@example.invalid",
  "session-security-admin-delete@example.invalid",
];

async function login(
  email: string,
  ip: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/email/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password });
  assert.equal(response.status, 200, `expected login to succeed for ${email}`);
  return agent;
}

describe("email-admin session revocation", () => {
  before(async () => {
    const passwordHash = await bcrypt.hash(password, 12);
    for (const email of accounts) {
      await pool.query("DELETE FROM sessions WHERE sess->>'adminEmail' = $1", [email]);
      await pool.query("DELETE FROM admin_accounts WHERE email = $1", [email]);
      await pool.query(
        `INSERT INTO admin_accounts (email, password_hash, email_verified)
         VALUES ($1, $2, TRUE)`,
        [email, passwordHash],
      );
    }
  });

  after(async () => {
    for (const email of accounts) {
      await pool.query("DELETE FROM sessions WHERE sess->>'adminEmail' = $1", [email]);
      await pool.query("DELETE FROM admin_accounts WHERE email = $1", [email]);
    }
    await pool.end();
  });

  it("revokes other browser sessions after a password change but preserves the current session", async () => {
    const email = accounts[0]!;
    const currentBrowser = await login(email, "203.0.113.220");
    const stolenBrowser = await login(email, "203.0.113.221");

    const changed = await currentBrowser
      .post("/api/auth/email/change-password")
      .set("X-Forwarded-For", "203.0.113.222")
      .send({ currentPassword: password, newPassword: passwordChanged });
    assert.equal(changed.status, 200);

    const currentAccess = await currentBrowser.get("/api/account/display-name");
    assert.equal(currentAccess.status, 200);

    const staleAccess = await stolenBrowser.get("/api/account/display-name");
    assert.equal(staleAccess.status, 403);
  });

  it("revokes every browser session when the user-facing account endpoint deletes an account", async () => {
    const email = accounts[1]!;
    const deletingBrowser = await login(email, "203.0.113.223");
    const stolenBrowser = await login(email, "203.0.113.224");

    const deleted = await deletingBrowser.delete("/api/auth/email/account");
    assert.equal(deleted.status, 200);

    const staleAccess = await stolenBrowser.get("/api/account/display-name");
    assert.equal(staleAccess.status, 403);
  });

  it("revokes every browser session when the admin cleanup endpoint deletes an account", async () => {
    const email = accounts[2]!;
    const deletingBrowser = await login(email, "203.0.113.225");
    const stolenBrowser = await login(email, "203.0.113.226");

    const deleted = await deletingBrowser.delete("/api/auth/email/admin-account");
    assert.equal(deleted.status, 200);

    const staleAccess = await stolenBrowser.get("/api/account/display-name");
    assert.equal(staleAccess.status, 403);
  });
});