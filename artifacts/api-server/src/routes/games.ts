
import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import {
 db,
 gamesTable,
 gameParticipantsTable,
} from "@workspace/db";
import { safeEmit } from "../lib/socket";
import {
 ListGamesQueryParams,
 ListGamesResponse,
 CreateGameBody,
 CreateGameResponse,
 GetGameParams,
 GetGameResponse,
 UpdateGameParams,
 UpdateGameBody,
 UpdateGameResponse,
 DeleteGameParams,
} from "@workspace/api-zod";
import { toJsonSafe } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { generateAccessCode } from "../lib/bootstrapAccessCodes";


const router: IRouter = Router();


router.get("/games", requireAuth, async (req, res): Promise<void> => {
 const query = ListGamesQueryParams.safeParse(req.query);
 if (!query.success) {
     res.status(400).json({ error: query.error.message });
     return;
 }


 const status = query.data.status;
 const games = status
     ? await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.status, status))
      .orderBy(desc(gamesTable.createdAt))
     : await db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));


 // Access codes are admin-only — never expose them to players
 const sanitized = req.session.isAdmin === true
     ? games
     : games.map((g) => ({ ...g, accessCode: null }));
 res.json(ListGamesResponse.parse(toJsonSafe(sanitized)));
});


// Game access codes use the shared CSPRNG-backed generator (crypto.randomBytes)
// with an unambiguous alphabet; 10 chars of a 31-char alphabet ≈ 49 bits entropy.
function randomAccessCode(): string {
 return generateAccessCode(10);
}

router.post("/games", requireAdmin, async (req, res): Promise<void> => {
 const parsed = CreateGameBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }


 // Retry on the (rare) unique-constraint collision
 let game;
 for (let attempt = 0; attempt < 5; attempt++) {
  try {
   [game] = await db
    .insert(gamesTable)
    .values({
     topic: parsed.data.topic.trim(),
     difficulty: parsed.data.difficulty,
     createdByAdmin: parsed.data.createdByAdmin ?? true,
     accessCode: randomAccessCode(),
     brief: parsed.data.brief ?? null,
    })
    .returning();
   break;
  } catch (err) {
   const code = (err as { code?: string }).code;
   if (code !== "23505" || attempt === 4) throw err;
  }
 }


 res.status(201).json(CreateGameResponse.parse(toJsonSafe(game)));
});


router.get("/games/:gameId", requireAuth, async (req, res): Promise<void> => {
 const params = GetGameParams.safeParse(req.params);
if (!params.success) {
    res.status(400).json({ error: params.error.message });
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


const [participants] = await db
    .select({ value: count() })
    .from(gameParticipantsTable)
    .where(eq(gameParticipantsTable.gameId, game.id));


res.json(
    GetGameResponse.parse(toJsonSafe({
     ...game,
     accessCode: req.session.isAdmin === true ? game.accessCode : null,
     participantCount: participants?.value ?? 0,
    })),
);
});


router.patch("/games/:gameId", requireAdmin, async (req, res): Promise<void> => {
 const params = UpdateGameParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }


 const parsed = UpdateGameBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }


 const [game] = await db
     .update(gamesTable)
     .set(parsed.data)
     .where(eq(gamesTable.id, params.data.gameId))
     .returning();


 if (!game) {
     res.status(404).json({ error: "Game not found" });
     return;
 }
 res.json(UpdateGameResponse.parse(toJsonSafe(game)));


 // Real-time: notify relevant rooms when status changes
 if (game.status === "active") {
     safeEmit("lobby", "game:started", { gameId: game.id, topic: game.topic });
 } else if (game.status === "completed") {
     safeEmit(`game:${game.id}`, "game:ended", { gameId: game.id });
 }
});


router.delete("/games/:gameId", requireAdmin, async (req, res): Promise<void> => {
 const params = DeleteGameParams.safeParse(req.params);
 if (!params.success) {
     res.status(400).json({ error: params.error.message });
     return;
 }


 const [game] = await db
     .delete(gamesTable)
     .where(eq(gamesTable.id, params.data.gameId))
     .returning();


 if (!game) {
     res.status(404).json({ error: "Game not found" });
     return;
 }
 res.sendStatus(204);
});


export default router;


