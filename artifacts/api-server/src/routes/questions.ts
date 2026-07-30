
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
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { assertGameOwnership } from "../lib/assertGameOwnership";


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


router.get("/games/:gameId/questions", requireAuth, async (req, res): Promise<void> => {
    const params = ListGameQuestionsParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }


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

    if (!await assertGameOwnership(req, res, params.data.gameId)) return;

    const isAdmin = req.session.isAdmin === true;
    // Reveal correct answers once the game is over — safe to show players their results
    const revealAnswers = isAdmin || game.status === "completed";

    const response = revealAnswers
        ? questions
        : questions.map(({ correctAnswer: _ca, ...rest }) => rest);


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


