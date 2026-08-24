
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gamesTable, questionsTable } from "@workspace/db";
import {
 ImportOpenTdbQuestionsParams,
 ImportOpenTdbQuestionsBody,
 ImportOpenTdbQuestionsResponse,
} from "@workspace/api-zod";
import { fetchOpenTdbQuestions } from "../services/triviaApi.ts";
import {
  generateOpenTdbSupplement,
  parseOpenTdbImportMode,
} from "../services/opentdbSupplement.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { opentdbRateLimit } from "../middleware/providerRateLimit.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { checkAiUsageLimit, recordAiUsage } from "../lib/usageLimits.ts";


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
    const mode = parseOpenTdbImportMode(req.body?.mode);
    if (!mode) {
        res.status(400).json({ error: "mode must be 'standard', 'extended', or 'surprise'." });
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

  // Standard imports intentionally retain the original, OpenTDB-only behavior.
  // There are no AI calls, new limits, or insert-shape changes on this path.
  if (mode === "standard") {
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
      return;
  }

  const limitError = await checkAiUsageLimit(req.session.adminAccountId);
  if (limitError) {
      res.status(429).json({ error: limitError });
      return;
  }

  const supplemented = await generateOpenTdbSupplement({
      mode,
      amount: body.data.amount,
      categoryId: body.data.categoryId,
      difficulty: body.data.difficulty,
      brief: game.brief ?? undefined,
  });
  if (!supplemented.ok) {
      if (supplemented.error.code === "rate_limited") {
          res.status(429).json({
              error: "Open Trivia Database rate limit reached. Please wait a few seconds and try again.",
          });
          return;
      }
      if (supplemented.error.code === "no_results") {
          res.status(422).json({
              error: "OpenTDB could not provide enough questions to complete this mixed import. Try a different difficulty.",
          });
          return;
      }
      if (supplemented.error.code === "invalid_amount" || supplemented.error.code === "invalid_category") {
          res.status(400).json({ error: supplemented.error.message });
          return;
      }
      res.status(502).json({
          error: "Could not reach Open Trivia Database. Please try again.",
      });
      return;
  }

  const toInsert = supplemented.questions.map((q) => {
      const isAiQuestion = "aiGenerated" in q;
      return {
          gameId: game.id,
          questionText: q.questionText,
          questionType: q.questionType,
          correctAnswer: q.correctAnswer,
          options: q.options as Record<string, unknown> | null,
          imageUrl: isAiQuestion ? q.imageUrl : null,
          points: q.points,
          orderIndex: q.orderIndex,
          source: q.source,
          ...(isAiQuestion
              ? {
                  factCheckUrl: q.factCheckUrl,
                  aiGenerated: q.aiGenerated,
                  verifiedByAdmin: q.verifiedByAdmin,
              }
              : {}),
      };
  });

  await db.insert(questionsTable).values(toInsert);
  await syncQuestionCount(game.id);
  await recordAiUsage(req.session.adminAccountId, game.id, "generate_bulk", supplemented.aiDelivered);

  res.json(
      ImportOpenTdbQuestionsResponse.parse({
          imported: supplemented.questions.length,
          total: supplemented.questions.length,
      }),
  );
 },
);


export default router;


