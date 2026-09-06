
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import {
 db,
 gamesTable,
 usersTable,
 questionsTable,
 answersTable,
 gameParticipantsTable,
  gameAccessGrantsTable,
 removedParticipantsTable,
} from "@workspace/db";
import { safeEmit } from "../lib/socket.ts";
import { requireUser } from "../middleware/requireUser.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { decodeHtml } from "../lib/decodeHtml.ts";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";
const answerRateLimit = rateLimit({
    windowMs: 60_000,
    max: 30,
    message: { error: "Too many answer submissions. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
});
import {
    JoinGameParams,
    JoinGameResponse,
    ListGameParticipantsParams,
    ListGameParticipantsResponse,
    SubmitAnswerParams,
    SubmitAnswerBody,
    SubmitAnswerResponse,
    ListUserAnswersParams,
    ListUserAnswersResponse,
} from "@workspace/api-zod";
import { toJsonSafe } from "../lib/serialize.ts";
import { gradeAnswer } from "../lib/grading.ts";


const router: IRouter = Router();


// ─── Join game ─────────────────────────────────────────────────────────────


router.post("/games/:gameId/join", requireUser, async (req, res): Promise<void> => {
    const params = JoinGameParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }

    const sessionUserId = req.session.userId!;
    const outcome = await db.transaction(async (tx) => {
        // Serialize join with kick and room-code login/rotation. Whichever
        // operation locks the game first commits a complete authorization
        // decision before the next one proceeds.
        const [game] = await tx
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, params.data.gameId))
            .for("update");
        if (!game) return { kind: "missing-game" as const };

        const [user] = await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, sessionUserId));
        if (!user) return { kind: "missing-user" as const };

        const [existing] = await tx
            .select()
            .from(gameParticipantsTable)
            .where(and(
                eq(gameParticipantsTable.gameId, game.id),
                eq(gameParticipantsTable.userId, user.id),
            ));
        if (existing) return { kind: "joined" as const, participant: existing };

        const [grant] = await tx
            .select({ id: gameAccessGrantsTable.id })
            .from(gameAccessGrantsTable)
            .where(and(
                eq(gameAccessGrantsTable.gameId, game.id),
                eq(gameAccessGrantsTable.userId, user.id),
            ))
            .limit(1);
        if (!grant) return { kind: "missing-grant" as const };

        const [removal] = await tx
            .select({ id: removedParticipantsTable.id })
            .from(removedParticipantsTable)
            .where(eq(removedParticipantsTable.gameId, game.id))
            .limit(1);
        if (removal) return { kind: "removed" as const };

        const [removedByIdentity] = await tx
            .select({ id: removedParticipantsTable.id })
            .from(removedParticipantsTable)
            .where(and(
                eq(removedParticipantsTable.gameId, game.id),
                or(
                    eq(removedParticipantsTable.userId, user.id),
                    sql`lower(${removedParticipantsTable.displayName}) = lower(${user.name})`,
                ),
            ))
            .limit(1);
        if (removedByIdentity) return { kind: "removed" as const };

        const [participant] = await tx
            .insert(gameParticipantsTable)
            .values({ gameId: game.id, userId: user.id })
            .returning();
        return { kind: "joined" as const, participant: participant! };
    });

    if (outcome.kind === "missing-game") {
        res.status(404).json({ error: "Game not found" });
        return;
    }
    if (outcome.kind === "missing-user") {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (outcome.kind === "missing-grant") {
        res.status(403).json({ error: "Enter this game's access code before joining" });
        return;
    }
    if (outcome.kind === "removed") {
        res.status(403).json({ error: COPY.kick.rejoinBlocked });
        return;
    }

    res.status(201).json(JoinGameResponse.parse(toJsonSafe(outcome.participant)));
});


// ─── List participants ──────────────────────────────────────────────────────


router.get("/games/:gameId/participants", requireAuth, async (req, res): Promise<void> => {
 const params = ListGameParticipantsParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

 const [game] = await db
     .select({ status: gamesTable.status })
     .from(gamesTable)
     .where(eq(gamesTable.id, params.data.gameId))
     .limit(1);
 if (!game) {
     res.status(404).json({ error: "Game not found" });
     return;
 }

 const scoresVisible = req.session.isAdmin === true || game.status === "completed";
 const participantQuery = db
     .select({
         id: gameParticipantsTable.id,
         gameId: gameParticipantsTable.gameId,
         userId: gameParticipantsTable.userId,
         userName: usersTable.name,
         totalScore: gameParticipantsTable.totalScore,
         joinedAt: gameParticipantsTable.joinedAt,
     })
     .from(gameParticipantsTable)
     .innerJoin(usersTable, eq(gameParticipantsTable.userId, usersTable.id))
     .where(eq(gameParticipantsTable.gameId, params.data.gameId));
 const participantRows = scoresVisible
     ? await participantQuery.orderBy(
         desc(gameParticipantsTable.totalScore),
         asc(gameParticipantsTable.joinedAt),
     )
     : await participantQuery.orderBy(asc(gameParticipantsTable.joinedAt));

 const seenUsers = new Set<number>();
 const rows = participantRows
     .filter((row) => {
         if (seenUsers.has(row.userId)) return false;
         seenUsers.add(row.userId);
         return true;
     })
     .map((row) => {
         if (scoresVisible) return row;
         const { totalScore: _totalScore, ...safeRow } = row;
         return safeRow;
     });

 res.json(ListGameParticipantsResponse.parse(toJsonSafe(rows)));
});


// ─── Submit answer ──────────────────────────────────────────────────────────


router.post("/games/:gameId/answers", requireUser, answerRateLimit, async (req, res):Promise<void> => {
        const params = SubmitAnswerParams.safeParse(req.params);
        if (!params.success) {
            res.status(400).json({ error: params.error.message });
            return;
        }

        const parsed = SubmitAnswerBody.safeParse(req.body);
if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
}


const sessionUserId = req.session.userId!;


        const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, params.data.gameId));


if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
}

if (game.status !== "active") {
    res.status(403).json({ error: "Answers can only be submitted to an active game" });
    return;
}

const [participant] = await db
    .select()
    .from(gameParticipantsTable)
    .where(
        and(
            eq(gameParticipantsTable.gameId, game.id),
            eq(gameParticipantsTable.userId, sessionUserId),
        ),
    );

if (!participant) {
    res.status(403).json({ error: "You must join the game before submitting answers" });
    return;
}

const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, parsed.data.questionId));


if (!question || question.gameId !== params.data.gameId) {
    res.status(404).json({ error: "Question not found in this game" });
    return;
}

// Release gating: the host releases questions in orderIndex order, so the
// released question and every earlier one are open; later ones stay locked.
const releasedId = game.currentQuestionId;
const [released] = releasedId == null
    ? []
    : await db
        .select({ orderIndex: questionsTable.orderIndex })
        .from(questionsTable)
        .where(eq(questionsTable.id, releasedId));

if (!released || question.orderIndex > released.orderIndex) {
    res.status(409).json({ error: "This question has not been released by the host" });
    return;
}


const [already] = await db
    .select()
    .from(answersTable)
    .where(
     and(
         eq(answersTable.userId, sessionUserId),
          eq(answersTable.gameId, game.id),
         eq(answersTable.questionId, question.id),
     ),
    );


// A recorded skip (blank answer) may be replaced once by a real answer. A real
// answer, or a blank on top of a blank, keeps the existing 409.
const skipToReplace = already && already.userAnswer === "" && parsed.data.userAnswer !== "" ? already : null;

if (already && !skipToReplace) {
    res.status(409).json({ error: "Question already answered" });
    return;
}

// Content filter: block slurs/hate speech in player-typed answers.
// Runs before grading and before any database write.
if (containsBannedContent(parsed.data.userAnswer)) {
    logFlaggedContent('player_answer');
    res.status(422).json({ error: COPY.contentFilter.playerAnswer, code: "content_filtered" });
    return;
}

        const opts = question.options as { alternateAnswers?: string[] } | null;
        const alternates = opts?.alternateAnswers ?? [];


// Empty userAnswer = explicit skip — record as zero without calling gradeAnswer.
// Mirrors the host-answer route: avoids a wasted AI call for short_response
// questions (and a spurious needs_review); the answer is still stored with
// isCorrect=false so the player cannot answer the question again.
let isCorrect: boolean;
let pointsEarned: number;
let feedback: string | undefined;
let needsReview = false;
if (parsed.data.userAnswer === "") {
    isCorrect = false;
    pointsEarned = 0;
} else {
    const grade = await gradeAnswer(
        question.questionType,
        parsed.data.userAnswer,
        decodeHtml(question.correctAnswer),
        question.points,
        alternates,
        question.options as Record<string, unknown> | null,
        decodeHtml(question.questionText),
    );
    isCorrect = grade.isCorrect;
    pointsEarned = grade.pointsEarned;
    feedback = grade.feedback;
    needsReview = grade.needsReview ?? false;
}


const result = await db.transaction(async (tx) => {
    const [answer] = skipToReplace
        // Replace the skip in place. The userAnswer = '' condition lets a
        // concurrent replacement win only once; the loser sees no row.
        ? await tx
            .update(answersTable)
            .set({
                userAnswer: parsed.data.userAnswer,
                isCorrect,
                pointsEarned,
                gradingStatus: needsReview ? "needs_review" : "graded",
            })
            .where(
                and(
                    eq(answersTable.id, skipToReplace.id),
                    eq(answersTable.userAnswer, ""),
                ),
            )
            .returning()
        : await tx
            .insert(answersTable)
            .values({
                userId: sessionUserId,
                gameId: question.gameId,
                questionId: question.id,
                userAnswer: parsed.data.userAnswer,
                isCorrect,
                pointsEarned,
                gradingStatus: needsReview ? "needs_review" : "graded",
            })
            .onConflictDoNothing({
                target: [
                    answersTable.userId,
                    answersTable.gameId,
                    answersTable.questionId,
                ],
            })
            .returning();

    if (!answer) return { kind: "duplicate" as const };

    const [updatedParticipant] = await tx
        .update(gameParticipantsTable)
        .set({
            // Increment in SQL so concurrent answers for different questions
            // cannot overwrite one another with stale totals.
            totalScore: sql`${gameParticipantsTable.totalScore} + ${pointsEarned}`,
        })
        .where(
            and(
                eq(gameParticipantsTable.id, participant.id),
                eq(gameParticipantsTable.gameId, game.id),
                eq(gameParticipantsTable.userId, sessionUserId),
            ),
        )
        .returning({ totalScore: gameParticipantsTable.totalScore });

    if (!updatedParticipant) {
        throw new Error("Participant disappeared while recording answer");
    }

    return {
        kind: "created" as const,
        answer,
        totalScore: updatedParticipant.totalScore,
    };
});

if (result.kind === "duplicate") {
    res.status(409).json({ error: "Question already answered" });
    return;
}

const { answer, totalScore } = result;


res.status(201).json(
 SubmitAnswerResponse.parse(
     toJsonSafe({
         ...answer,
         pointsEarned,
         totalScore,
          ...(feedback ? { feedback } : {}),
          ...(needsReview ? { gradingStatus: "needs_review" } : {}),
     }),
 ),
);


// Fire-and-forget: emit real-time event to game room
db.select({ name: usersTable.name })
 .from(usersTable)
  .where(eq(usersTable.id, sessionUserId))
  .then(([u]) => {
      if (!u) return;
      safeEmit(`game:${question.gameId}`, "answer:submitted", {
       gameId: question.gameId,
       questionId: question.id,
       playerName: u.name,
      });
       safeEmit(`game:host:${question.gameId}`, "answer:graded", {
        gameId: question.gameId,
        questionId: question.id,
        playerName: u.name,
        isCorrect,
       });
  })
  .catch(() => { /* non-critical */ });
});


// ─── Per-question answers (for feedback leaderboard) ───────────────────────


router.get(
 "/games/:gameId/questions/:questionId/answers",
 requireAuth,
 async (req, res): Promise<void> => {
  const gameId = parseInt(String(req.params.gameId ?? ""), 10);
  const questionId = parseInt(String(req.params.questionId ?? ""), 10);
  if (isNaN(gameId) || isNaN(questionId)) {
      res.status(400).json({ error: "Invalid params" });
      return;
  }
  // Admins: enforce game ownership. Players: must be a participant in the game.
  if (req.session.isAdmin) {
      if (!await assertGameOwnership(req, res, gameId)) return;
  } else {
      const [participant] = await db
          .select({ id: gameParticipantsTable.id })
          .from(gameParticipantsTable)
          .where(
              and(
                  eq(gameParticipantsTable.gameId, gameId),
                  eq(gameParticipantsTable.userId, req.session.userId!),
              ),
          );
      if (!participant) {
          res.status(403).json({ error: "Access denied" });
          return;
      }
  }

   const [game] = await db
       .select({ status: gamesTable.status })
       .from(gamesTable)
       .where(eq(gamesTable.id, gameId))
       .limit(1);
   if (!game) {
       res.status(404).json({ error: "Game not found" });
       return;
   }
   if (req.session.isAdmin !== true && game.status !== "completed") {
       res.status(409).json({ error: "Answer statistics are available after the game is completed" });
       return;
   }

   const [question] = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(
          and(
              eq(questionsTable.id, questionId),
              eq(questionsTable.gameId, gameId),
          ),
      );
  if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
  }

  const rows = await db
      .select({ isCorrect: answersTable.isCorrect })
      .from(answersTable)
      .where(
          and(
              eq(answersTable.gameId, gameId),
              eq(answersTable.questionId, questionId),
          ),
      );

  const totalAnswered = rows.length;
  const correctCount = rows.filter((r) => r.isCorrect).length;
  res.json({ totalAnswered, correctCount });
 },
);


// ─── List user answers ──────────────────────────────────────────────────────


router.get(
"/games/:gameId/users/:userId/answers",
requireUser,
async (req, res): Promise<void> => {
const params = ListUserAnswersParams.safeParse(req.params);
if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
}


if (req.session.userId !== params.data.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
}


const [game] = await db
    .select({ status: gamesTable.status })
    .from(gamesTable)
    .where(eq(gamesTable.id, params.data.gameId));

if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
}

const [participant] = await db
    .select({ id: gameParticipantsTable.id })
    .from(gameParticipantsTable)
    .where(
        and(
            eq(gameParticipantsTable.gameId, params.data.gameId),
            eq(gameParticipantsTable.userId, params.data.userId),
        ),
    )
    .limit(1);

if (!participant) {
    res.status(403).json({ error: "Access denied" });
    return;
}

const gameCompleted = game.status === "completed";
const rows = await db
.select({
    id: answersTable.id,
    userId: answersTable.userId,
    gameId: answersTable.gameId,
    questionId: answersTable.questionId,
    userAnswer: answersTable.userAnswer,
    isCorrect: answersTable.isCorrect,
    pointsEarned: answersTable.pointsEarned,
     gradingStatus: answersTable.gradingStatus,
    answeredAt: answersTable.answeredAt,
    correctAnswer: questionsTable.correctAnswer,
})
.from(answersTable)
.innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
.where(
    and(
     eq(answersTable.gameId, params.data.gameId),
     eq(answersTable.userId, params.data.userId),
    ),
)
.orderBy(asc(answersTable.answeredAt));


type AnswerRow = {
id: number; userId: number; gameId: number; questionId: number;
userAnswer: string; isCorrect: boolean; pointsEarned: number;
answeredAt: string; correctAnswer: string;
     };
     const safeRows = (toJsonSafe(rows) as AnswerRow[]).map((row) =>
      gameCompleted ? row : { ...row, correctAnswer: undefined },
     );


     res.json(ListUserAnswersResponse.parse(safeRows));
 },
);


// ─── Answers awaiting host review ────────────────────────────────────────────

router.get(
 "/games/:gameId/answers/pending-review",
 requireAdmin,
 async (req, res): Promise<void> => {
  const gameId = parseInt(String(req.params.gameId ?? ""), 10);
  if (isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }
  if (!await assertGameOwnership(req, res, gameId)) return;

  const rows = await db
   .select({
    id: answersTable.id,
    userId: answersTable.userId,
    gameId: answersTable.gameId,
    questionId: answersTable.questionId,
    userAnswer: answersTable.userAnswer,
    isCorrect: answersTable.isCorrect,
    pointsEarned: answersTable.pointsEarned,
    gradingStatus: answersTable.gradingStatus,
    answeredAt: answersTable.answeredAt,
    userName: usersTable.name,
    questionText: questionsTable.questionText,
    questionType: questionsTable.questionType,
    points: questionsTable.points,
    correctAnswer: questionsTable.correctAnswer,
    options: questionsTable.options,
   })
   .from(answersTable)
   .innerJoin(usersTable, eq(answersTable.userId, usersTable.id))
   .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
   .where(and(
    eq(answersTable.gameId, gameId),
    eq(answersTable.gradingStatus, "needs_review"),
   ))
   .orderBy(asc(answersTable.answeredAt));

  res.json(toJsonSafe(rows.map((row) => {
   const options = row.options as { rubric?: unknown; maxWords?: unknown } | null;
   return {
    ...row,
    rubric: typeof options?.rubric === "string" ? options.rubric : null,
    maxWords: typeof options?.maxWords === "number" ? options.maxWords : null,
   };
  })));
 },
);

router.post(
 "/games/:gameId/answers/:answerId/review",
 requireAdmin,
 async (req, res): Promise<void> => {
  const gameId = parseInt(String(req.params.gameId ?? ""), 10);
  const answerId = parseInt(String(req.params.answerId ?? ""), 10);
  if (isNaN(gameId) || isNaN(answerId)) { res.status(400).json({ error: "Invalid answer or game ID" }); return; }
  if (typeof req.body?.award !== "boolean") {
   res.status(400).json({ error: "award must be a boolean" });
   return;
  }
  if (!await assertGameOwnership(req, res, gameId)) return;

  const result = await db.transaction(async (tx) => {
   const [candidate] = await tx
    .select({
     id: answersTable.id,
     userId: answersTable.userId,
     gameId: answersTable.gameId,
     questionId: answersTable.questionId,
     userAnswer: answersTable.userAnswer,
     isCorrect: answersTable.isCorrect,
     pointsEarned: answersTable.pointsEarned,
     gradingStatus: answersTable.gradingStatus,
     answeredAt: answersTable.answeredAt,
     questionPoints: questionsTable.points,
    })
    .from(answersTable)
    .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
    .where(and(eq(answersTable.id, answerId), eq(answersTable.gameId, gameId)))
    .limit(1);

   if (!candidate) return { kind: "missing" as const };
   if (candidate.gradingStatus !== "needs_review") {
    return { kind: "already_reviewed" as const, answer: candidate };
   }

   const pointsEarned = req.body.award ? candidate.questionPoints : 0;
   const [reviewed] = await tx
    .update(answersTable)
    .set({
     isCorrect: req.body.award,
     pointsEarned,
     gradingStatus: "reviewed",
     reviewedAt: new Date(),
    })
    .where(and(
     eq(answersTable.id, answerId),
     eq(answersTable.gameId, gameId),
     eq(answersTable.gradingStatus, "needs_review"),
    ))
    .returning();

   // A concurrent host action won the conditional update. Return the stored
   // decision without changing the participant total a second time.
   if (!reviewed) {
    const [current] = await tx
     .select()
     .from(answersTable)
     .where(eq(answersTable.id, answerId))
     .limit(1);
    return { kind: "already_reviewed" as const, answer: current };
   }

   if (pointsEarned > 0) {
    await tx
     .update(gameParticipantsTable)
     .set({ totalScore: sql`${gameParticipantsTable.totalScore} + ${pointsEarned}` })
     .where(and(
      eq(gameParticipantsTable.gameId, gameId),
      eq(gameParticipantsTable.userId, reviewed.userId),
     ));
   }
   return { kind: "reviewed" as const, answer: reviewed };
  });

  if (result.kind === "missing") {
   res.status(404).json({ error: "Answer not found in this game" });
   return;
  }
  const answer = result.answer;
  res.status(result.kind === "already_reviewed" ? 200 : 201).json(toJsonSafe({
   ...answer,
   alreadyReviewed: result.kind === "already_reviewed",
  }));

  if (result.kind === "reviewed") {
   db.select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, answer.userId))
    .then(([u]) => {
     if (!u) return;
      safeEmit(`game:host:${gameId}`, "answer:reviewed", {
      gameId,
      questionId: answer.questionId,
      playerName: u.name,
      isCorrect: answer.isCorrect,
     });
    })
    .catch(() => {});
  }
 },
);


// ─── Host play-along answer submission ─────────────────────────────────────
// Admin-only endpoint: submits an answer on behalf of the host's player-user
// (game.hostUserId) so the host can play along from the live host screen
// without needing a separate player session.

router.post(
    "/games/:gameId/host-answer",
    requireAdmin,
    async (req, res): Promise<void> => {
        const params = SubmitAnswerParams.safeParse(req.params);
        if (!params.success) {
            res.status(400).json({ error: params.error.message });
            return;
        }

        const parsed = SubmitAnswerBody.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        if (!await assertGameOwnership(req, res, params.data.gameId)) return;

        const [game] = await db
            .select()
            .from(gamesTable)
            .where(eq(gamesTable.id, params.data.gameId));

        if (!game) {
            res.status(404).json({ error: "Game not found" });
            return;
        }
        if (!game.hostPlaysAlong || !game.hostUserId) {
            res.status(403).json({ error: "Play-along is not enabled for this game" });
            return;
        }
        if (game.status !== "active") {
            res.status(400).json({ error: "Answers can only be submitted to an active game" });
            return;
        }

        const hostUserId = game.hostUserId;

        const [participant] = await db
            .select()
            .from(gameParticipantsTable)
            .where(
                and(
                    eq(gameParticipantsTable.gameId, game.id),
                    eq(gameParticipantsTable.userId, hostUserId),
                ),
            );

        if (!participant) {
            res.status(403).json({ error: "Host is not registered as a participant" });
            return;
        }

        const [question] = await db
            .select()
            .from(questionsTable)
            .where(
                and(
                    eq(questionsTable.id, parsed.data.questionId),
                    eq(questionsTable.gameId, params.data.gameId),
                ),
            );

        if (!question) {
            res.status(404).json({ error: "Question not found in this game" });
            return;
        }
        // Release gating: the host releases questions in orderIndex order, so the
        // released question and every earlier one are open; later ones stay locked.
        const releasedId = game.currentQuestionId;
        const [released] = releasedId == null
            ? []
            : await db
                .select({ orderIndex: questionsTable.orderIndex })
                .from(questionsTable)
                .where(eq(questionsTable.id, releasedId));
        if (!released || question.orderIndex > released.orderIndex) {
            res.status(409).json({ error: "This question has not been released by the host" });
            return;
        }

        // Duplicate check — host may only answer each question once
        const [existing] = await db
            .select({ id: answersTable.id, userAnswer: answersTable.userAnswer })
            .from(answersTable)
            .where(
                and(
                    eq(answersTable.userId, hostUserId),
                    eq(answersTable.gameId, game.id),
                    eq(answersTable.questionId, question.id),
                ),
            );

        // A recorded skip (blank answer) may be replaced once by a real answer. A
        // real answer, or a blank on top of a blank, keeps the existing 409.
        const skipToReplace = existing && existing.userAnswer === "" && parsed.data.userAnswer !== "" ? existing : null;

        if (existing && !skipToReplace) {
            // Return the stored answer so the client can seed its local state
            // and show the already-answered UI without further retries.
            res.status(409).json({ error: "You already answered this question", existingAnswer: existing.userAnswer });
            return;
        }

        const opts = question.options as { alternateAnswers?: string[] } | null;
        const alternates = opts?.alternateAnswers ?? [];

        // Empty userAnswer = explicit skip — record as zero without calling gradeAnswer.
        // This avoids wasted AI calls for short_response questions and keeps the
        // grading path clean; the answer is still stored in the DB with isCorrect=false.
        let isCorrect: boolean;
        let pointsEarned: number;
        let feedback: string | undefined;
        let needsReview = false;
        if (parsed.data.userAnswer === "") {
            isCorrect = false;
            pointsEarned = 0;
        } else {
            const grade = await gradeAnswer(
                question.questionType,
                parsed.data.userAnswer,
                decodeHtml(question.correctAnswer),
                question.points,
                alternates,
                question.options as Record<string, unknown> | null,
                decodeHtml(question.questionText),
            );
            isCorrect = grade.isCorrect;
            pointsEarned = grade.pointsEarned;
            feedback = grade.feedback;
            needsReview = grade.needsReview ?? false;
        }

        const result = await db.transaction(async (tx) => {
            const [answer] = skipToReplace
                // Replace the skip in place. The userAnswer = '' condition lets a
                // concurrent replacement win only once; the loser sees no row.
                ? await tx
                    .update(answersTable)
                    .set({
                        userAnswer: parsed.data.userAnswer,
                        isCorrect,
                        pointsEarned,
                        gradingStatus: needsReview ? "needs_review" : "graded",
                    })
                    .where(
                        and(
                            eq(answersTable.id, skipToReplace.id),
                            eq(answersTable.userAnswer, ""),
                        ),
                    )
                    .returning()
                : await tx
                    .insert(answersTable)
                    .values({
                        userId: hostUserId,
                        gameId: question.gameId,
                        questionId: question.id,
                        userAnswer: parsed.data.userAnswer,
                        isCorrect,
                        pointsEarned,
                        gradingStatus: needsReview ? "needs_review" : "graded",
                    })
                    .onConflictDoNothing({
                        target: [
                            answersTable.userId,
                            answersTable.gameId,
                            answersTable.questionId,
                        ],
                    })
                    .returning();

            if (!answer) {
                const [stored] = await tx
                    .select({ userAnswer: answersTable.userAnswer })
                    .from(answersTable)
                    .where(
                        and(
                            eq(answersTable.userId, hostUserId),
                            eq(answersTable.gameId, game.id),
                            eq(answersTable.questionId, question.id),
                        ),
                    )
                    .limit(1);
                return { kind: "duplicate" as const, stored };
            }

            const [updatedParticipant] = await tx
                .update(gameParticipantsTable)
                .set({
                    totalScore: sql`${gameParticipantsTable.totalScore} + ${pointsEarned}`,
                })
                .where(eq(gameParticipantsTable.id, participant.id))
                .returning({ totalScore: gameParticipantsTable.totalScore });

            if (!updatedParticipant) {
                throw new Error("Participant disappeared while recording host answer");
            }

            return {
                kind: "created" as const,
                answer,
                totalScore: updatedParticipant.totalScore,
            };
        });

        if (result.kind === "duplicate") {
            res.status(409).json({
                error: "You already answered this question",
                ...(result.stored ? { existingAnswer: result.stored.userAnswer } : {}),
            });
            return;
        }

        const { answer, totalScore } = result;

        const responsePayload = toJsonSafe({
            ...answer,
            pointsEarned,
            totalScore,
            ...(feedback ? { feedback } : {}),
            ...(needsReview ? { gradingStatus: "needs_review" } : {}),
        });
        res.status(201).json(SubmitAnswerResponse.parse(responsePayload));

        // Fire-and-forget: broadcast the event so the live tally updates
        db.select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, hostUserId))
            .then(([u]) => {
                if (!u) return;
                safeEmit(`game:${question.gameId}`, "answer:submitted", {
                    gameId: question.gameId,
                    questionId: question.id,
                    playerName: u.name,
                });
                safeEmit(`game:host:${question.gameId}`, "answer:graded", {
                    gameId: question.gameId,
                    questionId: question.id,
                    playerName: u.name,
                    isCorrect,
                });
            })
            .catch(() => {});
    },
);


export default router;
