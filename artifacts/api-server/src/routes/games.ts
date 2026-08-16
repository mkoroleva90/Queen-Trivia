
import { Router, type IRouter } from "express";
import { and, or, eq, desc, count } from "drizzle-orm";
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
import { requireUser } from "../middleware/requireUser.ts";
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

// Host-chosen custom join codes: 6–12 characters, letters and digits only
// (case-insensitive input; uppercased before storing). Applies only to newly
// entered codes — existing games are never re-validated.
const CUSTOM_ACCESS_CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;
const INVALID_ACCESS_CODE_MESSAGE =
 "Join code must be 6\u201312 characters using only letters A\u2013Z and numbers 0\u20139, with no spaces.";

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

 // Optional host-chosen join code. Not yet part of the generated CreateGameBody
 // contract (zod strips unknown keys), so read it straight from the request body.
 // Empty/absent → keep the existing random generation unchanged.
 const rawAccessCode = (req.body as { accessCode?: unknown } | undefined)?.accessCode;
 let customAccessCode: string | undefined;
 if (rawAccessCode !== undefined && rawAccessCode !== null && rawAccessCode !== "") {
  // Validate the raw value (no trimming) so create matches PATCH, whose
  // generated body schema rejects surrounding whitespace outright.
  if (typeof rawAccessCode !== "string" || !CUSTOM_ACCESS_CODE_PATTERN.test(rawAccessCode)) {
   res.status(400).json({ error: INVALID_ACCESS_CODE_MESSAGE, code: "invalid_access_code" });
   return;
  }
  const candidate = rawAccessCode.toUpperCase();
  // Content filter: block slurs/hate speech (incl. leet-speak) in custom codes.
  if (containsBannedContent(candidate)) {
   logFlaggedContent('game_access_code_create');
   res.status(422).json({ error: COPY.contentFilter.accessCode, code: "content_filtered" });
   return;
  }
  customAccessCode = candidate;
 }

 // Retry on the (rare) unique-constraint collision — random codes only; a
 // host-chosen code that collides is a real conflict reported as 409 below.
 let game;
 for (let attempt = 0; attempt < 5; attempt++) {
  try {
   [game] = await db
    .insert(gamesTable)
    .values({
     topic: parsed.data.topic.trim(),
     difficulty: parsed.data.difficulty,
     createdByAdmin: parsed.data.createdByAdmin ?? true,
     accessCode: customAccessCode ?? randomAccessCode(),
     brief: parsed.data.brief ?? null,
     ownerAdminId: req.session.adminAccountId ?? null,
    })
    .returning();
   break;
  } catch (err) {
   const code = (err as { code?: string }).code
    ?? ((err as { cause?: { code?: string } }).cause?.code);
   if (code === "23505" && customAccessCode !== undefined) {
    res.status(409).json({ error: "That room code is already in use by another game" });
    return;
   }
   if (code !== "23505" || attempt === 4) throw err;
  }
 }


 res.status(201).json(CreateGameResponse.parse(toJsonSafe({ ...game, participantCount: 0 })));
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

 // Newly entered custom room codes must match the shared rule: 6–12 chars,
 // A–Z / 0–9 only (the generated body schema allows 4+, so enforce here too).
 if (parsed.data.accessCode !== undefined
     && !CUSTOM_ACCESS_CODE_PATTERN.test(parsed.data.accessCode.trim())) {
     res.status(400).json({ error: INVALID_ACCESS_CODE_MESSAGE, code: "invalid_access_code" });
     return;
 }

 // Content filter: block slurs/hate speech (incl. leet-speak) in custom codes.
 if (parsed.data.accessCode !== undefined
     && containsBannedContent(parsed.data.accessCode.trim().toUpperCase())) {
     logFlaggedContent('game_access_code_update');
     res.status(422).json({ error: COPY.contentFilter.accessCode, code: "content_filtered" });
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

 const [pCount] = await db
     .select({ value: count() })
     .from(gameParticipantsTable)
     .where(eq(gameParticipantsTable.gameId, game.id));
 res.json(UpdateGameResponse.parse(toJsonSafe({ ...game, participantCount: pCount?.value ?? 0 })));

 // Real-time: notify relevant rooms when status changes
 if (game.status === "active") {
     safeEmit("lobby", "game:started", { gameId: game.id, topic: game.topic });
 } else if (game.status === "completed") {
     safeEmit(`game:${game.id}`, "game:ended", { gameId: game.id });
 }
});


// ─── Next-game-by-host (player-facing, no auth required) ─────────────────────
// Given a completed game, returns the first waiting/active game by the same
// host (excluding the current game). Used to power the mobile bridge button.
router.get("/games/:gameId/next-by-host", async (req, res): Promise<void> => {
 const gameId = parseInt(String(req.params['gameId'] ?? ""), 10);
 if (!gameId || isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }

 const [current] = await db.select({ ownerAdminId: gamesTable.ownerAdminId })
   .from(gamesTable).where(eq(gamesTable.id, gameId));
 if (!current || current.ownerAdminId == null) { res.json({ game: null }); return; }

 const [next] = await db.select({ id: gamesTable.id, topic: gamesTable.topic, status: gamesTable.status })
   .from(gamesTable)
   .where(and(
     eq(gamesTable.ownerAdminId, current.ownerAdminId),
     or(eq(gamesTable.status, "waiting"), eq(gamesTable.status, "active")),
     // exclude the current game
   ))
   .orderBy(desc(gamesTable.createdAt))
   .limit(1);

 const game = next && next.id !== gameId ? next : null;
 res.json({ game: game ? toJsonSafe(game) : null });
});


// ─── Bridge-to-next (requireUser — adds next game to session allowedGameIds) ──
// Verifies the calling player is a participant of the current game, then finds
// the next game by the same host and adds it to the session so the player can
// call POST /games/:nextId/join without a room code.
router.post("/games/:gameId/bridge-to-next", requireUser, async (req, res): Promise<void> => {
 const gameId = parseInt(String(req.params['gameId'] ?? ""), 10);
 if (!gameId || isNaN(gameId)) { res.status(400).json({ error: "Invalid gameId" }); return; }

 const userId = req.session.userId!;

 // Verify the player is a participant of the current game.
 const [participant] = await db.select({ id: gameParticipantsTable.id })
   .from(gameParticipantsTable)
   .where(and(eq(gameParticipantsTable.gameId, gameId), eq(gameParticipantsTable.userId, userId)));
 if (!participant) { res.status(403).json({ error: "Not a participant of this game" }); return; }

 // Find the next game by the same host.
 const [current] = await db.select({ ownerAdminId: gamesTable.ownerAdminId })
   .from(gamesTable).where(eq(gamesTable.id, gameId));
 if (!current || current.ownerAdminId == null) { res.json({ game: null }); return; }

 const [next] = await db.select({ id: gamesTable.id, topic: gamesTable.topic, status: gamesTable.status })
   .from(gamesTable)
   .where(and(
     eq(gamesTable.ownerAdminId, current.ownerAdminId),
     or(eq(gamesTable.status, "waiting"), eq(gamesTable.status, "active")),
   ))
   .orderBy(desc(gamesTable.createdAt))
   .limit(1);

 if (!next || next.id === gameId) { res.json({ game: null }); return; }

 // Grant session access to the next game so the player can call POST /join.
 const existing: number[] = req.session.allowedGameIds ?? [];
 if (!existing.includes(next.id)) {
   req.session.allowedGameIds = [...existing, next.id];
 }

 res.json({ game: toJsonSafe(next) });
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
