/**
 * Integration tests for releasing a game's access code on completion.
 *
 * The access_code column is UNIQUE, so a finished game that keeps its code
 * would reserve that code forever and block any new game from using it. When a
 * game transitions to "completed" (PATCH /api/games/:gameId), the server must
 * clear its access code so the same code becomes available to a new game.
 *
 * Verifies:
 *  1. While a game is active, its code is reserved — creating another game with
 *     the same code is rejected with 409.
 *  2. Completing the game nulls its access code in both the response and the DB.
 *  3. After completion, a brand-new game can take the released code, and a
 *     player joining with that code lands on the new game, not the old one.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/gameAccessCodeRelease.test.ts
 * (Requires dist/app.mjs — run `pnpm run build` first — and DATABASE_URL.)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";
import pg from "pg";
import type { IRouter } from "express";

// ── Environment setup ────────────────────────────────────────────────────────

process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

function generateTestAdminToken(adminAccountId: number): string {
  const encoded = Buffer.from(JSON.stringify({
    role: "admin",
    adminAccountId,
    iat: Date.now(),
  })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET!)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
  router: IRouter;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run gameAccessCodeRelease.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Suite ────────────────────────────────────────────────────────────────────

describe("PATCH /api/games/:gameId — access code release on completion", () => {
  const ACCESS_CODE = "RELEASE99";
  const ADMIN_EMAIL = "__test__release@example.com";
  const PLAYER_NAME = "__test__release_player";

  let adminId: number;
  let adminToken: string;
  let originalGameId: number;
  const createdGameIds: number[] = [];

  before(async () => {
    const account = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts (email, email_verified)
       VALUES ($1, TRUE)
       RETURNING id`,
      [ADMIN_EMAIL],
    );
    adminId = account.rows[0]!.id;
    adminToken = generateTestAdminToken(adminId);

    const gameRes = await pool.query<{ id: number }>(
      `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin, owner_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      ["Release Test", "easy", 0, "active", ACCESS_CODE, true, adminId],
    );
    originalGameId = gameRes.rows[0]!.id;
    createdGameIds.push(originalGameId);
  });

  after(async () => {
    if (createdGameIds.length > 0) {
      await pool.query(
        `DELETE FROM games WHERE id = ANY($1::int[])`,
        [createdGameIds],
      );
    }
    await pool.query("DELETE FROM users WHERE name LIKE $1", ["__test__release%"]);
    await pool.query("DELETE FROM admin_accounts WHERE email = $1", [ADMIN_EMAIL]);
    await pool.end();
  });

  it("reserves the code while the game is not completed", async () => {
    const res = await request(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ topic: "Duplicate Attempt", difficulty: "easy", accessCode: ACCESS_CODE });

    if (res.status === 201 && typeof res.body?.id === "number") {
      createdGameIds.push(res.body.id); // track for cleanup if the guard ever regresses
    }
    assert.equal(res.status, 409, `expected 409 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, "code_taken");
  });

  it("releases the code on completion and frees it for a new game", async () => {
    // Complete the original game.
    const patchRes = await request(app)
      .patch(`/api/games/${originalGameId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "completed" });

    assert.equal(patchRes.status, 200, `patch failed: ${JSON.stringify(patchRes.body)}`);
    assert.equal(patchRes.body.status, "completed");
    assert.equal(
      patchRes.body.accessCode,
      null,
      "completed game must report a released (null) access code",
    );

    // The code is cleared in the database, not just the response.
    const dbRow = await pool.query<{ access_code: string | null }>(
      "SELECT access_code FROM games WHERE id = $1",
      [originalGameId],
    );
    assert.equal(dbRow.rows[0]!.access_code, null, "access_code must be NULL in the DB");

    // A brand-new game can now take the released code.
    const createRes = await request(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ topic: "Reuses Released Code", difficulty: "easy", accessCode: ACCESS_CODE });

    assert.equal(createRes.status, 201, `reuse create failed: ${JSON.stringify(createRes.body)}`);
    assert.equal(createRes.body.accessCode, ACCESS_CODE);
    const newGameId = createRes.body.id as number;
    createdGameIds.push(newGameId);

    // Joining with the code now resolves to the new game, not the completed one.
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PLAYER_NAME });

    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);
    assert.equal(
      loginRes.body.gameId,
      newGameId,
      "the released code must admit players to the new game",
    );
  });
});
