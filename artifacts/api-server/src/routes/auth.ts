
import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, adminSettingsTable, gamesTable } from "@workspace/db";
import {
  VerifyAccessCodeBody,
  VerifyAccessCodeResponse,
} from "@workspace/api-zod";
import { authRateLimit } from "../middleware/authRateLimit.ts";


const router: IRouter = Router();


// POST /api/auth/verify — verify a trivia or per-game access code.
// The trivia access code is compared case-insensitively so players who type
// lower-case on a phone still join successfully.
router.post("/auth/verify", authRateLimit, async (req, res): Promise<void> => {
  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }


  const [settings] = await db.select().from(adminSettingsTable).limit(1);


  if (!settings) {
    res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
    return;
  }


  const code = parsed.data.code.trim();

  // Case-insensitive match against the global trivia access code
  if (code.toUpperCase() === settings.triviaAccessCode.toUpperCase()) {
    res.json(VerifyAccessCodeResponse.parse({ valid: true, role: "player" }));
    return;
  }


  // Per-game access codes: match a non-completed game's code (case-insensitive)
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(and(
      eq(gamesTable.accessCode, code.toUpperCase()),
      ne(gamesTable.status, "completed"),
    ))
    .limit(1);

  // Fallback: exact-case match (for codes set before normalisation)
  const [gameFallback] = !game
    ? await db
        .select()
        .from(gamesTable)
        .where(and(eq(gamesTable.accessCode, code), ne(gamesTable.status, "completed")))
        .limit(1)
    : [undefined];

  const matched = game ?? gameFallback;

  if (matched) {
    res.json(
      VerifyAccessCodeResponse.parse({
        valid: true,
        role: "player",
        gameId: matched.id,
        gameTopic: matched.topic,
      }),
    );
    return;
  }


  res.json(VerifyAccessCodeResponse.parse({ valid: false, role: "none" }));
});


export default router;
