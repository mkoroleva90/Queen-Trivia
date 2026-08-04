
import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, adminSettingsTable, gamesTable } from "@workspace/db";
import {
 VerifyAccessCodeBody,
VerifyAccessCodeResponse,
} from "@workspace/api-zod";
import { authRateLimit } from "../middleware/authRateLimit.ts";


const router: IRouter = Router();


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


 if (code === settings.triviaAccessCode) {
     res.json(VerifyAccessCodeResponse.parse({ valid: true, role: "player" }));
     return;
 }


 // Per-game access codes: match a non-completed game's code
 const [game] = await db
     .select()
     .from(gamesTable)
     .where(and(eq(gamesTable.accessCode, code), ne(gamesTable.status, "completed")))
     .limit(1);
 if (game) {
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


