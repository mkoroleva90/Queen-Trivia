
import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import {
 db,
 gamesTable,
 usersTable,
answersTable,
} from "@workspace/db";
import { GetStatsSummaryResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin";


const router: IRouter = Router();


router.get("/stats/summary", requireAdmin, async (_req, res): Promise<void> => {
const [totalGames] = await db.select({ value: count() }).from(gamesTable);
const [activeGames] = await db
 .select({ value: count() })
 .from(gamesTable)
 .where(eq(gamesTable.status, "active"));
const [totalPlayers] = await db.select({ value: count() }).from(usersTable);
const [totalAnswers] = await db
 .select({ value: count() })
 .from(answersTable);


res.json(
 GetStatsSummaryResponse.parse({
     totalGames: totalGames?.value ?? 0,
     activeGames: activeGames?.value ?? 0,
     totalPlayers: totalPlayers?.value ?? 0,
     totalAnswers: totalAnswers?.value ?? 0,
 }),
);
});


export default router;


