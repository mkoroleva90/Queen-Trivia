/**
 * Integration coverage for answer confidentiality during active games.
 *
 * Run with:
 *   node --experimental-strip-types --test src/routes/answerConfidentiality.test.ts
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
  throw new Error("DATABASE_URL must be set to run answerConfidentiality.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

(router as IRouter).post("/test-set-confidentiality-admin-session", (req, res): void => {
  req.session.isAdmin = true;
  req.session.save(() => res.json({ ok: true }));
});

describe("POST /api/games/:gameId/answers — active-game answer confidentiality", () => {
  let gameId: number;
  let sliderQuestionId: number;
  let hotspotQuestionId: number;
  let accessCode: string;

  before(async () => {
    accessCode = `Q${String(Date.now()).slice(-5)}`;
    const game = await pool.query<{ id: number }>(
      `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin)
       VALUES ('Confidentiality test', 'easy', 2, 'active', $1, true)
       RETURNING id`,
      [accessCode],
    );
    gameId = game.rows[0]!.id;

    const questions = await pool.query<{ id: number }>(
      `INSERT INTO questions
         (game_id, question_text, question_type, correct_answer, points, order_index)
       VALUES
         ($1, 'What year?', 'slider', '1985', 10, 0),
         ($1, 'Where?', 'image_hotspot', '50,50', 10, 1)
       RETURNING id`,
      [gameId],
    );
    sliderQuestionId = questions.rows[0]!.id;
    hotspotQuestionId = questions.rows[1]!.id;
    await pool.query(
      "UPDATE games SET current_question_id = $1 WHERE id = $2",
      [sliderQuestionId, gameId],
    );
  });

  after(async () => {
    await pool.query("DELETE FROM games WHERE id = $1", [gameId]);
    await pool.query("DELETE FROM users WHERE name LIKE '__test__answer_confidentiality%'");
    await pool.end();
  });

  it("does not reveal slider or hotspot correct answers after submission", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ code: accessCode, name: "__test__answer_confidentiality" });
    assert.equal(login.status, 200, JSON.stringify(login.body));

    const join = await agent.post(`/api/games/${gameId}/join`);
    assert.equal(join.status, 201, JSON.stringify(join.body));

    for (const [questionId, submittedAnswer, correctAnswer] of [
      [sliderQuestionId, "0", "1985"],
      [hotspotQuestionId, "0,0", "50,50"],
    ] as const) {
      await pool.query(
        "UPDATE games SET current_question_id = $1 WHERE id = $2",
        [questionId, gameId],
      );
      const response = await agent
        .post(`/api/games/${gameId}/answers`)
        .send({ questionId, userAnswer: submittedAnswer });

      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.correctAnswer, undefined);
      assert.equal(
        JSON.stringify(response.body).includes(correctAnswer),
        false,
        "active-game answer response must not disclose the correct answer",
      );
    }
  });

  it("does not expose active-game correctness or score oracles to players", async () => {
    const code = `I${String(Date.now()).slice(-5)}`;
    const firstName = `__test__integrity_first_${Date.now()}`;
    const probeName = `__test__integrity_probe_${Date.now()}`;
    const unjoinedName = `__test__integrity_unjoined_${Date.now()}`;
    let integrityGameId: number | undefined;
    try {
      const game = await pool.query<{ id: number }>(
        `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin)
         VALUES ('Integrity oracle test', 'easy', 1, 'active', $1, true)
         RETURNING id`,
        [code],
      );
      integrityGameId = game.rows[0]!.id;
      const question = await pool.query<{ id: number }>(
        `INSERT INTO questions
           (game_id, question_text, question_type, correct_answer, points, order_index)
         VALUES ($1, 'True?', 'true_false', 'true', 10, 0)
         RETURNING id`,
        [integrityGameId],
      );
      const integrityQuestionId = question.rows[0]!.id;
      await pool.query(
        "UPDATE games SET current_question_id = $1 WHERE id = $2",
        [integrityQuestionId, integrityGameId],
      );

      const unauthenticatedStats = await request(app).get(
        `/api/games/${integrityGameId}/questions/${integrityQuestionId}/answers`,
      );
      assert.equal(unauthenticatedStats.status, 401);
      const unauthenticatedResults = await request(app).get(`/api/games/${integrityGameId}/results`);
      assert.equal(unauthenticatedResults.status, 401);

      const firstPlayer = request.agent(app);
      const probePlayer = request.agent(app);
      const unjoinedPlayer = request.agent(app);
      assert.equal((await firstPlayer.post("/api/auth/login").send({ code, name: firstName })).status, 200);
      assert.equal((await firstPlayer.post(`/api/games/${integrityGameId}/join`)).status, 201);
      assert.equal((await probePlayer.post("/api/auth/login").send({ code, name: probeName })).status, 200);
      assert.equal((await probePlayer.post(`/api/games/${integrityGameId}/join`)).status, 201);
      assert.equal(
        (await unjoinedPlayer.post("/api/auth/login").send({ code, name: unjoinedName })).status,
        200,
      );
      assert.equal(
        (await unjoinedPlayer.get(
          `/api/games/${integrityGameId}/questions/${integrityQuestionId}/answers`,
        )).status,
        403,
      );
      assert.equal(
        (await unjoinedPlayer.get(`/api/games/${integrityGameId}/results`)).status,
        403,
      );

      assert.equal(
        (await firstPlayer
          .post(`/api/games/${integrityGameId}/answers`)
          .send({ questionId: integrityQuestionId, userAnswer: "false" })).status,
        201,
      );
      assert.equal(
        (await probePlayer
          .post(`/api/games/${integrityGameId}/answers`)
          .send({ questionId: integrityQuestionId, userAnswer: "true" })).status,
        201,
      );

      const activeStats = await firstPlayer.get(
        `/api/games/${integrityGameId}/questions/${integrityQuestionId}/answers`,
      );
      assert.equal(activeStats.status, 409, JSON.stringify(activeStats.body));
      assert.equal(activeStats.body.correctCount, undefined);
      assert.equal(activeStats.body.totalAnswered, undefined);

      const activeResults = await firstPlayer.get(`/api/games/${integrityGameId}/results`);
      assert.equal(activeResults.status, 409, JSON.stringify(activeResults.body));
      assert.equal(activeResults.body.participants, undefined);

      const activeParticipants = await firstPlayer.get(`/api/games/${integrityGameId}/participants`);
      assert.equal(activeParticipants.status, 200, JSON.stringify(activeParticipants.body));
      assert.equal(activeParticipants.body[0].userName, firstName, "player ordering must not reveal live scores");
      assert.equal(activeParticipants.body[1].userName, probeName);
      assert.ok(
        activeParticipants.body.every((participant: Record<string, unknown>) => participant.totalScore === undefined),
        "active player participant data must omit every score",
      );

      const admin = request.agent(app);
      assert.equal((await admin.post("/api/test-set-confidentiality-admin-session")).status, 200);
      const hostStats = await admin.get(
        `/api/games/${integrityGameId}/questions/${integrityQuestionId}/answers`,
      );
      assert.equal(hostStats.status, 200, JSON.stringify(hostStats.body));
      assert.deepEqual(hostStats.body, { totalAnswered: 2, correctCount: 1 });
      const hostParticipants = await admin.get(`/api/games/${integrityGameId}/participants`);
      assert.equal(hostParticipants.status, 200, JSON.stringify(hostParticipants.body));
      assert.equal(hostParticipants.body[0].userName, probeName);
      assert.equal(hostParticipants.body[0].totalScore, 10);

      await pool.query("UPDATE games SET status = 'completed' WHERE id = $1", [integrityGameId]);

      const completedStats = await firstPlayer.get(
        `/api/games/${integrityGameId}/questions/${integrityQuestionId}/answers`,
      );
      assert.equal(completedStats.status, 200, JSON.stringify(completedStats.body));
      assert.deepEqual(completedStats.body, { totalAnswered: 2, correctCount: 1 });
      const completedResults = await firstPlayer.get(`/api/games/${integrityGameId}/results`);
      assert.equal(completedResults.status, 200, JSON.stringify(completedResults.body));
      assert.equal(completedResults.body.participants[0].correctCount, 1);
      const completedParticipants = await firstPlayer.get(`/api/games/${integrityGameId}/participants`);
      assert.equal(completedParticipants.status, 200, JSON.stringify(completedParticipants.body));
      assert.equal(completedParticipants.body[0].totalScore, 10);
    } finally {
      if (integrityGameId) await pool.query("DELETE FROM games WHERE id = $1", [integrityGameId]);
      await pool.query(
        "DELETE FROM users WHERE name = ANY($1::text[])",
        [[firstName, probeName, unjoinedName]],
      );
    }
  });

  it("releases only the current question, without matching or ordering solutions", async () => {
    const code = `R${String(Date.now()).slice(-5)}`;
    let redactionGameId: number | undefined;
    let playerName: string | undefined;
    try {
      const game = await pool.query<{ id: number }>(
        `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin)
         VALUES ('Question redaction test', 'easy', 2, 'active', $1, true)
         RETURNING id`,
        [code],
      );
      redactionGameId = game.rows[0]!.id;
      const questions = await pool.query<{ id: number }>(
        `INSERT INTO questions
          (game_id, question_text, question_type, correct_answer, options, points, order_index)
         VALUES
          ($1, 'Match them', 'matching', 'A:1|B:2|C:3', $2::jsonb, 10, 0),
          ($1, 'Put in order', 'ordering', 'first|second|third', $3::jsonb, 10, 1)
         RETURNING id`,
        [
          redactionGameId,
          JSON.stringify({ pairs: [
            { left: "A", right: "1" },
            { left: "B", right: "2" },
            { left: "C", right: "3" },
          ] }),
          JSON.stringify({ items: ["first", "second", "third"] }),
        ],
      );
      const matchingId = questions.rows[0]!.id;
      const orderingId = questions.rows[1]!.id;
      await pool.query(
        "UPDATE games SET current_question_id = $1 WHERE id = $2",
        [matchingId, redactionGameId],
      );

      playerName = `__test__question_redaction_${Date.now()}`;
      const agent = request.agent(app);
      assert.equal((await agent.post("/api/auth/login").send({ code, name: playerName })).status, 200);
      assert.equal((await agent.post(`/api/games/${redactionGameId}/join`)).status, 201);

      const released = await agent.get(`/api/games/${redactionGameId}/questions`);
      assert.equal(released.status, 200, JSON.stringify(released.body));
      assert.equal(released.body.length, 1, "future questions must not be listed");
      assert.equal(released.body[0].id, matchingId);
      assert.equal(released.body[0].correctAnswer, undefined);
      assert.equal(released.body[0].options.pairs, undefined);
      assert.deepEqual([...released.body[0].options.leftItems].sort(), ["A", "B", "C"]);
      assert.deepEqual([...released.body[0].options.rightItems].sort(), ["1", "2", "3"]);
      const repeated = await agent.get(`/api/games/${redactionGameId}/questions`);
      assert.deepEqual(
        repeated.body[0].options,
        released.body[0].options,
        "repeated reads must not expose alternate arrangements to aggregate",
      );

      const earlyAnswer = await agent
        .post(`/api/games/${redactionGameId}/answers`)
        .send({ questionId: orderingId, userAnswer: "first|second|third" });
      assert.equal(earlyAnswer.status, 409, JSON.stringify(earlyAnswer.body));

      await pool.query(
        "UPDATE games SET current_question_id = $1 WHERE id = $2",
        [orderingId, redactionGameId],
      );
      const ordering = await agent.get(`/api/games/${redactionGameId}/questions`);
      assert.equal(ordering.body[0].correctAnswer, undefined);
      assert.notDeepEqual(ordering.body[0].options.items, ["first", "second", "third"]);
    } finally {
      if (redactionGameId) await pool.query("DELETE FROM games WHERE id = $1", [redactionGameId]);
      if (playerName) await pool.query("DELETE FROM users WHERE name = $1", [playerName]);
    }
  });

  it("rejects host play-along answers for an unreleased question", async () => {
    let hostUserId: number | undefined;
    let hostGameId: number | undefined;
    try {
      const host = await pool.query<{ id: number }>(
        "INSERT INTO users (name) VALUES ($1) RETURNING id",
        [`__test__host_release_${Date.now()}`],
      );
      hostUserId = host.rows[0]!.id;
      const game = await pool.query<{ id: number }>(
        `INSERT INTO games (topic, difficulty, question_count, status, access_code, created_by_admin, host_plays_along, host_user_id)
         VALUES ('Host release test', 'easy', 2, 'active', $1, true, true, $2)
         RETURNING id`,
        [`H${String(Date.now()).slice(-5)}`, hostUserId],
      );
      hostGameId = game.rows[0]!.id;
      const questions = await pool.query<{ id: number }>(
        `INSERT INTO questions (game_id, question_text, question_type, correct_answer, points, order_index)
         VALUES ($1, 'First?', 'true_false', 'true', 10, 0),
                ($1, 'Second?', 'true_false', 'true', 10, 1)
         RETURNING id`,
        [hostGameId],
      );
      await pool.query(
        "UPDATE games SET current_question_id = $1 WHERE id = $2",
        [questions.rows[0]!.id, hostGameId],
      );
      await pool.query(
        "INSERT INTO game_participants (game_id, user_id) VALUES ($1, $2)",
        [hostGameId, hostUserId],
      );

      const admin = request.agent(app);
      assert.equal((await admin.post("/api/test-set-confidentiality-admin-session")).status, 200);
      const response = await admin
        .post(`/api/games/${hostGameId}/host-answer`)
        .send({ questionId: questions.rows[1]!.id, userAnswer: "true" });
      assert.equal(response.status, 409, JSON.stringify(response.body));

      const advanced = await admin.post(`/api/games/${hostGameId}/advance-question`);
      assert.equal(advanced.status, 200, JSON.stringify(advanced.body));
      assert.equal(advanced.body.currentQuestionId, questions.rows[1]!.id);

      const releasedAnswer = await admin
        .post(`/api/games/${hostGameId}/host-answer`)
        .send({ questionId: questions.rows[1]!.id, userAnswer: "true" });
      assert.equal(releasedAnswer.status, 201, JSON.stringify(releasedAnswer.body));
    } finally {
      if (hostGameId) await pool.query("DELETE FROM games WHERE id = $1", [hostGameId]);
      if (hostUserId) await pool.query("DELETE FROM users WHERE id = $1", [hostUserId]);
    }
  });
});