
import { Router, type IRouter } from "express";
import { and, eq, desc, count } from "drizzle-orm";
import {
 db,
 gamesTable,
 gameParticipantsTable,
 adminAccountsTable,
 usersTable,
} from "@workspace/db";
import { safeEmit } from "../lib/socket.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
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
import { toJsonSafe } from "../lib/serialize.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { generateTriviaCode } from "../lib/bootstrapAccessCodes.ts";
import { checkGameCreationLimit } from "../lib/usageLimits.ts";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";


const router: IRouter = Router();


router.get("/games", requireAuth, async (req, res): Promise<void> => {
 const query = ListGamesQueryParams.safeParse(req.query);
 if (!query.success) {
     res.status(400).json({ error: query.error.message });
     return;
 }

 const status = query.data.status;
 const ownerAdminId = req.session.adminAccountId;

 // Email-auth admins see only their own games.
 // Code-based (legacy) admins and players see all games.
 const ownerFilter = ownerAdminId != null
     ? eq(gamesTable.ownerAdminId, ownerAdminId)
     : undefined;

 const statusFilter = status ? eq(gamesTable.status, status) : undefined;
 const whereClause = ownerFilter && statusFilter
     ? and(ownerFilter, statusFilter)
     : ownerFilter ?? statusFilter;

 const games = whereClause
     ? await db.select().from(gamesTable).where(whereClause).orderBy(desc(gamesTable.createdAt))
     : await db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));

 // Participant counts per game
 const participantCounts = await db
     .select({ gameId: gameParticipantsTable.gameId, value: count() })
     .from(gameParticipantsTable)
     .groupBy(gameParticipantsTable.gameId);
 const countMap = new Map(participantCounts.map((c) => [c.gameId, c.value]));

 // Access codes are admin-only — never expose them to players
 const sanitized = games.map((g) => ({
     ...g,
     accessCode: req.session.isAdmin === true ? g.accessCode : null,
     participantCount: countMap.get(g.id) ?? 0,
 }));
 res.json(ListGamesResponse.parse(toJsonSafe(sanitized)));
});


// Game access codes use the shared CSPRNG-backed generator (crypto.randomBytes)
// with an unambiguous alphabet; 10 chars of a 31-char alphabet ≈ 49 bits entropy.
// Per-game access codes use the same unambiguous alphabet as trivia codes but
// at 10 characters for higher entropy (game codes are shared less widely).
function randomAccessCode(): string {
 return generateTriviaCode(10);
}

router.post("/games", requireAdmin, async (req, res): Promise<void> => {
 const parsed = CreateGameBody.safeParse(req.body);
 if (!parsed.success) {
     res.status(400).json({ error: parsed.error.message });
     return;
 }

 // Content filter: block slurs/hate speech in game titles before saving.
 if (containsBannedContent(parsed.data.topic)) {
     logFlaggedContent('game_topic_create');
     res.status(422).json({ error: COPY.contentFilter.gameTopic, code: "content_filtered" });
     return;
 }

 // Free-tier game creation limit (enforcement gated by ENFORCE_FREE_TIER_LIMITS env var).
 const limitError = await checkGameCreationLimit(req.session.adminAccountId);
 if (limitError) {
     res.status(429).json({ error: limitError });
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
     ownerAdminId: req.session.adminAccountId ?? null,
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

if (!await assertGameOwnership(req, res, params.data.gameId)) return;

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

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

 // Content filter: block slurs/hate speech in game title updates before saving.
 if (parsed.data.topic !== undefined && containsBannedContent(parsed.data.topic)) {
     logFlaggedContent('game_topic_update');
     res.status(422).json({ error: COPY.contentFilter.gameTopic, code: "content_filtered" });
     return;
 }

 // Normalize custom room codes to uppercase — players enter codes uppercased.
 const updates = parsed.data.accessCode !== undefined
     ? { ...parsed.data, accessCode: parsed.data.accessCode.trim().toUpperCase() }
     : parsed.data;

 let game;
 try {
  [game] = await db
      .update(gamesTable)
      .set(updates)
      .where(eq(gamesTable.id, params.data.gameId))
      .returning();
 } catch (err) {
  // Unique-constraint violation: another game already uses this room code.
  // Drizzle may wrap the pg error, so check the cause chain too.
  const pgCode = (err as { code?: string }).code
      ?? ((err as { cause?: { code?: string } }).cause?.code);
  if (pgCode === "23505") {
      res.status(409).json({ error: "That room code is already in use by another game" });
      return;
  }
  throw err;
 }

 if (!game) {
     res.status(404).json({ error: "Game not found" });
     return;
 }

 // Play-along: when the game just went active with hostPlaysAlong on and the
 // host player record hasn't been created yet, auto-create a player-user for
 // the admin and register them as a game participant.
 if (game.status === "active" && game.hostPlaysAlong && !game.hostUserId && req.session.adminAccountId) {
     const [admin] = await db
         .select({ email: adminAccountsTable.email })
         .from(adminAccountsTable)
         .where(eq(adminAccountsTable.id, req.session.adminAccountId));
     const localPart = (admin?.email ?? "host").split("@")[0] ?? "host";
     const hostName =
         localPart.charAt(0).toUpperCase() + localPart.slice(1) + " (Host)";
     const [hostUser] = await db
         .insert(usersTable)
         .values({ name: hostName })
         .returning();
     if (hostUser) {
         await db
             .insert(gameParticipantsTable)
             .values({ gameId: game.id, userId: hostUser.id });
         const [updated] = await db
             .update(gamesTable)
             .set({ hostUserId: hostUser.id })
             .where(eq(gamesTable.id, game.id))
             .returning();
         if (updated) game = updated;
     }
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

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

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
