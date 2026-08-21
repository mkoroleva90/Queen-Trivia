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

process.env.SESSION_SECRET = "test-secret-for-unit-tests-32chars!!";

const { default: app } = await import("../../dist/app.mjs") as {
  default: import("express").Express;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run answerConfidentiality.test.ts");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
});