import { logger } from "../lib/logger.ts";
import {
    computeVarietyOnlyTypeCounts,
    generateGeminiVarietyQuestions,
    type GeminiQuestion,
    type GeminiVarietyQuestionType,
    type GeminiVarietyTargetCounts,
} from "./geminiApi.ts";
import {
    fetchOpenTdbQuestions,
    type FetchQuestionsError,
    type FetchQuestionsOptions,
    type OpenTdbQuestion,
} from "./triviaApi.ts";

export type OpenTdbImportMode = "standard" | "extended" | "surprise";

export const EXTENDED_VARIETY_TYPES = [
    "write_in",
    "ordering",
    "multi_select",
] as const satisfies readonly GeminiVarietyQuestionType[];

export const SURPRISE_VARIETY_TYPES = [
    "write_in",
    "matching",
    "ordering",
    "multi_select",
    "slider",
    "short_response",
] as const satisfies readonly GeminiVarietyQuestionType[];

const OPENTDB_CATEGORY_SUBJECTS: Readonly<Record<number, string>> = {
    9: "General Knowledge",
    10: "Entertainment: Books",
    11: "Entertainment: Film",
    12: "Entertainment: Music",
    13: "Entertainment: Musicals & Theatres",
    14: "Entertainment: Television",
    15: "Entertainment: Video Games",
    16: "Entertainment: Board Games",
    17: "Science & Nature",
    18: "Science: Computers",
    19: "Science: Mathematics",
    20: "Mythology",
    21: "Sports",
    22: "Geography",
    23: "History",
    24: "Politics",
    25: "Art",
    26: "Celebrities",
    27: "Animals",
    28: "Vehicles",
    29: "Entertainment: Comics",
    30: "Science: Gadgets",
    31: "Entertainment: Japanese Anime & Manga",
    32: "Entertainment: Cartoon & Animations",
};

export type OpenTdbSupplementQuestion = OpenTdbQuestion | GeminiQuestion;

export type OpenTdbSupplementError =
    | FetchQuestionsError
    | { code: "invalid_amount"; message: string }
    | { code: "invalid_category"; message: string };

export type OpenTdbSupplementResult =
    | {
        ok: true;
        questions: OpenTdbSupplementQuestion[];
        openTdbTarget: number;
        aiTarget: number;
        openTdbDelivered: number;
        aiDelivered: number;
        aiBackfilledByOpenTdb: number;
        aiTargetCounts: GeminiVarietyTargetCounts;
    }
    | { ok: false; error: OpenTdbSupplementError };

export interface OpenTdbSupplementOptions {
    mode: "extended" | "surprise";
    amount: number;
    categoryId: number;
    difficulty: "easy" | "medium" | "hard";
    brief?: string;
}

export function parseOpenTdbImportMode(value: unknown): OpenTdbImportMode | null {
    if (value === undefined) return "standard";
    return value === "standard" || value === "extended" || value === "surprise" ? value : null;
}

/**
 * Splits a requested total by exact percentage. The AI count gets the lower
 * integer on halves, so the leftover slot consistently belongs to OpenTDB.
 */
export function splitOpenTdbAndAiCounts(
    total: number,
    aiPercent: 0.3 | 0.4,
): { openTdbCount: number; aiCount: number } {
    const aiCount = Math.floor(total * aiPercent);
    return { openTdbCount: total - aiCount, aiCount };
}

/** Fixed, even largest-remainder allocation for extended mode. */
export function computeExtendedVarietyTargets(aiCount: number): GeminiVarietyTargetCounts {
    const targets: GeminiVarietyTargetCounts = {};
    const base = Math.floor(aiCount / EXTENDED_VARIETY_TYPES.length);
    let remaining = aiCount - base * EXTENDED_VARIETY_TYPES.length;
    for (const type of EXTENDED_VARIETY_TYPES) {
        targets[type] = base + (remaining > 0 ? 1 : 0);
        remaining--;
    }
    return targets;
}

function normalizeQuestionText(questionText: string): string {
    return questionText.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function shuffleArray<T>(values: readonly T[]): T[] {
    const shuffled = [...values];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
}

async function fetchDistinctOpenTdbQuestions(
    opts: FetchQuestionsOptions,
    requestedCount: number,
    usedQuestionTexts: Set<string>,
): Promise<{ ok: true; questions: OpenTdbQuestion[] } | { ok: false; error: FetchQuestionsError }> {
    const questions: OpenTdbQuestion[] = [];
    const MAX_REQUESTS = 3;

    for (let attempt = 0; attempt < MAX_REQUESTS && questions.length < requestedCount; attempt++) {
        const result = await fetchOpenTdbQuestions({
            ...opts,
            amount: requestedCount - questions.length,
        });
        if (!result.ok) return result;

        let added = 0;
        for (const question of result.questions) {
            const key = normalizeQuestionText(question.questionText);
            if (usedQuestionTexts.has(key)) continue;
            usedQuestionTexts.add(key);
            questions.push(question);
            added++;
            if (questions.length === requestedCount) break;
        }
        if (added === 0) break;
    }

    if (questions.length !== requestedCount) {
        return { ok: false, error: { code: "no_results" } };
    }
    return { ok: true, questions };
}

function isAiQuestion(question: OpenTdbSupplementQuestion): question is GeminiQuestion {
    return "aiGenerated" in question;
}

export function mergeSupplementedQuestions(
    openTdbQuestions: readonly OpenTdbQuestion[],
    aiQuestions: readonly GeminiQuestion[],
    fallbackQuestions: readonly OpenTdbQuestion[],
    requestedTotal: number,
): OpenTdbSupplementQuestion[] | null {
    const questions = shuffleArray([
        ...openTdbQuestions,
        ...aiQuestions,
        ...fallbackQuestions,
    ]).map((question, orderIndex) => ({ ...question, orderIndex }));
    return questions.length === requestedTotal ? questions : null;
}

export async function generateOpenTdbSupplement(
    opts: OpenTdbSupplementOptions,
): Promise<OpenTdbSupplementResult> {
    if (!Number.isInteger(opts.amount) || opts.amount < 10 || opts.amount > 30) {
        return {
            ok: false,
            error: {
                code: "invalid_amount",
                message: "Extended and surprise imports require an integer question count from 10 to 30.",
            },
        };
    }
    const topic = OPENTDB_CATEGORY_SUBJECTS[opts.categoryId];
    if (!topic) {
        return {
            ok: false,
            error: {
                code: "invalid_category",
                message: "Extended and surprise imports require a specific OpenTDB category.",
            },
        };
    }

    const aiPercent = opts.mode === "extended" ? 0.3 : 0.4;
    const { openTdbCount, aiCount } = splitOpenTdbAndAiCounts(opts.amount, aiPercent);
    const allowedTypes = opts.mode === "extended" ? EXTENDED_VARIETY_TYPES : SURPRISE_VARIETY_TYPES;
    const aiTargetCounts = opts.mode === "extended"
        ? computeExtendedVarietyTargets(aiCount)
        : computeVarietyOnlyTypeCounts(aiCount, allowedTypes, 2);

    logger.info(
        {
            mode: opts.mode,
            requestedTotal: opts.amount,
            openTdbTarget: openTdbCount,
            aiTarget: aiCount,
            aiTargetCounts,
            categoryId: opts.categoryId,
            topic,
        },
        "OpenTDB supplemented import split",
    );

    const usedQuestionTexts = new Set<string>();
    const openTdb = await fetchDistinctOpenTdbQuestions(
        { amount: openTdbCount, categoryId: opts.categoryId, difficulty: opts.difficulty },
        openTdbCount,
        usedQuestionTexts,
    );
    if (!openTdb.ok) return openTdb;

    const aiResult = await generateGeminiVarietyQuestions({
        topic,
        difficulty: opts.difficulty,
        amount: aiCount,
        targetCounts: aiTargetCounts,
        allowedTypes,
        existingQuestions: openTdb.questions.map((question) => question.questionText),
        brief: opts.brief,
        skipFactCheck: true,
    });
    const aiQuestions = aiResult.ok
        ? aiResult.questions.filter((question) => {
            const key = normalizeQuestionText(question.questionText);
            if (usedQuestionTexts.has(key)) return false;
            usedQuestionTexts.add(key);
            return true;
        })
        : [];
    if (!aiResult.ok) {
        logger.warn({ mode: opts.mode, error: aiResult.error }, "AI variety supplement unavailable; backfilling with OpenTDB");
    } else if (aiQuestions.length !== aiResult.questions.length) {
        logger.warn(
            { mode: opts.mode, droppedDuplicates: aiResult.questions.length - aiQuestions.length },
            "Dropping duplicate AI variety supplement questions",
        );
    }

    const aiBackfilledByOpenTdb = aiCount - aiQuestions.length;
    const fallbackQuestions = aiBackfilledByOpenTdb > 0
        ? await fetchDistinctOpenTdbQuestions(
            { amount: aiBackfilledByOpenTdb, categoryId: opts.categoryId, difficulty: opts.difficulty },
            aiBackfilledByOpenTdb,
            usedQuestionTexts,
        )
        : { ok: true as const, questions: [] as OpenTdbQuestion[] };
    if (!fallbackQuestions.ok) return fallbackQuestions;

    const questions = mergeSupplementedQuestions(
        openTdb.questions,
        aiQuestions,
        fallbackQuestions.questions,
        opts.amount,
    );
    if (!questions) {
        return {
            ok: false,
            error: {
                code: "no_results",
            },
        };
    }

    const aiDelivered = questions.filter(isAiQuestion).length;
    logger.info(
        {
            mode: opts.mode,
            requestedTotal: opts.amount,
            openTdbTarget: openTdbCount,
            aiTarget: aiCount,
            openTdbDelivered: questions.length - aiDelivered,
            aiDelivered,
            aiBackfilledByOpenTdb,
            aiTargetCounts,
            containsImageQuestions: questions.some((question) => question.questionType === "image_recognition"),
        },
        "OpenTDB supplemented import complete",
    );

    return {
        ok: true,
        questions,
        openTdbTarget: openTdbCount,
        aiTarget: aiCount,
        openTdbDelivered: questions.length - aiDelivered,
        aiDelivered,
        aiBackfilledByOpenTdb,
        aiTargetCounts,
    };
}
