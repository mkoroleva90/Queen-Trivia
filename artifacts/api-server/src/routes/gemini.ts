
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import {
 geminiGenerateRateLimit,
 geminiOperationRateLimit,
} from "../middleware/providerRateLimit";
import { db, gamesTable, questionsTable } from "@workspace/db";
import {
 GenerateGeminiQuestionsBody,
 GenerateGeminiQuestionsParams,
 RegenerateQuestionBody,
 RegenerateQuestionParams,
 EnhanceQuestionParams,
 FactCheckQuestionParams,
} from "@workspace/api-zod";
import {
 generateGeminiQuestions,
 filterValidImageQuestions,
 regenerateSingleQuestion,
 enhanceQuestion,
 factCheckSingleQuestion,
} from "../services/geminiApi";
import { logger } from "../lib/logger";


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


function geminiErrorResponse(
    res: Parameters<Parameters<IRouter["post"]>[1]>[1],
    error: { code: string; message?: string },
): void {
    if (error.code === "no_api_key") {
        res.status(503).json({
  error: "Google Gemini API key not configured. Add GOOGLE_API_KEY to yourenvironment secrets.",
        });
        return;
    }
    const msg = (error as { message?: string }).message ?? error.code;
    const kind = (error as { kind?: string }).kind;
    if (kind === "rate_limit_minute" || kind === "rate_limit_daily") {
        res.status(429).json({ error: msg });
        return;
    }
    if (kind === "model_unavailable") {
        res.status(503).json({ error: msg });
        return;
    }
    res.status(502).json({ error: `Gemini error: ${msg}` });
}


// ── Bulk generate questions ────────────────────────────────────────────────────


router.post(
    "/games/:gameId/questions/generate-gemini",
    requireAdmin,
    geminiGenerateRateLimit,
    async (req, res): Promise<void> => {
        const params = GenerateGeminiQuestionsParams.safeParse(req.params);
        if (!params.success) {
            res.status(400).json({ error: "Invalid game ID" });
            return;
        }


        const body = GenerateGeminiQuestionsBody.safeParse(req.body);
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


const result = await generateGeminiQuestions({
    topic: body.data.topic,
    difficulty: body.data.difficulty,
    amount: body.data.amount,
    existingQuestions: body.data.existingQuestions,
    brief: (body.data.brief as string | undefined) ?? game.brief ?? undefined,
});


if (!result.ok) {
    logger.warn({ error: result.error }, "Gemini generation failed");
    geminiErrorResponse(res, result.error);
    return;
}
 if (result.questions.length === 0) {
   res.status(422).json({ error: "Gemini returned no valid questions. Try a different topic orretry." });
     return;
 }


 // Drop image questions whose URLs don't actually resolve to an image
 const questions = await filterValidImageQuestions(result.questions);
 if (questions.length === 0) {
   res.status(422).json({ error: "Gemini returned no valid questions. Try a different topic orretry." });
     return;
 }


 const existing = await db
     .select({ orderIndex: questionsTable.orderIndex })
     .from(questionsTable)
     .where(eq(questionsTable.gameId, game.id));


 const maxOrder = existing.length > 0
     ? Math.max(...existing.map((r) => r.orderIndex))
     : -1;


 const toInsert = questions.map((q, i) => ({
     gameId: game.id,
     questionText: q.questionText,
     questionType: q.questionType,
         correctAnswer: q.correctAnswer,
         options: q.options as Record<string, unknown> | null,
         imageUrl: q.imageUrl,
         points: q.points,
         orderIndex: maxOrder + 1 + i,
         source: q.source,
         aiGenerated: q.aiGenerated,
         verifiedByAdmin: q.verifiedByAdmin,
     }));


     await db.insert(questionsTable).values(toInsert);
     await syncQuestionCount(game.id);


     const distinctTypes = new Set(questions.map((q) => q.questionType));
     if (body.data.amount >= 5 && distinctTypes.size < 3) {
         req.log.warn(
          { gameId: game.id, types: [...distinctTypes], requested: body.data.amount },
          "Generated questions lack variety (fewer than 3 question types)",
         );
     }


     res.json({ imported: questions.length, total: result.questions.length });
 },
);


// ── Preview-generate one question for the Add dialog (not saved) ─────────────
router.post(
    "/games/:gameId/questions/generate-preview",
    requireAdmin,
    geminiOperationRateLimit,
    async (req, res): Promise<void> => {
        const gameId = Number(req.params.gameId);
        if (!Number.isFinite(gameId)) {
            res.status(400).json({ error: "Invalid game ID" });
            return;
        }

        const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
        if (!game) { res.status(404).json({ error: "Game not found" }); return; }

        const validTypes = ["multiple_choice", "true_false", "write_in"];
        const validDiffs = ["easy", "medium", "hard"];
        const questionType = (req.body.questionType ?? "multiple_choice") as string;
        const difficulty = (req.body.difficulty ?? game.difficulty ?? "medium") as string;

        if (!validTypes.includes(questionType)) {
            res.status(400).json({ error: "Invalid question type" }); return;
        }
        if (!validDiffs.includes(difficulty)) {
            res.status(400).json({ error: "Invalid difficulty" }); return;
        }

        const allQuestions = await db
            .select({ questionText: questionsTable.questionText })
            .from(questionsTable)
            .where(eq(questionsTable.gameId, gameId));
        const avoidTexts = allQuestions
            .map((q) => q.questionText)
            .filter((t): t is string => typeof t === "string" && t.length > 0);

        const points = difficulty === "easy" ? 5 : difficulty === "hard" ? 15 : 10;

        const result = await regenerateSingleQuestion({
            topic: game.topic,
            difficulty: difficulty as "easy" | "medium" | "hard",
            questionType: questionType as "multiple_choice" | "true_false" | "write_in",
            avoidTexts,
            points,
            brief: (req.body as { brief?: string }).brief ?? game.brief ?? undefined,
        });

        if (!result.ok) {
            logger.warn({ error: result.error }, "Gemini preview-generate failed");
            geminiErrorResponse(res, result.error);
            return;
        }

        res.json({
            questionType: result.question.questionType,
            questionText: result.question.questionText,
            correctAnswer: result.question.correctAnswer,
            options: result.question.options,
            points: result.question.points,
            source: result.question.source,
        });
    },
);


// ── Regenerate single question (preview only, not saved) ──────────────────────
router.post(
"/games/:gameId/questions/:questionId/regenerate",
requireAdmin,
geminiOperationRateLimit,
async (req, res): Promise<void> => {
 const params = RegenerateQuestionParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: "Invalid IDs" });
     return;
 }


 const body = RegenerateQuestionBody.safeParse(req.body);
 if (!body.success) {
     res.status(400).json({ error: body.error.message });
     return;
 }


 const [question] = await db
     .select()
     .from(questionsTable)
     .where(
      and(
       eq(questionsTable.id, params.data.questionId),
       eq(questionsTable.gameId, params.data.gameId),
      ),
    );


if (!question) {
    res.status(404).json({ error: "Question not found" });
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


const difficulty =
    body.data.difficulty ?? (game.difficulty as "easy" | "medium" | "hard") ?? "medium";


const questionType =
    (body.data.questionType as "multiple_choice" | "true_false" | "write_in" | undefined) ??
    (question.questionType as "multiple_choice" | "true_false" | "write_in");


const allQuestions = await db
    .select({ questionText: questionsTable.questionText })
    .from(questionsTable)
    .where(eq(questionsTable.gameId, params.data.gameId));

const avoidTexts = allQuestions
    .map((q) => q.questionText)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

const result = await regenerateSingleQuestion({
    topic: game.topic,
         difficulty,
         questionType,
         avoidTexts,
         points: question.points,
         brief: (req.body as { brief?: string }).brief ?? game.brief ?? undefined,
     });


     if (!result.ok) {
         logger.warn({ error: result.error }, "Gemini regenerate failed");
         geminiErrorResponse(res, result.error);
         return;
     }


     res.json({
         questionType: result.question.questionType,
         questionText: result.question.questionText,
         correctAnswer: result.question.correctAnswer,
         options: result.question.options,
         points: result.question.points,
         source: result.question.source,
     });
 },
);


// ── Enhance question (suggestions only, not saved) ────────────────────────────


router.post(
"/games/:gameId/questions/:questionId/enhance",
requireAdmin,
geminiOperationRateLimit,
async (req, res): Promise<void> => {
const params = EnhanceQuestionParams.safeParse(req.params);
if (!params.success) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
}


const [question] = await db
    .select()
    .from(questionsTable)
    .where(
     and(
         eq(questionsTable.id, params.data.questionId),
         eq(questionsTable.gameId, params.data.gameId),
     ),
    );


if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
}


const choices =
         (question.options as { choices?: string[] } | null)?.choices ?? [];


     const result = await enhanceQuestion({
         questionType: question.questionType,
         questionText: question.questionText,
         correctAnswer: question.correctAnswer,
         options: choices,
         source: question.source,
     });


     if (!result.ok) {
         logger.warn({ error: result.error }, "Gemini enhance failed");
         geminiErrorResponse(res, result.error);
         return;
     }


     res.json({
         improvedQuestionText: result.data.improvedQuestionText,
         improvedOptions: result.data.improvedOptions,
         factCheckResult: result.data.factCheckResult,
         factCheckNotes: result.data.factCheckNotes,
         suggestedSource: result.data.suggestedSource,
         suggestions: result.data.suggestions,
     });
 },
);
// ── Fact-check single question ────────────────────────────────────────────────


router.post(
"/games/:gameId/questions/:questionId/fact-check",
requireAdmin,
geminiOperationRateLimit,
async (req, res): Promise<void> => {
 const params = FactCheckQuestionParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: "Invalid IDs" });
     return;
 }


 const [question] = await db
     .select()
     .from(questionsTable)
     .where(
      and(
          eq(questionsTable.id, params.data.questionId),
          eq(questionsTable.gameId, params.data.gameId),
      ),
     );


 if (!question) {
     res.status(404).json({ error: "Question not found" });
         return;
     }


     const result = await factCheckSingleQuestion({
         questionText: question.questionText,
         correctAnswer: question.correctAnswer,
     });


     if (!result.ok) {
         logger.warn({ error: result.error }, "Gemini fact-check failed");
         geminiErrorResponse(res, result.error);
         return;
     }


     res.json({
         verdict: result.data.verdict,
         confidence: result.data.confidence,
         explanation: result.data.explanation,
         correctAnswerIfWrong: result.data.correctAnswerIfWrong,
     });
 },
);


export default router;


