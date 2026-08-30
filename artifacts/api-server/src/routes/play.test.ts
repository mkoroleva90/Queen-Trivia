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
  if (questions[0]) {
    await pool.query(
      "UPDATE games SET current_question_id = $1 WHERE id = $2",
      [questions[0].id, gameId],
    );
  }

  return { game: { id: gameId, accessCode }, questions };
}

/** Insert one active short-response question for disposable grading coverage. */
async function seedGameWithShortResponseQuestion(
  accessCode: string,
): Promise<{ game: TestGame; question: TestQuestion }> {
  const gameRes = await pool.query<{ id: number }>(
    `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    ["Short response test", "easy", 1, "active", accessCode, true],
  );
  const gameId = gameRes.rows[0]!.id;

  const questionRes = await pool.query<{ id: number }>(
    `INSERT INTO questions (
        game_id, question_text, question_type, correct_answer, options, points, order_index
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING id`,
    [
      gameId,
      "What is Saturn's largest moon?",
      "short_response",
      "Titan",
      JSON.stringify({
        rubric: "Award full credit only for Titan, Saturn's largest moon.",
        maxWords: 5,
      }),
      13,
      0,
    ],
  );

  const question = { id: questionRes.rows[0]!.id };
  await pool.query(
    "UPDATE games SET current_question_id = $1 WHERE id = $2",
    [question.id, gameId],
  );
  return { game: { id: gameId, accessCode }, question };
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

  it("returns one participant record across concurrent joins", async () => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: `${PLAYER_NAME}_concurrent` });
    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);
    const cookie = loginRes.headers["set-cookie"];
    assert.ok(cookie, "login must return a session cookie");

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).post(`/api/games/${game.id}/join`).set("Cookie", cookie),
      ),
    );
    assert.ok(
      responses.every((response) => response.status === 201),
      `concurrent joins returned: ${responses.map((response) => response.status).join(", ")}`,
    );
    assert.equal(
      new Set(responses.map((response) => response.body.id)).size,
      1,
      "all concurrent joins must return the same participant id",
    );

    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM game_participants
       WHERE game_id = $1 AND user_id = $2`,
      [game.id, loginRes.body.id],
    );
    assert.equal(Number(countRes.rows[0]!.count), 1);
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

    // A host release, not a client-side cursor, authorizes the next question.
    await pool.query(
      "UPDATE games SET current_question_id = $1 WHERE id = $2",
      [q2.id, game.id],
    );
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
    const { game: miniGame, questions: [question] } = await seedGameWithQuestions(
      `P${String(Date.now()).slice(-5)}`,
      1,
    );

    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: miniGame.accessCode, name: `${PLAYER_NAME}_answers` });
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

  it("removed_participants row stores the removed identity", async () => {
    const row = await pool.query<{
      id: number;
      display_name: string | null;
    }>(
      `SELECT id, display_name
       FROM removed_participants
       WHERE game_id = $1 AND user_id = $2`,
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

  it("kicked player cannot recreate a grant or rejoin from the same session", async () => {
    // The old room code is revoked for every grant write, even when the caller
    // still has the original browser session.
    const reloginRes = await playerAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE });
    assert.equal(reloginRes.status, 403, `expected revoked login: ${JSON.stringify(reloginRes.body)}`);

    const rejoinRes = await playerAgent.post(`/api/games/${game.id}/join`);
    assert.equal(
      rejoinRes.status,
      403,
      `expected 403 for kicked player rejoin but got ${rejoinRes.status}: ${JSON.stringify(rejoinRes.body)}`,
    );
  });
});

// ─── Suite 5: fresh-identity rejoin block ────────────────────────────────────
//
// Simulates a kicked player returning with a fresh identity (cleared storage /
// new device / incognito) and a different display name. The code used at kick
// time must no longer create a user or grant, and grants issued to unjoined
// alternate sessions before the kick must be revoked.

describe("room-code revocation — fresh session, different display name", () => {
  let game: TestGame;
  let originalPlayerId: number;
  let preAuthorizedAgent: ReturnType<typeof request.agent>;
  let adminAgent2: ReturnType<typeof request.agent>;
  const ACCESS_CODE = "TKICK2";
  const ROTATED_CODE = "TKICK3";
  const ORIGINAL_NAME = "__test__kick_original";
  const DIFFERENT_NAME = "__test__kick_different_name";
  const PREAUTHORIZED_NAME = "__test__kick_preauthorized";

  before(async () => {
    ({ game } = await seedGameWithQuestions(ACCESS_CODE, 1));

    // ── Original player: login, join, get kicked ────────────────────────────
    const originalAgent = request.agent(app);
    const loginRes = await originalAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: ORIGINAL_NAME });
    assert.equal(loginRes.status, 200, `original player login failed: ${JSON.stringify(loginRes.body)}`);
    originalPlayerId = loginRes.body.id;

    const joinRes = await originalAgent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `original player join failed: ${JSON.stringify(joinRes.body)}`);

    // Obtain a second identity and room-code grant before the kick without
    // joining. The kick must revoke this dormant grant as well.
    preAuthorizedAgent = request.agent(app);
    const preAuthorizedLogin = await preAuthorizedAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: PREAUTHORIZED_NAME });
    assert.equal(
      preAuthorizedLogin.status,
      200,
      `pre-authorized login failed: ${JSON.stringify(preAuthorizedLogin.body)}`,
    );

    // Admin kicks the original player.
    adminAgent2 = request.agent(app);
    const sessionRes = await adminAgent2.post("/api/test-set-admin-session");
    assert.equal(sessionRes.status, 200, "test admin session setup failed");

    const kickRes = await adminAgent2.delete(
      `/api/games/${game.id}/participants/${originalPlayerId}`,
    );
    assert.equal(kickRes.status, 200, `kick failed: ${JSON.stringify(kickRes.body)}`);
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("rejects a fresh login using the revoked code and a different display name", async () => {
    const freshPlayerAgent = request.agent(app);
    const freshLoginRes = await freshPlayerAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: DIFFERENT_NAME });

    assert.equal(
      freshLoginRes.status,
      403,
      `expected 403 for revoked room code but got ${freshLoginRes.status}: ${JSON.stringify(freshLoginRes.body)}`,
    );
  });

  it("does not let an existing session recreate a grant with the revoked code", async () => {
    const reloginRes = await preAuthorizedAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE });
    assert.equal(
      reloginRes.status,
      403,
      `expected 403 for existing-session revoked login but got ${reloginRes.status}: ${JSON.stringify(reloginRes.body)}`,
    );
  });

  it("does not reopen admissions when the host resubmits the unchanged code", async () => {
    const unchangedRes = await adminAgent2
      .patch(`/api/games/${game.id}`)
      .send({ accessCode: ACCESS_CODE });
    assert.equal(unchangedRes.status, 200);

    const freshAgent = request.agent(app);
    const loginRes = await freshAgent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: "__test__kick_unchanged_code" });
    assert.equal(loginRes.status, 403, `unchanged code reopened admissions: ${JSON.stringify(loginRes.body)}`);
  });

  it("keeps the pre-kick alternate session blocked after the host rotates the code", async () => {
    // Hold the same game-row lock used by kick, start the PATCH while it is
    // blocked, then make the removal newer before releasing the lock. The
    // rotation timestamp must be generated only after PATCH acquires the lock.
    const blocker = await pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM games WHERE id = $1 FOR UPDATE", [game.id]);

      const rotatePromise = adminAgent2
        .patch(`/api/games/${game.id}`)
        .send({ accessCode: ROTATED_CODE })
        .then((response) => response);

      await new Promise((resolve) => setTimeout(resolve, 25));
      await blocker.query(
        "UPDATE removed_participants SET removed_at = clock_timestamp() WHERE game_id = $1",
        [game.id],
      );
      await blocker.query("COMMIT");

      const rotateRes = await rotatePromise;
      assert.equal(rotateRes.status, 200, `code rotation failed: ${JSON.stringify(rotateRes.body)}`);
    } catch (error) {
      await blocker.query("ROLLBACK");
      throw error;
    } finally {
      blocker.release();
    }

    const joinRes = await preAuthorizedAgent.post(`/api/games/${game.id}/join`);
    assert.equal(
      joinRes.status,
      403,
      `expected 403 for revoked pre-kick grant but got ${joinRes.status}: ${JSON.stringify(joinRes.body)}`,
    );
  });

  it("does not let a kicked player bypass moderation with a rotated code and new identity", async () => {
    const newPlayerAgent = request.agent(app);
    const loginRes = await newPlayerAgent
      .post("/api/auth/login")
      .send({ code: ROTATED_CODE, name: "__test__kick_after_rotation" });
    assert.equal(
      loginRes.status,
      403,
      `rotated code bypassed the moderation ban: ${JSON.stringify(loginRes.body)}`,
    );
  });
});

describe("room-code revocation — legacy mixed-case code", () => {
  let game: TestGame;
  let playerId: number;
  const STORED_CODE = "TkLegacy";
  const VERIFY_IP = `2001:db8::${crypto.randomBytes(4).toString("hex")}`;

  before(async () => {
    ({ game } = await seedGameWithQuestions(STORED_CODE, 1));
    const playerAgent = request.agent(app);
    const loginRes = await playerAgent
      .post("/api/auth/login")
      .send({ code: STORED_CODE.toLowerCase(), name: "__test__legacy_case_original" });
    assert.equal(loginRes.status, 200, `legacy login failed: ${JSON.stringify(loginRes.body)}`);
    playerId = loginRes.body.id;
    assert.equal((await playerAgent.post(`/api/games/${game.id}/join`)).status, 201);

    const adminAgent = request.agent(app);
    assert.equal((await adminAgent.post("/api/test-set-admin-session")).status, 200);
    assert.equal(
      (await adminAgent.delete(`/api/games/${game.id}/participants/${playerId}`)).status,
      200,
    );
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("blocks the revoked legacy code regardless of input case", async () => {
    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .set("X-Forwarded-For", VERIFY_IP)
      .send({ code: STORED_CODE.toUpperCase() });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.valid, false);

    const freshAgent = request.agent(app);
    const loginRes = await freshAgent
      .post("/api/auth/login")
      .send({ code: STORED_CODE.toUpperCase(), name: "__test__legacy_case_different" });
    assert.equal(loginRes.status, 403, `expected mixed-case code revocation: ${JSON.stringify(loginRes.body)}`);
  });
});

describe("legacy case-folded room-code collisions", () => {
  let firstGame: TestGame;
  let secondGame: TestGame;
  const FIRST_CODE = "TCaseCollision";
  const SECOND_CODE = "TCASECOLLISION";
  const VERIFY_IP = `2001:db8::${crypto.randomBytes(4).toString("hex")}`;

  before(async () => {
    ({ game: firstGame } = await seedGameWithQuestions(FIRST_CODE, 1));
    ({ game: secondGame } = await seedGameWithQuestions(SECOND_CODE, 1));
  });

  after(async () => {
    await cleanupGame(firstGame.id);
    await cleanupGame(secondGame.id);
  });

  it("fails closed instead of authorizing an arbitrary matching game", async () => {
    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .set("X-Forwarded-For", VERIFY_IP)
      .send({ code: SECOND_CODE.toLowerCase() });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.valid, false);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ code: SECOND_CODE.toLowerCase(), name: "__test__case_collision" });
    assert.equal(loginRes.status, 401);
  });
});

// ─── Short-response grading through the player answer route ──────────────────

describe("POST /api/games/:gameId/answers — short-response grading", () => {
  let game: TestGame;
  let question: TestQuestion;
  const ACCESS_CODE = "TSHORT1";
  const REVIEWER_EMAIL = "short-response-reviewer@example.invalid";

  before(async () => {
    ({ game, question } = await seedGameWithShortResponseQuestion(ACCESS_CODE));
  });

  after(async () => {
    await cleanupGame(game.id);
    await pool.query("DELETE FROM admin_accounts WHERE email = $1", [REVIEWER_EMAIL]);
  });

  it("awards the question's points for a normalized exact short response", async () => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: "__test__short_response_correct" });
    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);

    const joinRes = await agent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `join failed: ${JSON.stringify(joinRes.body)}`);

    const answerRes = await agent
      .post(`/api/games/${game.id}/answers`)
      .send({ questionId: question.id, userAnswer: "  titan.  " });

    assert.equal(answerRes.status, 201, `answer failed: ${JSON.stringify(answerRes.body)}`);
    assert.equal(answerRes.body.isCorrect, true);
    assert.equal(answerRes.body.pointsEarned, 13);
    assert.equal(answerRes.body.totalScore, 13);
  });

  it("awards zero for an unrelated short response", async () => {
    const previousApiKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      const agent = request.agent(app);
      const loginRes = await agent
        .post("/api/auth/login")
        .send({ code: ACCESS_CODE, name: "__test__short_response_unrelated" });
      assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);

      const joinRes = await agent.post(`/api/games/${game.id}/join`);
      assert.equal(joinRes.status, 201, `join failed: ${JSON.stringify(joinRes.body)}`);

      const answerRes = await agent
        .post(`/api/games/${game.id}/answers`)
        .send({ questionId: question.id, userAnswer: "The Pacific Ocean" });

      assert.equal(answerRes.status, 201, `answer failed: ${JSON.stringify(answerRes.body)}`);
      assert.equal(answerRes.body.isCorrect, false);
      assert.equal(answerRes.body.pointsEarned, 0);
      assert.equal(answerRes.body.totalScore, 0);
      assert.equal(answerRes.body.gradingStatus, "needs_review");

      const playerId = loginRes.body.id as number;
      const account = await pool.query<{ id: number }>(
        `INSERT INTO admin_accounts (email, email_verified)
         VALUES ($1, TRUE)
         RETURNING id`,
        [REVIEWER_EMAIL],
      );
      const adminId = account.rows[0]!.id;
      await pool.query("UPDATE games SET owner_admin_id = $1 WHERE id = $2", [adminId, game.id]);
      const token = generateTestAdminToken(adminId);

      const pending = await request(app)
        .get(`/api/games/${game.id}/answers/pending-review`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(pending.status, 200, `pending list failed: ${JSON.stringify(pending.body)}`);
      assert.equal(pending.body.length, 1);
      assert.equal(pending.body[0].id, answerRes.body.id);
      assert.equal(pending.body[0].rubric, "Award full credit only for Titan, Saturn's largest moon.");

      const review = await request(app)
        .post(`/api/games/${game.id}/answers/${answerRes.body.id}/review`)
        .set("Authorization", `Bearer ${token}`)
        .send({ award: true });
      assert.equal(review.status, 201, `review failed: ${JSON.stringify(review.body)}`);
      assert.equal(review.body.isCorrect, true);
      assert.equal(review.body.pointsEarned, 13);
      assert.equal(review.body.gradingStatus, "reviewed");

      const duplicateReview = await request(app)
        .post(`/api/games/${game.id}/answers/${answerRes.body.id}/review`)
        .set("Authorization", `Bearer ${token}`)
        .send({ award: false });
      assert.equal(duplicateReview.status, 200);
      assert.equal(duplicateReview.body.alreadyReviewed, true);
      assert.equal(duplicateReview.body.pointsEarned, 13);

      const score = await pool.query<{ total_score: number }>(
        "SELECT total_score FROM game_participants WHERE game_id = $1 AND user_id = $2",
        [game.id, playerId],
      );
      assert.equal(score.rows[0]!.total_score, 13);
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = previousApiKey;
      }
    }
  });

  it("stores and scores only one concurrent answer submission", async () => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ code: ACCESS_CODE, name: "__test__short_response_concurrent" });
    assert.equal(loginRes.status, 200, `login failed: ${JSON.stringify(loginRes.body)}`);
    const cookie = loginRes.headers["set-cookie"];
    assert.ok(cookie, "login must return a session cookie");

    const joinRes = await agent.post(`/api/games/${game.id}/join`);
    assert.equal(joinRes.status, 201, `join failed: ${JSON.stringify(joinRes.body)}`);

    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post(`/api/games/${game.id}/answers`)
          .set("Cookie", cookie)
          .send({ questionId: question.id, userAnswer: "Titan" }),
      ),
    );
    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 11);

    const answerCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM answers
       WHERE game_id = $1 AND user_id = $2 AND question_id = $3`,
      [game.id, loginRes.body.id, question.id],
    );
    assert.equal(Number(answerCount.rows[0]!.count), 1);

    const participant = await pool.query<{ total_score: number }>(
      `SELECT total_score FROM game_participants
       WHERE game_id = $1 AND user_id = $2`,
      [game.id, loginRes.body.id],
    );
    assert.equal(participant.rows[0]!.total_score, 13);
  });
});

describe("POST /api/games/:gameId/host-answer — concurrency", () => {
  let game: TestGame;
  let question: TestQuestion;
  let hostUserId: number;
  let adminCookie: string | string[];
  const HOST_NAME = "__test__host_answer_concurrent";

  before(async () => {
    const host = await pool.query<{ id: number }>(
      "INSERT INTO users (name) VALUES ($1) RETURNING id",
      [HOST_NAME],
    );
    hostUserId = host.rows[0]!.id;

    const gameRes = await pool.query<{ id: number }>(
      `INSERT INTO games (
         topic, difficulty, question_count, status, access_code,
         created_by_admin, host_plays_along, host_user_id
       )
       VALUES ($1, 'easy', 1, 'active', $2, TRUE, TRUE, $3)
       RETURNING id`,
      ["Concurrent host answer", "THOSTC", hostUserId],
    );
    game = { id: gameRes.rows[0]!.id, accessCode: "THOSTC" };

    const questionRes = await pool.query<{ id: number }>(
      `INSERT INTO questions (
         game_id, question_text, question_type, correct_answer, points, order_index
       )
       VALUES ($1, 'Host concurrency?', 'true_false', 'true', 17, 0)
       RETURNING id`,
      [game.id],
    );
    question = { id: questionRes.rows[0]!.id };
    await pool.query(
      "UPDATE games SET current_question_id = $1 WHERE id = $2",
      [question.id, game.id],
    );
    await pool.query(
      "INSERT INTO game_participants (game_id, user_id) VALUES ($1, $2)",
      [game.id, hostUserId],
    );

    const sessionRes = await request(app).post("/api/test-set-admin-session");
    assert.equal(sessionRes.status, 200, "test admin session setup failed");
    const cookie = sessionRes.headers["set-cookie"];
    assert.ok(cookie, "admin session setup must return a cookie");
    adminCookie = cookie;
  });

  after(async () => {
    await cleanupGame(game.id);
  });

  it("stores and scores only one concurrent host answer", async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post(`/api/games/${game.id}/host-answer`)
          .set("Cookie", adminCookie)
          .send({ questionId: question.id, userAnswer: "true" }),
      ),
    );
    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 9);

    const answers = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM answers
       WHERE game_id = $1 AND user_id = $2 AND question_id = $3`,
      [game.id, hostUserId, question.id],
    );
    assert.equal(Number(answers.rows[0]!.count), 1);

    const participant = await pool.query<{ total_score: number }>(
      `SELECT total_score FROM game_participants
       WHERE game_id = $1 AND user_id = $2`,
      [game.id, hostUserId],
    );
    assert.equal(participant.rows[0]!.total_score, 17);
  });
});

// ── Teardown ─────────────────────────────────────────────────────────────────

after(async () => {
  await pool.end();
});
