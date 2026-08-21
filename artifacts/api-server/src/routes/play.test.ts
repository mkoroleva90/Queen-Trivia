/**
 * Integration tests for the player rejoin / mid-game re-entry flow.
 *
 * Verifies:
 *  1. The join endpoint is idempotent — calling it twice with the same session
 *     returns the same participant record, not a duplicate.
 *  2. After answering some questions, the answered-question IDs are preserved
 *     across a simulated re-entry (same session, new page load).
 *  3. The unanswered-question filtering logic (mirroring the mobile game screen)
 *     correctly excludes answered questions so the player lands on the right
 *     question rather than restarting from the beginning.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/play.test.ts
 * (Requires dist/app.mjs — run `pnpm run build` first.)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import pg from "pg";
import type { IRouter } from "express";

// ── Environment setup ────────────────────────────────────────────────────────

process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

const { default: app, router } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
  router: IRouter;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run play.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Test data helpers ────────────────────────────────────────────────────────

type TestGame = { id: number; accessCode: string };
type TestQuestion = { id: number };

/**
 * Insert a minimal active game and the given number of true/false questions
 * into the real database.  Returns ids so tests can reference them.
 */
async function seedGameWithQuestions(
  accessCode: string,
  questionCount: number,
): Promise<{ game: TestGame; questions: TestQuestion[] }> {
  const gameRes = await pool.query<{ id: number }>(
    `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    ["Test Topic", "easy", questionCount, "active", accessCode, true],
  );
  const gameId = gameRes.rows[0]!.id;

  const questions: TestQuestion[] = [];
  for (let i = 0; i < questionCount; i++) {
    const qRes = await pool.query<{ id: number }>(
      `INSERT INTO questions (game_id, question_text, question_type, correct_answer, points, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [gameId, `Test question ${i + 1}?`, "true_false", "true", 10, i],
    );
    questions.push({ id: qRes.rows[0]!.id });
  }

  return { game: { id: gameId, accessCode }, questions };
}

/** Remove all test rows created by the suite. */
async function cleanupGame(gameId: number): Promise<void> {
  // Cascade deletes questions, answers, and game_participants automatically.
  await pool.query("DELETE FROM games WHERE id = $1", [gameId]);
  // Users created during login are not tied to the game; clean by name prefix.
  await pool.query("DELETE FROM users WHERE name LIKE $1", ["__test__%"]);
}

// ─── Suite 1: join endpoint idempotency ──────────────────────────────────────

describe("POST /api/games/:gameId/join — idempotency", () => {
  let game: TestGame;
  const ACCESS_CODE = "TJOIN1";
  const PLAYER_NAME = "__test__join_idempotency";

  before(async () => {
    ({ game } = await seedGameWithQuestions(ACCESS_CODE, 2));
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("returns 201 and the participant on first join", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PLAYER_NAME });

    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);
    assert.equal(loginRes.body.gameId, game.id);

    const joinRes = await agent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `first join failed: ${JSON.stringify(joinRes.body)}`);
    assert.ok(typeof joinRes.body.id === "number", "participant must have numeric id");
    assert.equal(joinRes.body.gameId, game.id);
  });

  it("returns the same participant on a second join (no duplicate created)", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ code: ACCESS_CODE, name: `${PLAYER_NAME}_2` });

    const first = await agent.post(`/api/games/${game.id}/join`);
    assert.equal(first.status, 201);
    const firstId: number = first.body.id;

    const second = await agent.post(`/api/games/${game.id}/join`);
    assert.equal(second.status, 201, `second join failed: ${JSON.stringify(second.body)}`);
    assert.equal(
      second.body.id,
      firstId,
      "second join must return the same participant id, not a new row",
    );

    // Verify only one participant row exists for this user/game combination.
    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM game_participants
       WHERE game_id = $1 AND user_id = $2`,
      [game.id, first.body.userId],
    );
    assert.equal(
      Number(countRes.rows[0]!.count),
      1,
      "exactly one game_participants row must exist after two join calls",
    );
  });
});

// ─── Suite 2: player game isolation ──────────────────────────────────────────
//
// A player must not be able to use a valid session from one room to enumerate
// another room's game data or access code.

describe("player game-data authorization", () => {
  let joinedGame: TestGame;
  let otherGame: TestGame;
  let playerAgent: ReturnType<typeof request.agent>;
  let playerUserId: number;
  const JOINED_CODE = "TISOL1";
  const OTHER_CODE = "TISOL2";

  before(async () => {
    ({ game: joinedGame } = await seedGameWithQuestions(JOINED_CODE, 1));
    ({ game: otherGame } = await seedGameWithQuestions(OTHER_CODE, 1));

    playerAgent = request.agent(app);
    const loginRes = await playerAgent
      .post("/api/auth/login")
      .send({ code: JOINED_CODE, name: "__test__game_isolation" });
    assert.equal(loginRes.status, 200, `player login failed: ${JSON.stringify(loginRes.body)}`);
    playerUserId = loginRes.body.id;

    const joinRes = await playerAgent.post(`/api/games/${joinedGame.id}/join`);
    assert.equal(joinRes.status, 201, `player join failed: ${JSON.stringify(joinRes.body)}`);
  });

  after(async () => {
    await cleanupGame(joinedGame.id);
    await cleanupGame(otherGame.id);
  });

  for (const [routeName, path] of [
    ["game metadata", (gameId: number) => `/api/games/${gameId}`],
    ["questions", (gameId: number) => `/api/games/${gameId}/questions`],
    ["participants", (gameId: number) => `/api/games/${gameId}/participants`],
    ["results", (gameId: number) => `/api/games/${gameId}/results`],
  ]) {
    it(`rejects an unjoined game's ${routeName}`, async () => {
      const res = await playerAgent.get(path(otherGame.id));
      assert.equal(res.status, 403, `expected 403 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(JSON.stringify(res.body).includes(OTHER_CODE), false, "must not expose the other game's access code");
    });
  }

  it("allows results for the joined game but redacts its access code", async () => {
    const res = await playerAgent.get(`/api/games/${joinedGame.id}/results`);
    assert.equal(res.status, 200, `expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.game.accessCode, null);
    assert.equal(JSON.stringify(res.body).includes(JOINED_CODE), false, "must not expose the joined game's access code");
  });

  it("rejects a player's own answer history for an unjoined game", async () => {
    const res = await playerAgent.get(
      `/api/games/${otherGame.id}/users/${playerUserId}/answers`,
    );
    assert.equal(res.status, 403, `expected 403 but got ${res.status}: ${JSON.stringify(res.body)}`);
  });
});

// ─── Suite 2: answered-question preservation across re-entry ─────────────────

describe("mid-game re-entry — answered questions preserved", () => {
  let game: TestGame;
  let questions: TestQuestion[];
  const ACCESS_CODE = "TREENT1";
  const PLAYER_NAME = "__test__reentry";

  before(async () => {
    ({ game, questions } = await seedGameWithQuestions(ACCESS_CODE, 3));
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("preserves answered question IDs when the same session re-enters the game", async () => {
    const agent = request.agent(app); // agent persists session cookie

    // 1. Login and join.
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PLAYER_NAME });
    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);
    const userId: number = loginRes.body.id;

    await agent.post(`/api/games/${game.id}/join`);

    // 2. Answer the first two questions only.
    const q1 = questions[0]!;
    const q2 = questions[1]!;
    const q3 = questions[2]!;

    const ans1 = await agent
      .post(`/api/games/${game.id}/answers`)
      .send({ questionId: q1.id, userAnswer: "true" });
    assert.equal(ans1.status, 201, `answer Q1 failed: ${JSON.stringify(ans1.body)}`);

    const ans2 = await agent
      .post(`/api/games/${game.id}/answers`)
      .send({ questionId: q2.id, userAnswer: "true" });
    assert.equal(ans2.status, 201, `answer Q2 failed: ${JSON.stringify(ans2.body)}`);

    // 3. Simulate re-entry: the session cookie is still held by `agent`.
    //    The game screen would call GET /api/games/:gameId/users/:userId/answers
    //    on mount to rebuild the answeredIds set.
    const answersRes = await agent.get(`/api/games/${game.id}/users/${userId}/answers`);
    assert.equal(answersRes.status, 200, `fetch answers failed: ${JSON.stringify(answersRes.body)}`);

    const answeredQuestionIds: number[] = answersRes.body.map(
      (a: { questionId: number }) => a.questionId,
    );

    assert.deepEqual(
      answeredQuestionIds.sort((a, b) => a - b),
      [q1.id, q2.id].sort((a, b) => a - b),
      "re-entry must surface exactly the two previously submitted answers",
    );

    // 4. Mirror the mobile game screen's unanswered filtering logic:
    //      answeredIds = new Set(myAnswers.map(a => a.questionId))
    //      unanswered  = allQuestions.filter(q => !answeredIds.has(q.id))
    const answeredIds = new Set(answeredQuestionIds);
    const allIds = questions.map((q) => q.id);
    const unanswered = allIds.filter((id) => !answeredIds.has(id));

    assert.deepEqual(
      unanswered,
      [q3.id],
      "only the third question should remain unanswered after re-entry",
    );
  });

  it("does not flash a 'done' state: unanswered list is non-empty before all questions are answered", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ code: ACCESS_CODE, name: `${PLAYER_NAME}_b` });
    const userId: number = (
      await agent.post("/api/auth/login").send({ code: ACCESS_CODE })
    ).body.id ?? (await agent.post("/api/auth/login").send({ code: ACCESS_CODE })).body.id;

    // Fresh session — fetch answers immediately after joining, before answering anything.
    const freshLoginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: `${PLAYER_NAME}_nodone` });
    assert.equal(freshLoginRes.status, 200);
    const freshUserId: number = freshLoginRes.body.id;

    await agent.post(`/api/games/${game.id}/join`);

    const answersRes = await agent.get(`/api/games/${game.id}/users/${freshUserId}/answers`);
    assert.equal(answersRes.status, 200);
    assert.equal(
      answersRes.body.length,
      0,
      "no answers recorded yet — player has not started",
    );

    // The game screen derives: if unanswered.length > 0, show questions.
    const allIds = questions.map((q) => q.id);
    const answeredIds = new Set<number>();
    const unanswered = allIds.filter((id) => !answeredIds.has(id));

    assert.ok(
      unanswered.length > 0,
      "unanswered list must be non-empty before answering — no premature 'done' flash",
    );
    assert.equal(unanswered.length, questions.length);
  });
});

// ─── Suite 3: re-login with active session restores same user ─────────────────

describe("POST /api/auth/login — active session returns existing user", () => {
  let game: TestGame;
  const ACCESS_CODE = "TSESS1";
  const PLAYER_NAME = "__test__session_restore";

  before(async () => {
    ({ game } = await seedGameWithQuestions(ACCESS_CODE, 1));
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("returns the same userId when session is still active (no logout)", async () => {
    const agent = request.agent(app);

    const first = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PLAYER_NAME });
    assert.equal(first.status, 200, `first login failed: ${JSON.stringify(first.body)}`);
    const firstUserId: number = first.body.id;

    // Second call with same session (no name required — already-logged-in path).
    const second = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE });
    assert.equal(second.status, 200, `second login failed: ${JSON.stringify(second.body)}`);
    assert.equal(
      second.body.id,
      firstUserId,
      "active session must restore the same userId so answered questions remain valid",
    );
  });

  it("prior answers are accessible after session-based re-entry", async () => {
    const agent = request.agent(app);
    const [question] = (await seedGameWithQuestions(`${ACCESS_CODE}X`, 1)).questions;

    // Seed a second mini-game just for this sub-test to avoid collision.
    const miniGame = (await pool.query<{ id: number }>(
      `SELECT id FROM games WHERE access_code = $1`,
      [`${ACCESS_CODE}X`],
    )).rows[0]!;

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: `${ACCESS_CODE}X`, name: `${PLAYER_NAME}_answers` });
    assert.equal(loginRes.status, 200);
    const userId: number = loginRes.body.id;

    await agent.post(`/api/games/${miniGame.id}/join`);

    // Submit an answer before the simulated re-entry.
    const ansRes = await agent
      .post(`/api/games/${miniGame.id}/answers`)
      .send({ questionId: question!.id, userAnswer: "true" });
    assert.equal(ansRes.status, 201);

    // Simulate re-entry: same agent (session preserved), fresh answers fetch.
    const refetchRes = await agent.get(
      `/api/games/${miniGame.id}/users/${userId}/answers`,
    );
    assert.equal(refetchRes.status, 200);
    assert.equal(
      refetchRes.body.length,
      1,
      "re-entry must see the previously submitted answer, not start from zero",
    );
    assert.equal(refetchRes.body[0].questionId, question!.id);

    // Clean up the extra mini-game.
    await cleanupGame(miniGame.id);
  });
});

// ─── Suite 4: kick-to-rejoin-block ───────────────────────────────────────────
//
// Verifies the full removed_participants flow end-to-end:
//  1. A player joins an active game.
//  2. A legacy admin session manages the ownerless test game and kicks them.
//  3. The removed_participants row is written to the database.
//  4. The kicked player's next join attempt returns 403.

// Inject a test-only route into the live router so we can establish an admin
// session without real credentials.  This route exists only in the test process
// and is never shipped to production.
(router as IRouter).post("/test-set-admin-session", (req, res): void => {
  req.session.isAdmin = true;
  // Deliberately omit adminAccountId: legacy sessions may still manage
  // ownerless migration games, which is how the test fixture is seeded.
  req.session.save(() => res.json({ ok: true }));
});

describe("DELETE /api/games/:gameId/participants/:userId — kick + rejoin block", () => {
  let game: TestGame;
  let playerId: number;                        // userId of the joined player
  // Agents are shared across tests so session cookies persist between steps.
  let playerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  const ACCESS_CODE = "TKICK1";
  const PLAYER_NAME = "__test__kick_block";

  before(async () => {
    ({ game } = await seedGameWithQuestions(ACCESS_CODE, 1));

    // ── Player: login and join ──────────────────────────────────────────────
    playerAgent = request.agent(app);
    const loginRes = await playerAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PLAYER_NAME });
    assert.equal(loginRes.status, 200, `player login failed: ${JSON.stringify(loginRes.body)}`);
    playerId = loginRes.body.id;

    const joinRes = await playerAgent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `player join failed: ${JSON.stringify(joinRes.body)}`);

    // ── Admin: establish session via test-only route ─────────────────────────
    adminAgent = request.agent(app);
    const sessionRes = await adminAgent.post("/api/test-set-admin-session");
    assert.equal(sessionRes.status, 200, "test admin session setup failed");
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("player joined the game successfully (participant row exists)", async () => {
    const row = await pool.query<{ id: number }>(
      `SELECT id FROM game_participants WHERE game_id = $1 AND user_id = $2`,
      [game.id, playerId],
    );
    assert.equal(row.rows.length, 1, "game_participants must contain the joined player");
  });

  it("admin can kick the player (DELETE returns 200 and ok: true)", async () => {
    const kickRes = await adminAgent.delete(
      `/api/games/${game.id}/participants/${playerId}`,
    );
    assert.equal(kickRes.status, 200, `kick failed: ${JSON.stringify(kickRes.body)}`);
    assert.equal(kickRes.body.ok, true);
  });

  it("removed_participants row exists in the database after kick, with display_name stored", async () => {
    const row = await pool.query<{ id: number; display_name: string | null }>(
      `SELECT id, display_name FROM removed_participants WHERE game_id = $1 AND user_id = $2`,
      [game.id, playerId],
    );
    assert.equal(
      row.rows.length,
      1,
      "removed_participants must contain exactly one row for the kicked player",
    );
    assert.equal(
      row.rows[0]!.display_name,
      PLAYER_NAME,
      "removed_participants must store the kicked player's display name",
    );
  });

  it("kicked player is rejected with 403 when attempting to rejoin (same session)", async () => {
    // playerAgent already holds the session cookie with the original userId.
    // The login route's "already logged in" path restores the same player
    // identity and refreshes the durable room-code grant.
    const reloginRes = await playerAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE });
    assert.equal(reloginRes.status, 200, `session restore failed: ${JSON.stringify(reloginRes.body)}`);
    assert.equal(
      reloginRes.body.id,
      playerId,
      "session restore must return the original userId, not create a new user",
    );

    const rejoinRes = await playerAgent.post(`/api/games/${game.id}/join`);
    assert.equal(
      rejoinRes.status,
      403,
      `expected 403 for kicked player rejoin but got ${rejoinRes.status}: ${JSON.stringify(rejoinRes.body)}`,
    );
  });
});

// ─── Suite 5: name-based rejoin block ────────────────────────────────────────
//
// Simulates a kicked player returning with a fresh identity (cleared storage /
// new device / incognito) but reusing the same display name.  The join route
// must reject them via the display-name check even though their new userId has
// no removed_participants row.

describe("name-based rejoin block — fresh session, same display name", () => {
  let game: TestGame;
  let originalPlayerId: number;
  let freshPlayerAgent: ReturnType<typeof request.agent>;
  let adminAgent2: ReturnType<typeof request.agent>;
  const ACCESS_CODE = "TKICK2";
  const SHARED_NAME = "__test__kick_by_name";

  before(async () => {
    ({ game } = await seedGameWithQuestions(ACCESS_CODE, 1));

    // ── Original player: login, join, get kicked ────────────────────────────
    const originalAgent = request.agent(app);
    const loginRes = await originalAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: SHARED_NAME });
    assert.equal(loginRes.status, 200, `original player login failed: ${JSON.stringify(loginRes.body)}`);
    originalPlayerId = loginRes.body.id;

    const joinRes = await originalAgent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `original player join failed: ${JSON.stringify(joinRes.body)}`);

    // Admin kicks the original player.
    adminAgent2 = request.agent(app);
    const sessionRes = await adminAgent2.post("/api/test-set-admin-session");
    assert.equal(sessionRes.status, 200, "test admin session setup failed");

    const kickRes = await adminAgent2.delete(
      `/api/games/${game.id}/participants/${originalPlayerId}`,
    );
    assert.equal(kickRes.status, 200, `kick failed: ${JSON.stringify(kickRes.body)}`);

    // ── Fresh player: brand-new session (no cookie), same display name ──────
    // This simulates the player clearing their storage or using a new device.
    // A new user row will be created, giving them a different userId.
    freshPlayerAgent = request.agent(app);
    const freshLoginRes = await freshPlayerAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: SHARED_NAME });
    assert.equal(freshLoginRes.status, 200, `fresh player login failed: ${JSON.stringify(freshLoginRes.body)}`);

    // The fresh session must have a different userId than the original.
    assert.notEqual(
      freshLoginRes.body.id,
      originalPlayerId,
      "fresh login must create a new user row, not reuse the original userId",
    );
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("fresh-session player with the same name is rejected with 403 on join", async () => {
    const rejoinRes = await freshPlayerAgent.post(`/api/games/${game.id}/join`);
    assert.equal(
      rejoinRes.status,
      403,
      `expected 403 for name-based rejoin block but got ${rejoinRes.status}: ${JSON.stringify(rejoinRes.body)}`,
    );
  });
});

// ── Teardown ─────────────────────────────────────────────────────────────────

after(async () => {
  await pool.end();
});
