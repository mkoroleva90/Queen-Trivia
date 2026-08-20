
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { COPY } from "@workspace/copy";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import {
 geminiGenerateRateLimit,
 geminiOperationRateLimit,
} from "../middleware/providerRateLimit.ts";
import { db, gamesTable, questionsTable } from "@workspace/db";
import {
 GenerateGeminiQuestionsBody,
 GenerateGeminiQuestionsParams,
 RegenerateQuestionBody,
 RegenerateQuestionParams,
 EnhanceQuestionParams,
} from "@workspace/api-zod";
import {
 generateGeminiQuestions,
 regenerateSingleQuestion,
 enhanceQuestion,
} from "../services/geminiApi.ts";
import { logger } from "../lib/logger.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { checkAiUsageLimit, recordAiUsage } from "../lib/usageLimits.ts";
import {
  anyContainsBannedContent,
  extractOptionTexts,
  logFlaggedContent,
} from "../lib/contentFilter.ts";


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
            error: "Google Gemini API key not configured. Add GOOGLE_API_KEY to your environment secrets.",
        });
        return;
    }
    const msg = (error as { message?: string }).message ?? error.code;
    const kind = (error as { kind?: string }).kind;
    if (kind === "rate_limit_minute" || kind === "rate_limit_daily") {
        const e = error as { kind?: string; message?: string; quotaId?: string; retryAfterSeconds?: number };
        res.status(429).json({ error: msg, kind: e.kind, quotaId: e.quotaId, retryAfterSeconds: e.retryAfterSeconds });
        return;
    }
    if (kind === "model_unavailable") {
        res.status(503).json({ error: msg });
        return;
    }
    if (error.code === "safety_block") {
        res.status(422).json({ error: COPY.aiGenerate.safetyBlock, code: "safety_block" });
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

        if (!await assertGameOwnership(req, res, params.data.gameId)) return;

        // Per-host AI usage limit (enforcement gated by ENFORCE_FREE_TIER_LIMITS env var).
        const limitError = await checkAiUsageLimit(req.session.adminAccountId);
        if (limitError) {
            res.status(429).json({ error: limitError });
            return;
        }

        const result = await generateGeminiQuestions({
            topic: body.data.topic,
            difficulty: body.data.difficulty,
            amount: body.data.amount,
            existingQuestions: body.data.existingQuestions,
            brief: (body.data.brief as string | undefined) ?? game.brief ?? undefined,
            skipFactCheck: true,
        });

        if (!result.ok) {
            logger.warn({ error: result.error }, "Gemini generation failed");
            geminiErrorResponse(res, result.error);
            return;
        }
        if (result.questions.length === 0) {
            res.status(422).json({ error: "Gemini returned no valid questions. Try a different topic or retry." });
            return;
        }

        // Image URL validation + top-up are now handled inside generateGeminiQuestions.
        // Content filter: drop any AI-generated question that contains banned content
        // before it is written to the database. This is a second layer under the AI
        // provider's own safety filtering; flagged questions are logged and discarded.
        const questions = result.questions.filter((q) => {
            const allText: Array<string | null | undefined> = [
                q.questionText,
                q.correctAnswer,
                ...extractOptionTexts(q.options as unknown),
            ];
            if (anyContainsBannedContent(allText)) {
                logFlaggedContent('ai_generated_question');
                return false;
            }
            return true;
        });

        // Track how many questions were removed by the content filter so the
        // host can be told rather than receiving a silent partial result.
        const contentFilteredCount = result.questions.length - questions.length;

        if (questions.length === 0) {
            // Every question was removed — do not insert anything and tell the host.
            res.status(422).json({ error: COPY.aiGenerate.contentFilteredAll, code: "content_filtered_all" });
            return;
        }
        if (questions.length !== body.data.amount) {
            // The generation service guarantees an exact requested count. Keep
            // that guarantee intact if this final defense-in-depth filter ever
            // catches a question that was not caught inside the service.
            res.status(422).json({
                error: "Gemini could not produce the requested number of safe questions. Please try again.",
                code: "content_filtered_partial",
            });
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
            factCheckUrl: q.factCheckUrl,
            aiGenerated: q.aiGenerated,
            verifiedByAdmin: q.verifiedByAdmin,
        }));

        await db.insert(questionsTable).values(toInsert);
        await syncQuestionCount(game.id);

        // Record AI usage (non-fatal)
        await recordAiUsage(req.session.adminAccountId, game.id, "generate_bulk", questions.length);

        const distinctTypes = new Set(questions.map((q) => q.questionType));
        if (body.data.amount >= 5 && distinctTypes.size < 3) {
            req.log.warn(
                { gameId: game.id, types: [...distinctTypes], requested: body.data.amount },
                "Generated questions lack variety (fewer than 3 question types)",
            );
        }

        const savedCount = questions.length;
        const discardedCount = result.discarded;
        logger.info(
            { gameId: game.id, saved: savedCount, discarded: discardedCount, contentFiltered: contentFilteredCount },
            `${savedCount} saved, ${discardedCount} discarded, ${contentFilteredCount} content-filtered`,
        );
        res.json({
            imported: savedCount,
            total: result.questions.length + result.discarded,
            discarded: discardedCount,
            // Only present when the content filter removed at least one question.
            // Clients must show contentFilteredMessage to the host when this field is > 0.
            ...(contentFilteredCount > 0 ? {
                contentFilteredCount,
                contentFilteredMessage: COPY.aiGenerate.contentFilteredPartial(savedCount, contentFilteredCount),
            } : {}),
        });
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

        if (!await assertGameOwnership(req, res, gameId)) return;

        const limitError = await checkAiUsageLimit(req.session.adminAccountId);
        if (limitError) { res.status(429).json({ error: limitError }); return; }

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

        // Record usage after success (non-fatal)
        await recordAiUsage(req.session.adminAccountId, gameId, "generate_preview", 1);

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

        if (!await assertGameOwnership(req, res, params.data.gameId)) return;

        const limitError = await checkAiUsageLimit(req.session.adminAccountId);
        if (limitError) { res.status(429).json({ error: limitError }); return; }

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

        await recordAiUsage(req.session.adminAccountId, params.data.gameId, "regenerate", 1);

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

        if (!await assertGameOwnership(req, res, params.data.gameId)) return;

        const limitError = await checkAiUsageLimit(req.session.adminAccountId);
        if (limitError) { res.status(429).json({ error: limitError }); return; }

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

        await recordAiUsage(req.session.adminAccountId, params.data.gameId, "enhance", 1);

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


export default router;
