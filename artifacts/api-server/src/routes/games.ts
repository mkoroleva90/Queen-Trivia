
import { Router, type IRouter } from "express";
import { and, or, eq, desc, count, inArray, isNull } from "drizzle-orm";
import {
 db,
 gamesTable,
 gameParticipantsTable,
  gameAccessGrantsTable,
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


// ── Host name resolution ──────────────────────────────────────────────────────

/** Apple private-relay domains — addresses from these must never be used as a name source. */
const APPLE_RELAY_DOMAINS = new Set(["privaterelay.appleid.com"]);

/**
 * Resolve a leaderboard name for a host who is playing along.
 *
 * Priority order:
 *   1. Stored displayName — if non-empty after trimming.
 *   2. Email local-part, title-cased — as long as the address is not an
 *      Apple private-relay address. No additional heuristics are applied;
 *      the domain check is the reliable signal.
 *   3. Generic host label — when nothing usable could be derived.
 *
 * The " (Host)" suffix (from COPY) is appended for cases 1 and 2 so players
 * can tell who is running the game. It is NOT appended for case 3 to avoid
 * the redundant "Host (Host)" label.
 */
function resolveHostName(displayName: string | null, email: string | null): string {
    const suffix  = COPY.hostName.suffix;
    const generic = COPY.hostName.generic;

    // Priority 1: stored display name
    const trimmedDisplay = displayName?.trim() ?? "";
    if (trimmedDisplay) return `${trimmedDisplay}${suffix}`;

    // Priority 2: email local-part, if the address is usable
    if (email) {
        const atIdx    = email.indexOf("@");
        const domain   = atIdx >= 0 ? email.slice(atIdx + 1).toLowerCase() : "";
        const localPart = atIdx >= 0 ? email.slice(0, atIdx) : "";
        if (
            domain &&
            !APPLE_RELAY_DOMAINS.has(domain) &&
            localPart
        ) {
            const titled = localPart.charAt(0).toUpperCase() + localPart.slice(1);
            return `${titled}${suffix}`;
        }
    }

    // Priority 3: generic label — no suffix
    return generic;
}

// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();


router.get("/games", requireAuth, async (req, res): Promise<void> => {
 const query = ListGamesQueryParams.safeParse(req.query);
 if (!query.success) {
     res.status(400).json({ error: query.error.message });
     return;
 }

  const status = query.data.status;
  let games: Array<typeof gamesTable.$inferSelect>;

  if (req.session.isAdmin === true) {
    const ownerAdminId = req.session.adminAccountId;
    // Scoped email-auth admins see only their own games. A legacy session has
    // no tenant identity, so it may see only ownerless migration games.
    const ownerFilter = ownerAdminId != null
        ? eq(gamesTable.ownerAdminId, ownerAdminId)
        : isNull(gamesTable.ownerAdminId);
    const statusFilter = status ? eq(gamesTable.status, status) : undefined;
    const whereClause = statusFilter ? and(ownerFilter, statusFilter) : ownerFilter;
    games = await db.select().from(gamesTable).where(whereClause).orderBy(desc(gamesTable.createdAt));
  } else {
    const userId = req.session.userId;
    if (userId == null) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // A player may see only games with a server-recorded room-code grant or a
    // participant record. Do not trust client session/token game ID claims:
    // old bridge-to-next requests could have written arbitrary IDs there.
    const [participants, grants] = await Promise.all([
      db
        .select({ gameId: gameParticipantsTable.gameId })
        .from(gameParticipantsTable)
        .where(eq(gameParticipantsTable.userId, userId)),
      db
        .select({ gameId: gameAccessGrantsTable.gameId })
        .from(gameAccessGrantsTable)
        .where(eq(gameAccessGrantsTable.userId, userId)),
    ]);
    const authorizedGameIds = [
      ...new Set([
        ...participants.map(({ gameId }) => gameId),
        ...grants.map(({ gameId }) => gameId),
      ]),
    ];

    if (authorizedGameIds.length === 0) {
      games = [];
    } else {
      const accessFilter = inArray(gamesTable.id, authorizedGameIds);
      const statusFilter = status ? eq(gamesTable.status, status) : undefined;
      const whereClause = statusFilter ? and(accessFilter, statusFilter) : accessFilter;
      games = await db.select().from(gamesTable).where(whereClause).orderBy(desc(gamesTable.createdAt));
    }
  }

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

// Host-chosen custom join codes: 4–12 characters, letters and digits only
// (case-insensitive input; uppercased before storing). Applies only to newly
// entered codes — existing games are never re-validated.
const CUSTOM_ACCESS_CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;
const INVALID_ACCESS_CODE_MESSAGE =
 "Join code must be 4\u201312 characters using only letters A\u2013Z and numbers 0\u20139, with no spaces.";

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
    res.status(409).json({ code: "code_taken", error: "That room code is already in use by another game" });
    return;
   }
   if (code !== "23505" || attempt === 4) throw err;
  }
 }


 res.status(201).json(CreateGameResponse.parse(toJsonSafe({ ...game, participantCount: 0 })));
});


// ─── Code-availability check (no auth required) ──────────────────────────────
// Returns { available: boolean } — true when the code is not in use by any game.
// The caller is responsible for validating format before submitting; this route
// only checks uniqueness so a debounced UI check can inform the host early.
router.get("/games/code-available", async (req, res): Promise<void> => {
 const rawCode = req.query['code'];
 if (typeof rawCode !== "string" || !rawCode.trim()) {
  res.status(400).json({ error: "code query parameter is required" });
  return;
 }
 const code = rawCode.trim().toUpperCase();
 if (!CUSTOM_ACCESS_CODE_PATTERN.test(rawCode.trim())) {
  // Format is invalid — can never be stored, so mark as unavailable
  res.json({ available: false, reason: "format" });
  return;
 }
 const [existing] = await db
  .select({ id: gamesTable.id })
  .from(gamesTable)
  .where(eq(gamesTable.accessCode, code))
  .limit(1);
 res.json({ available: !existing });
});


router.get("/games/:gameId", requireAuth, async (req, res): Promise<void> => {
 const params = GetGameParams.safeParse(req.params);
if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
}

if (!await assertGameOwnership(req, res, params.data.gameId)) return;

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

 if (!await assertGameOwnership(req, res, params.data.gameId)) return;

 // Content filter: block slurs/hate speech in game title updates before saving.
 if (parsed.data.topic !== undefined && containsBannedContent(parsed.data.topic)) {
     logFlaggedContent('game_topic_update');
     res.status(422).json({ error: COPY.contentFilter.gameTopic, code: "content_filtered" });
     return;
 }

 // Newly entered custom room codes must match the shared rule: 4–12 chars,
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
      res.status(409).json({ code: "code_taken", error: "That room code is already in use by another game" });
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
         .select({ email: adminAccountsTable.email, displayName: adminAccountsTable.displayName })
         .from(adminAccountsTable)
         .where(eq(adminAccountsTable.id, req.session.adminAccountId));
     const hostName = resolveHostName(admin?.displayName ?? null, admin?.email ?? null);
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
      safeEmit(`game:${game.id}`, "game:started", { gameId: game.id, topic: game.topic });
 } else if (game.status === "completed") {
     safeEmit(`game:${game.id}`, "game:ended", { gameId: game.id });
 }
});


// ─── Bridge-to-next (retired) ─────────────────────────────────────────────────
// A prior-game participant is not evidence that the host authorized access to
// a different game. There is no explicit host-to-player bridge grant in the
// data model, so this endpoint must never change game authorization state.
router.post("/games/:gameId/bridge-to-next", requireUser, async (req, res): Promise<void> => {
  res.status(410).json({
    error: "Automatic transition is no longer available. Enter the next game's access code to join.",
  });
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
