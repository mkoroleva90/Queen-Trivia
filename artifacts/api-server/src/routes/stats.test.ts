/**
 * Integration coverage for host-scoped dashboard metrics.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/stats.test.ts
 * (Requires dist/app.mjs — run `pnpm run build` first.)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import pg from "pg";
import type { IRouter } from "express";

process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

const { default: app, router } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
  router: IRouter;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run stats.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// This route exists only in the test process and lets the suite exercise the
// production session-backed authorization path without email delivery.
(router as IRouter).post("/test-set-stats-admin-session", (req, res): void => {
  const adminAccountId = (req.body as { adminAccountId?: unknown }).adminAccountId;
  req.session.isAdmin = true;
  if (typeof adminAccountId === "number") {
    req.session.adminAccountId = adminAccountId;
  }
  req.session.save(() => res.json({ ok: true }));
});

describe("GET /api/stats/summary — host isolation", () => {
  let ownerAdminId: number;
  let foreignAdminId: number;
  let ownerGameIds: number[];
  let foreignGameId: number;
  let userIds: number[];

  before(async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const accounts = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts (email, email_verified)
       VALUES ($1, true), ($2, true)
       RETURNING id`,
      [
        `__test__stats_owner_${suffix}@example.test`,
        `__test__stats_foreign_${suffix}@example.test`,
      ],
    );
    ownerAdminId = accounts.rows[0]!.id;
    foreignAdminId = accounts.rows[1]!.id;

    const games = await pool.query<{ id: number }>(
      `INSERT INTO games
         (topic, difficulty, question_count, status, access_code, created_by_admin, owner_admin_id)
       VALUES
         ($1, 'easy', 1, 'active', $2, true, $3),
         ($4, 'easy', 1, 'completed', $5, true, $3),
         ($6, 'easy', 1, 'active', $7, true, $8)
       RETURNING id`,
      [
        "Owner active game", `S${suffix}A`, ownerAdminId,
        "Owner completed game", `S${suffix}B`,
        "Foreign game", `S${suffix}C`, foreignAdminId,
      ],
    );
    ownerGameIds = [games.rows[0]!.id, games.rows[1]!.id];
    foreignGameId = games.rows[2]!.id;

    const users = await pool.query<{ id: number }>(
      `INSERT INTO users (name)
       VALUES ($1), ($2), ($3)
       RETURNING id`,
      [
        `stats_isolation_shared_${suffix}`,
        `stats_isolation_owner_${suffix}`,
        `stats_isolation_foreign_${suffix}`,
      ],
    );
    userIds = users.rows.map((row) => row.id);

    const questions = await pool.query<{ id: number; game_id: number }>(
      `INSERT INTO questions
         (game_id, question_text, question_type, correct_answer, points, order_index)
       VALUES
         ($1, 'Owner active?', 'true_false', 'true', 10, 0),
         ($2, 'Owner completed?', 'true_false', 'true', 10, 0),
         ($3, 'Foreign?', 'true_false', 'true', 10, 0)
       RETURNING id, game_id`,
      [ownerGameIds[0], ownerGameIds[1], foreignGameId],
    );
    const questionByGame = new Map(questions.rows.map((row) => [row.game_id, row.id]));

    await pool.query(
      `INSERT INTO game_participants (game_id, user_id)
       VALUES ($1, $2), ($3, $2), ($3, $4), ($5, $6)`,
      [
        ownerGameIds[0], userIds[0],
        ownerGameIds[1], userIds[1],
        foreignGameId, userIds[2],
      ],
    );

    await pool.query(
      `INSERT INTO answers
         (user_id, game_id, question_id, user_answer, is_correct, points_earned)
       VALUES
         ($1, $2, $3, 'true', true, 10),
         ($1, $4, $5, 'true', true, 10),
         ($6, $4, $5, 'true', true, 10),
         ($7, $8, $9, 'true', true, 10)`,
      [
        userIds[0], ownerGameIds[0], questionByGame.get(ownerGameIds[0]),
        ownerGameIds[1], questionByGame.get(ownerGameIds[1]), userIds[1],
        userIds[2], foreignGameId, questionByGame.get(foreignGameId),
      ],
    );
  });

  after(async () => {
    await pool.query("DELETE FROM games WHERE id = ANY($1)", [[...ownerGameIds, foreignGameId]]);
    await pool.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
    await pool.query("DELETE FROM admin_accounts WHERE id = ANY($1)", [[ownerAdminId, foreignAdminId]]);
    await pool.end();
  });

  async function statsFor(adminAccountId?: number) {
    const agent = request.agent(app);
    await agent.post("/api/test-set-stats-admin-session").send({ adminAccountId });
    return agent.get("/api/stats/summary");
  }

  it("returns only the signed-in host's owned-game metrics", async () => {
    const response = await statsFor(ownerAdminId);

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body, {
      totalGames: 2,
      activeGames: 1,
      totalPlayers: 2,
      totalAnswers: 3,
    });
  });

  it("does not include another host's metrics", async () => {
    const response = await statsFor(foreignAdminId);

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body, {
      totalGames: 1,
      activeGames: 1,
      totalPlayers: 1,
      totalAnswers: 1,
    });
  });

  it("rejects legacy admin sessions that cannot be tenant-scoped", async () => {
    const response = await statsFor();

    assert.equal(response.status, 403, JSON.stringify(response.body));
    assert.equal(response.body.error, "Account-backed admin access required");
  });
});