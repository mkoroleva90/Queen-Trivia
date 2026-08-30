
import { Router, type IRouter } from "express";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import {
    db,
    usersTable,
    gamesTable,
    gameAccessGrantsTable,
    removedParticipantsTable,
} from "@workspace/db";
import { toJsonSafe } from "../lib/serialize.ts";
import { triviaJoinRateLimit } from "../middleware/authRateLimit.ts";
import { generateMobileToken } from "../lib/mobileAuth.ts";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";
import { PlayerLoginBody } from "@workspace/api-zod";


const router: IRouter = Router();
// POST /api/auth/login — verify per-game code + create/retrieve user, start session.
// A successful room-code check creates a durable server-side grant. Session and
// mobile-token claims are deliberately not used to authorize games.
router.post("/auth/login", triviaJoinRateLimit, async (req, res): Promise<void> => {
const parsed = PlayerLoginBody.safeParse(req.body);
if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten().fieldErrors });
    return;
}
const code = parsed.data.code.trim();
const normalizedCode = code.toUpperCase();
const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";

if (!code) {
    res.status(400).json({ error: "Access code is required" });
    return;
}

// ── Fresh login path: name is required ──
if (!req.session.userId && !name) {
    res.status(400).json({ error: "Name and access code are required" });
    return;
}
if (!req.session.userId && name.length > 50) {
    res.status(400).json({ error: "Name must be 50 characters or fewer" });
    return;
}

// Content filter: block slurs/hate speech in display names before saving.
if (!req.session.userId && containsBannedContent(name)) {
    logFlaggedContent('player_name');
    res.status(422).json({ error: COPY.contentFilter.playerName, code: "content_filtered" });
    return;
}

const sessionUserId = req.session.userId;
const loginResult = await db.transaction(async (tx) => {
    // Lock the game row so a kick or room-code rotation cannot interleave
    // between code validation and writing the durable grant.
    const matchedGames = await tx
        .select({
            id: gamesTable.id,
            accessCodeChangedAt: gamesTable.accessCodeChangedAt,
        })
        .from(gamesTable)
        .where(and(
            sql`upper(${gamesTable.accessCode}) = ${normalizedCode}`,
            ne(gamesTable.status, "completed"),
        ))
        .limit(2)
        .for("update");

    // Legacy rows may differ only by case even though new writes are
    // normalized. Never choose an arbitrary game when the folded code is
    // ambiguous.
    if (matchedGames.length !== 1) return { kind: "invalid" as const };
    const matchedGame = matchedGames[0]!;

    const [removalSinceCodeChange] = await tx
        .select({ id: removedParticipantsTable.id })
        .from(removedParticipantsTable)
        .where(
            matchedGame.accessCodeChangedAt == null
                ? eq(removedParticipantsTable.gameId, matchedGame.id)
                : and(
                    eq(removedParticipantsTable.gameId, matchedGame.id),
                    gt(removedParticipantsTable.removedAt, matchedGame.accessCodeChangedAt),
                ),
        )
        .limit(1);

    // Never recreate a grant for a revoked code, including for a session that
    // was opened before the kick.
    if (removalSinceCodeChange) return { kind: "revoked" as const };

    if (sessionUserId) {
        const [existingUser] = await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, sessionUserId));
        if (!existingUser) return { kind: "missing-user" as const };

        await tx
            .insert(gameAccessGrantsTable)
            .values({ gameId: matchedGame.id, userId: existingUser.id })
            .onConflictDoNothing();
        return { kind: "existing" as const, gameId: matchedGame.id, user: existingUser };
    }

    // Always create a new user row — name is a display label, not an identity
    // key. Reusing by name would let callers impersonate another player.
    const [user] = await tx.insert(usersTable).values({ name }).returning();
    await tx
        .insert(gameAccessGrantsTable)
        .values({ gameId: matchedGame.id, userId: user!.id });
    return { kind: "fresh" as const, gameId: matchedGame.id, user: user! };
});

if (loginResult.kind === "invalid") {
    res.status(401).json({ error: "Invalid access code" });
    return;
}
if (loginResult.kind === "revoked") {
    res.status(403).json({ error: COPY.kick.rejoinBlocked });
    return;
}
if (loginResult.kind === "missing-user") {
    res.status(401).json({ error: "Session user not found" });
    return;
}

if (loginResult.kind === "existing") {
    req.session.save((err) => {
        if (err) {
            res.status(500).json({ error: "Failed to save session" });
            return;
        }
        const mobileToken = generateMobileToken(loginResult.user.id);
        res.json(toJsonSafe({
            id: loginResult.user.id,
            name: loginResult.user.name,
            gameId: loginResult.gameId,
            mobileToken,
        }));
    });
    return;
}

 // Regenerate the session ID on login to prevent session fixation attacks.
 req.session.regenerate((err) => {
     if (err) {
         res.status(500).json({ error: "Failed to establish session" });
         return;
     }
      req.session.userId = loginResult.user.id;
      req.session.userName = loginResult.user.name;
     req.session.isAdmin = false;

       const mobileToken = generateMobileToken(loginResult.user.id);
      res.json(toJsonSafe({
          id: loginResult.user.id,
          name: loginResult.user.name,
          gameId: loginResult.gameId,
          mobileToken,
      }));
 });
});


// GET /api/auth/me — return current session user (null if not logged in)
router.get("/auth/me", async (req, res): Promise<void> => {
 if (!req.session.userId) {
     res.json({ user: null, isAdmin: false });
     return;
 }


 const [user] = await db
     .select()
     .from(usersTable)
     .where(eq(usersTable.id, req.session.userId));


 if (!user) {
     req.session.destroy(() => {});
     res.json({ user: null, isAdmin: false });
     return;
 }
 res.json(toJsonSafe({ user: { id: user.id, name: user.name }, isAdmin: false }));
});


// POST /api/auth/logout — clear player session
router.post("/auth/logout", (req, res): void => {
 req.session.destroy(() => {
     res.clearCookie("connect.sid");
     res.json({ ok: true });
 });
});


// POST /api/admin/login — removed.
// Host login is now email + password only (POST /api/auth/email/login for web,
// POST /api/auth/email/admin-mobile-login for mobile).
// The shared ADMIN_ACCESS_KEY is reserved for the owner dashboard only.
router.post("/admin/login", (_req, res): void => {
  res.status(410).json({ error: "Shared access-code login is no longer supported. Please sign in with your email and password." });
});


// GET /api/admin/me — return admin session state
router.get("/admin/me", (req, res): void => {
 res.json({ isAdmin: req.session.isAdmin === true });
});


// POST /api/admin/logout — clear admin session
router.post("/admin/logout", (req, res): void => {
 req.session.destroy(() => {
     res.clearCookie("connect.sid");
     res.json({ ok: true });
 });
});


export default router;
