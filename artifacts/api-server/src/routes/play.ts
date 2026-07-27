
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, and, desc, asc } from "drizzle-orm";
import {
 db,
 gamesTable,
 usersTable,
 questionsTable,
 answersTable,
 gameParticipantsTable,
} from "@workspace/db";
import { safeEmit } from "../lib/socket";
import { requireUser } from "../middleware/requireUser";
import { requireAuth } from "../middleware/requireAuth";
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
import { toJsonSafe } from "../lib/serialize";
import { gradeAnswer } from "../lib/grading";


const router: IRouter = Router();


// ─── Join game ─────────────────────────────────────────────────────────────


router.post("/games/:gameId/join", requireUser, async (req, res): Promise<void> => {
    const params = JoinGameParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }


    const sessionUserId = req.session.userId!;

    // Sessions created with a per-game access code may only join that game
    if (
        typeof req.session.allowedGameId === "number" &&
        req.session.allowedGameId !== params.data.gameId
    ) {
        res.status(403).json({ error: "Your access code is only valid for a different game" });
        return;
    }


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


const opts = question.options as { alternateAnswers?: string[] } | null;
const alternates = opts?.alternateAnswers ?? [];


const { isCorrect, pointsEarned } = gradeAnswer(
    question.questionType,
    parsed.data.userAnswer,
    question.correctAnswer,
    question.points,
    alternates,
    question.options as Record<string, unknown> | null,
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
         ...(question.questionType === "slider" || question.questionType === "image_hotspot"
             ? { correctAnswer: question.correctAnswer }
             : {}),
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
// Only admins or game participants may view per-question answer telemetry
if (!req.session.isAdmin) {
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


export default router;


