
import { Router, type IRouter } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, gamesTable, removedParticipantsTable } from "@workspace/db";
import {
  VerifyAccessCodeBody,
  VerifyAccessCodeResponse,
} from "@workspace/api-zod";
import { authRateLimit } from "../middleware/authRateLimit.ts";


const router: IRouter = Router();


// POST /api/auth/verify — verify a per-game access code.
// Only per-game codes are accepted; the global trivia access code concept
// has been removed. Returns valid=true with a gameId on success.
router.post("/auth/verify", authRateLimit, async (req, res): Promise<void> => {
  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = parsed.data.code.trim();

  // Per-game access codes: match a non-completed game's code case-insensitively,
  // including legacy rows that were stored before normalization.
  const matchingGames = await db
    .select()
    .from(gamesTable)
    .where(and(
      sql`upper(${gamesTable.accessCode}) = ${code.toUpperCase()}`,
      ne(gamesTable.status, "completed"),
    ))
    .limit(2);

  if (matchingGames.length === 1) {
    const game = matchingGames[0]!;
    const [removal] = await db
      .select({ id: removedParticipantsTable.id })
      .from(removedParticipantsTable)
      .where(eq(removedParticipantsTable.gameId, game.id))
      .limit(1);

    if (removal) {
      res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
      return;
    }

    res.json(
      VerifyAccessCodeResponse.parse({
        valid: true,
        role: "player",
        gameId: game.id,
        gameTopic: game.topic,
      }),
    );
    return;
  }

  res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
});


export default router;
