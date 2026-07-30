
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gamesTable, questionsTable } from "@workspace/db";
import {
 ImportOpenTdbQuestionsParams,
 ImportOpenTdbQuestionsBody,
 ImportOpenTdbQuestionsResponse,
} from "@workspace/api-zod";
import { fetchOpenTdbQuestions } from "../services/triviaApi";
import { requireAdmin } from "../middleware/requireAdmin";
import { opentdbRateLimit } from "../middleware/providerRateLimit";
import { assertGameOwnership } from "../lib/assertGameOwnership";


const router: IRouter = Router();


async function syncQuestionCount(gameId: number): Promise<void> {
 const rows = await db
  .select({ id: questionsTable.id })
  .from(questionsTable)
  .where(eq(questionsTable.gameId, gameId));
 await db
    .update(gamesTable)
    .set({ questionCount: rows.length })
    .where(eq(gamesTable.id, gameId));
}


router.post(
    "/games/:gameId/questions/import-opentdb",
    requireAdmin,
    opentdbRateLimit,
    async (req, res): Promise<void> => {
    const params = ImportOpenTdbQuestionsParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }


    const body = ImportOpenTdbQuestionsBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: body.error.message });
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

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

 const result = await fetchOpenTdbQuestions({
     amount: body.data.amount,
     categoryId: body.data.categoryId,
     difficulty: body.data.difficulty,
 });


 if (!result.ok) {
     if (result.error.code === "rate_limited") {
         res.status(429).json({
          error:
           "Open Trivia Database rate limit reached. Please wait a few seconds and try again.",
         });
         return;
     }
     if (result.error.code === "no_results") {
         res.status(422).json({
          error:
      "No questions available for this category/difficulty combination. Try a differentdifficulty.",
         });
        return;
    }
    res.status(502).json({
        error: "Could not reach Open Trivia Database. Please try again.",
    });
    return;
}


if (result.questions.length === 0) {
    res.json(ImportOpenTdbQuestionsResponse.parse({ imported: 0, total: 0 }));
    return;
}


const toInsert = result.questions.map((q) => ({
    gameId: game.id,
    questionText: q.questionText,
    questionType: q.questionType,
    correctAnswer: q.correctAnswer,
    options: q.options as Record<string, unknown> | null,
    imageUrl: null,
    points: q.points,
    orderIndex: q.orderIndex,
    source: q.source,
}));


await db.insert(questionsTable).values(toInsert);
     await syncQuestionCount(game.id);


     res.json(
      ImportOpenTdbQuestionsResponse.parse({
          imported: result.questions.length,
          total: result.questions.length,
      }),
     );
 },
);


export default router;


