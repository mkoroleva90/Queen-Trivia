
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, and, desc, asc, sql } from "drizzle-orm";
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
    const [game] = await db
        .select()
        .from(gamesTable)
        .where(eq(gamesTable.id, params.data.gameId));

    if (!game) {
        res.status(404).json({ error: "Game not found" });
        return;
    }

    const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, sessionUserId));

    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }

    const [existing] = await db
        .select()
        .from(gameParticipantsTable)
        .where(
            and(
                eq(gameParticipantsTable.gameId, game.id),
                eq(gameParticipantsTable.userId, user.id),
            ),
        );

    if (existing) {
        res.status(201).json(JoinGameResponse.parse(toJsonSafe(existing)));
        return;
    }

    const [grant] = await db
        .select({ id: gameAccessGrantsTable.id })
        .from(gameAccessGrantsTable)
        .where(
            and(
                eq(gameAccessGrantsTable.gameId, params.data.gameId),
                eq(gameAccessGrantsTable.userId, sessionUserId),
            ),
        )
        .limit(1);
    if (!grant) {
        res.status(403).json({ error: "Enter this game's access code before joining" });
        return;
    }
 const [removedByUserId] = await db
     .select({ id: removedParticipantsTable.id })
     .from(removedParticipantsTable)
     .where(
      and(
       eq(removedParticipantsTable.gameId, game.id),
       eq(removedParticipantsTable.userId, user.id),
      ),
     );

 if (removedByUserId) {
     res.status(403).json({ error: COPY.kick.rejoinBlocked });
     return;
 }

 const [removedByName] = await db
     .select({ id: removedParticipantsTable.id })
     .from(removedParticipantsTable)
     .where(
      and(
       eq(removedParticipantsTable.gameId, game.id),
       sql`lower(${removedParticipantsTable.displayName}) = lower(${user.name})`,
      ),
     );

 if (removedByName) {
     res.status(403).json({ error: COPY.kick.rejoinBlocked });
     return;
 }


 const [participant] = await db
     .insert(gameParticipantsTable)
     .values({ gameId: game.id, userId: user.id })
     .returning();


 res.status(201).json(JoinGameResponse.parse(toJsonSafe(participant)));
});


// ─── List participants ──────────────────────────────────────────────────────


router.get("/games/:gameId/participants", requireAuth, async (req, res): Promise<void> => {
 const params = ListGameParticipantsParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

 const rows = await db
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
     .where(eq(gameParticipantsTable.gameId, params.data.gameId))
     .orderBy(
         desc(gameParticipantsTable.totalScore),
         asc(gameParticipantsTable.joinedAt),
     );

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

if (game.currentQuestionId !== question.id) {
    res.status(409).json({ error: "This question has not been released by the host" });
    return;
}


const [already] = await db
    .select()
    .from(answersTable)
    .where(
     and(
         eq(answersTable.userId, sessionUserId),
         eq(answersTable.questionId, question.id),
     ),
    );


if (already) {
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


const { isCorrect, pointsEarned, feedback } = await gradeAnswer(
    question.questionType,
    parsed.data.userAnswer,
    decodeHtml(question.correctAnswer),
    question.points,
    alternates,
    question.options as Record<string, unknown> | null,
    decodeHtml(question.questionText),
);


const [answer] = await db
    .insert(answersTable)
 .values({
     userId: sessionUserId,
     gameId: question.gameId,
     questionId: question.id,
     userAnswer: parsed.data.userAnswer,
     isCorrect,
     pointsEarned,
 })
 .returning();

        const totalScore = (participant.totalScore ?? 0) + pointsEarned;


await db
 .update(gameParticipantsTable)
 .set({ totalScore })
 .where(eq(gameParticipantsTable.id, participant.id));


res.status(201).json(
 SubmitAnswerResponse.parse(
     toJsonSafe({
         ...answer,
         pointsEarned,
         totalScore,
         ...(feedback ? { feedback } : {}),
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
 requireUser,
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
        if (game.currentQuestionId !== question.id) {
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
                    eq(answersTable.questionId, question.id),
                ),
            );

        if (existing) {
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
        if (parsed.data.userAnswer === "") {
            isCorrect = false;
            pointsEarned = 0;
        } else {
            ({ isCorrect, pointsEarned, feedback } = await gradeAnswer(
                question.questionType,
                parsed.data.userAnswer,
                decodeHtml(question.correctAnswer),
                question.points,
                alternates,
                question.options as Record<string, unknown> | null,
                decodeHtml(question.questionText),
            ));
        }

        const [answer] = await db
            .insert(answersTable)
            .values({
                userId: hostUserId,
                gameId: question.gameId,
                questionId: question.id,
                userAnswer: parsed.data.userAnswer,
                isCorrect,
                pointsEarned,
            })
            .returning();

        const totalScore = (participant.totalScore ?? 0) + pointsEarned;
        await db
            .update(gameParticipantsTable)
            .set({ totalScore })
            .where(eq(gameParticipantsTable.id, participant.id));

        const responsePayload = toJsonSafe({
            ...answer,
            pointsEarned,
            totalScore,
            ...(feedback ? { feedback } : {}),
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
