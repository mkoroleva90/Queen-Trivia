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
const {
  generateAdminToken,
  generateMobileToken,
} = await import("../../dist/app.mjs") as {
  generateAdminToken: (adminAccountId: number) => string;
  generateMobileToken: (userId: number) => string;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
after(async () => {
  await pool.end();
});
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

describe("mobile bearer logout revocation", () => {
  let playerId: number;
  let adminAccountId: number;
  const mobileEmail = "session-security-mobile-logout@example.invalid";

  before(async () => {
    const player = await pool.query<{ id: number }>(
      "INSERT INTO users (name) VALUES ($1) RETURNING id",
      ["session-security-mobile-player"],
    );
    playerId = player.rows[0]!.id;
    const admin = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts (email, email_verified)
       VALUES ($1, TRUE) RETURNING id`,
      [mobileEmail],
    );
    adminAccountId = admin.rows[0]!.id;
  });

  after(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [playerId]);
    await pool.query("DELETE FROM admin_accounts WHERE id = $1", [adminAccountId]);
  });

  it("rejects a copied player token after player logout", async () => {
    const token = generateMobileToken(playerId);
    const beforeLogout = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(beforeLogout.body.user.id, playerId);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(logout.status, 200);

    const afterLogout = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(afterLogout.body.user, null);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const replacementToken = generateMobileToken(playerId);
    const replay = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(replay.status, 200);

    const replacementAccess = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(
      replacementAccess.body.user.id,
      playerId,
      "a stale logout replay must not revoke a newer player login",
    );

    const replacementLogout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(replacementLogout.status, 200);
    const replacementAfterLogout = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(replacementAfterLogout.body.user, null);
  });

  it("rejects a copied admin token after admin logout", async () => {
    const token = generateAdminToken(adminAccountId);
    const beforeLogout = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(beforeLogout.body.isAdmin, true);

    const logout = await request(app)
      .post("/api/admin/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(logout.status, 200);

    const afterLogout = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(afterLogout.body.isAdmin, false);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const replacementToken = generateAdminToken(adminAccountId);
    const replay = await request(app)
      .post("/api/admin/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(replay.status, 200);

    const replacementAccess = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(
      replacementAccess.body.isAdmin,
      true,
      "a stale logout replay must not revoke a newer admin login",
    );

    const replacementLogout = await request(app)
      .post("/api/admin/logout")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(replacementLogout.status, 200);
    const replacementAfterLogout = await request(app)
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${replacementToken}`);
    assert.equal(replacementAfterLogout.body.isAdmin, false);
  });
});