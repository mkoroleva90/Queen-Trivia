
import { Router, type IRouter } from "express";
import { eq, asc, count } from "drizzle-orm";
import { db, gamesTable, questionsTable } from "@workspace/db";
import {
 ListGameQuestionsParams,
 ListGameQuestionsResponse,
 CreateQuestionParams,
 CreateQuestionBody,
 CreateQuestionResponse,
 UpdateQuestionParams,
 UpdateQuestionBody,
 UpdateQuestionResponse,
 DeleteQuestionParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { decodeQuestionFields } from "../lib/decodeHtml.ts";
import {
  anyContainsBannedContent,
  extractOptionTexts,
  logFlaggedContent,
} from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";


const router: IRouter = Router();


async function syncQuestionCount(gameId: number): Promise<void> {
    const [row] = await db
        .select({ value: count() })
        .from(questionsTable)
        .where(eq(questionsTable.gameId, gameId));


    await db
        .update(gamesTable)
        .set({ questionCount: row?.value ?? 0 })
        .where(eq(gamesTable.id, gameId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function validateSpecialistQuestion(
    questionType: string,
    correctAnswer: string | undefined,
    options: unknown,
): string | null {
    if (
        questionType !== "ordering"
        && questionType !== "multi_select"
        && questionType !== "slider"
        && questionType !== "short_response"
    ) {
        return null;
    }

    if (questionType === "ordering") {
        if (!isRecord(options) || !Array.isArray(options.items)) {
            return "ordering requires options.items to be an array";
        }

        const items = options.items.map((item) => typeof item === "string" ? item.trim() : "");
        if (items.length < 3) {
            return "ordering requires at least 3 items";
        }
        if (items.some((item) => !item)) {
            return "ordering items must be non-empty strings";
        }
        const normalizedItems = items.map((item) => item.toLocaleLowerCase());
        if (new Set(normalizedItems).size !== items.length) {
            return "ordering items must be unique";
        }
        if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
            return "ordering requires a non-empty pipe-delimited correctAnswer";
        }

        const answerParts = correctAnswer.split("|").map((part) => part.trim());
        if (
            answerParts.some((part) => !part)
            || answerParts.length !== items.length
            || new Set(answerParts).size !== answerParts.length
            || answerParts.some((part) => !items.includes(part))
        ) {
            return "ordering correctAnswer must list each item exactly once, pipe-delimited";
        }
        return null;
    }

    if (questionType === "multi_select") {
        if (!isRecord(options) || !Array.isArray(options.choices)) {
            return "multi_select requires options.choices to be an array";
        }

        const choices = options.choices.map((choice) => typeof choice === "string" ? choice.trim() : "");
        if (choices.length < 3) {
            return "multi_select requires at least 3 choices";
        }
        if (choices.some((choice) => !choice)) {
            return "multi_select choices must be non-empty strings";
        }
        const normalizedChoices = choices.map((choice) => choice.toLocaleLowerCase());
        if (new Set(normalizedChoices).size !== choices.length) {
            return "multi_select choices must be unique";
        }
        if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
            return "multi_select requires a non-empty pipe-delimited correctAnswer";
        }

        const correctChoices = correctAnswer.split("|").map((choice) => choice.trim());
        if (correctChoices.some((choice) => !choice)) {
            return "multi_select correctAnswer must contain non-empty pipe-delimited choices";
        }
        if (new Set(correctChoices).size !== correctChoices.length) {
            return "multi_select correctAnswer choices must be unique";
        }
        if (correctChoices.some((choice) => !choices.includes(choice))) {
            return "multi_select correctAnswer values must be present in choices";
        }
        if (correctChoices.length < 2 || correctChoices.length >= choices.length) {
            return "multi_select requires at least 2 correct and at least 1 incorrect choice";
        }
        return null;
    }

    if (questionType === "slider") {
        if (!isRecord(options)) {
            return "slider requires options with min, max, step, tolerance, and unit";
        }
        if (!isFiniteNumber(options.min) || !isFiniteNumber(options.max) || options.min >= options.max) {
            return "slider requires finite numeric min and max with min less than max";
        }
        if (!isFiniteNumber(options.step) || options.step <= 0) {
            return "slider requires a finite numeric step greater than 0";
        }
        if (!isFiniteNumber(options.tolerance) || options.tolerance < 0) {
            return "slider requires a finite numeric tolerance greater than or equal to 0";
        }
        if (typeof options.unit !== "string" || !options.unit.trim()) {
            return "slider requires a non-empty unit string";
        }
        if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
            return "slider requires a non-empty numeric correctAnswer";
        }
        const correctValue = Number(correctAnswer);
        if (!Number.isFinite(correctValue) || correctValue < options.min || correctValue > options.max) {
            return "slider correctAnswer must be a finite number within min and max";
        }
        return null;
    }

    if (!isRecord(options) || typeof options.rubric !== "string" || !options.rubric.trim()) {
        return "short_response requires a non-empty rubric";
    }
    if (options.maxWords !== undefined && (
        !isFiniteNumber(options.maxWords)
        || !Number.isInteger(options.maxWords)
        || options.maxWords <= 0
    )) {
        return "short_response maxWords must be a positive integer";
    }
    if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
        return "short_response requires a non-empty correctAnswer";
    }
    return null;
}


router.get("/games/:gameId/questions", requireAuth, async (req, res): Promise<void> => {
    const params = ListGameQuestionsParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }

    if (!await assertGameOwnership(req, res, params.data.gameId)) return;

    const [game, questions] = await Promise.all([
        db.select({ status: gamesTable.status })
            .from(gamesTable)
            .where(eq(gamesTable.id, params.data.gameId))
            .limit(1)
            .then((rows) => rows[0]),
        db.select()
            .from(questionsTable)
            .where(eq(questionsTable.gameId, params.data.gameId))
            .orderBy(asc(questionsTable.orderIndex)),
    ]);

    if (!game) {
        res.status(404).json({ error: "Game not found" });
        return;
    }

    const isAdmin = req.session.isAdmin === true;
    // Reveal correct answers once the game is over — safe to show players their results
    const revealAnswers = isAdmin || game.status === "completed";

    const decoded = questions.map(decodeQuestionFields);
    const response = revealAnswers
        ? decoded
        : decoded.map(({ correctAnswer: _ca, ...rest }) => rest);


 res.json(ListGameQuestionsResponse.parse(response));
});


router.post("/games/:gameId/questions", requireAdmin, async (req, res): Promise<void> =>{
 const params = CreateQuestionParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }


 const parsed = CreateQuestionBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
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

 const specialistError = validateSpecialistQuestion(
     parsed.data.questionType,
     parsed.data.correctAnswer,
     parsed.data.options,
 );
 if (specialistError) {
     res.status(400).json({ error: specialistError });
     return;
 }

// Content filter: block slurs/hate speech in question text and answers
// before anything is written to the database.
{
  const textsToCheck: Array<string | null | undefined> = [
    parsed.data.questionText,
    parsed.data.correctAnswer,
    ...extractOptionTexts(parsed.data.options),
  ];
  if (anyContainsBannedContent(textsToCheck)) {
    logFlaggedContent('question_content_create');
    res.status(422).json({ error: COPY.contentFilter.questionContent, code: "content_filtered" });
    return;
  }
}

const [question] = await db
    .insert(questionsTable)
    .values({
     gameId: game.id,
     questionText: parsed.data.questionText,
     questionType: parsed.data.questionType,
     correctAnswer: parsed.data.correctAnswer,
     options: parsed.data.options ?? null,
     imageUrl: parsed.data.imageUrl ?? null,
     points: parsed.data.points,
     orderIndex: parsed.data.orderIndex,
    })
    .returning();
 await syncQuestionCount(game.id);


 res.status(201).json(CreateQuestionResponse.parse(question));
});


router.patch("/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
 const params = UpdateQuestionParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }

 const parsed = UpdateQuestionBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }

 // Resolve the question's parent game so we can enforce ownership before mutating.
  const [existing] = await db
      .select()
     .from(questionsTable)
     .where(eq(questionsTable.id, params.data.questionId))
     .limit(1);

 if (!existing) {
     res.status(404).json({ error: "Question not found" });
     return;
 }

 if (!await assertGameOwnership(req, res, existing.gameId)) return;

  const specialistError = validateSpecialistQuestion(
      parsed.data.questionType ?? existing.questionType,
      parsed.data.correctAnswer ?? existing.correctAnswer,
      parsed.data.options !== undefined ? parsed.data.options : existing.options,
  );
  if (specialistError) {
      res.status(400).json({ error: specialistError });
      return;
  }

 // Content filter: block slurs/hate speech in any updated field before
 // the database row is mutated. Only checks fields present in this request.
 {
   const textsToCheck: Array<string | null | undefined> = [];
   if (parsed.data.questionText) textsToCheck.push(parsed.data.questionText);
   if (parsed.data.correctAnswer) textsToCheck.push(parsed.data.correctAnswer);
   if (parsed.data.options) textsToCheck.push(...extractOptionTexts(parsed.data.options));
   if (anyContainsBannedContent(textsToCheck)) {
     logFlaggedContent('question_content_update');
     res.status(422).json({ error: COPY.contentFilter.questionContent, code: "content_filtered" });
     return;
   }
 }

 const [question] = await db
     .update(questionsTable)
     .set(parsed.data)
     .where(eq(questionsTable.id, params.data.questionId))
     .returning();

 if (!question) {
     res.status(404).json({ error: "Question not found" });
     return;
 }

 res.json(UpdateQuestionResponse.parse(question));
});


router.delete("/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
 const params = DeleteQuestionParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }

 // Resolve the question's parent game so we can enforce ownership before deleting.
 const [existing] = await db
     .select({ gameId: questionsTable.gameId })
     .from(questionsTable)
     .where(eq(questionsTable.id, params.data.questionId))
     .limit(1);

 if (!existing) {
     res.status(404).json({ error: "Question not found" });
     return;
 }

 if (!await assertGameOwnership(req, res, existing.gameId)) return;

 const [question] = await db
     .delete(questionsTable)
     .where(eq(questionsTable.id, params.data.questionId))
     .returning();

 if (!question) {
     res.status(404).json({ error: "Question not found" });
     return;
 }

 await syncQuestionCount(question.gameId);

 res.sendStatus(204);
});


export default router;


