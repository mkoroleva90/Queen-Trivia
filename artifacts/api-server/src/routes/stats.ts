
import { Router, type IRouter } from "express";
import { and, eq, count, sql } from "drizzle-orm";
import {
 db,
 gamesTable,
  answersTable,
  gameParticipantsTable,
} from "@workspace/db";
import { GetStatsSummaryResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin.ts";


const router: IRouter = Router();


router.get("/stats/summary", requireAdmin, async (req, res): Promise<void> => {
  const adminAccountId = req.session.adminAccountId;
  if (adminAccountId == null) {
    res.status(403).json({ error: "Account-backed admin access required" });
    return;
  }

  const ownerFilter = eq(gamesTable.ownerAdminId, adminAccountId);
  const [[totalGames], [activeGames], [totalPlayers], [totalAnswers]] = await Promise.all([
    db.select({ value: count() }).from(gamesTable).where(ownerFilter),
    db
      .select({ value: count() })
      .from(gamesTable)
      .where(and(ownerFilter, eq(gamesTable.status, "active"))),
    db
      .select({
        value: sql<number>`count(distinct ${gameParticipantsTable.userId})`.mapWith(Number),
      })
      .from(gameParticipantsTable)
      .innerJoin(gamesTable, eq(gameParticipantsTable.gameId, gamesTable.id))
      .where(ownerFilter),
    db
      .select({ value: count() })
      .from(answersTable)
      .innerJoin(gamesTable, eq(answersTable.gameId, gamesTable.id))
      .where(ownerFilter),
  ]);


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


