
import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, usersTable, gamesTable, gameAccessGrantsTable } from "@workspace/db";
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
const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";

if (!code) {
    res.status(400).json({ error: "Access code is required" });
    return;
}


// Per-game access codes: a code tied to a specific (non-completed) game
const [matchedGame] = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(and(eq(gamesTable.accessCode, code.toUpperCase()), ne(gamesTable.status, "completed")))
    .limit(1);

if (!matchedGame) {
    res.status(401).json({ error: "Invalid access code" });
    return;
}


// ── Already-logged-in path: grant this room without regenerating ──────────
if (req.session.userId) {
    const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, req.session.userId));

    if (!existingUser) {
        res.status(401).json({ error: "Session user not found" });
        return;
    }

    await db
        .insert(gameAccessGrantsTable)
        .values({ gameId: matchedGame.id, userId: existingUser.id })
        .onConflictDoNothing();

    req.session.save((err) => {
        if (err) {
            res.status(500).json({ error: "Failed to save session" });
            return;
        }
        const mobileToken = generateMobileToken(req.session.userId!);
        res.json(toJsonSafe({ id: existingUser.id, name: existingUser.name, gameId: matchedGame.id, mobileToken }));
    });
    return;
}

// ── Fresh login path: name is required ──
if (!name) {
    res.status(400).json({ error: "Name and access code are required" });
    return;
}
if (name.length > 50) {
    res.status(400).json({ error: "Name must be 50 characters or fewer" });
    return;
}

// Content filter: block slurs/hate speech in display names before saving.
if (containsBannedContent(name)) {
    logFlaggedContent('player_name');
    res.status(422).json({ error: COPY.contentFilter.playerName, code: "content_filtered" });
    return;
}

// Always create a new user row — name is a display label, not an identity key.
// Reusing an existing row by name would let any caller impersonate another
// player just by knowing their display name.
const [user] = await db.insert(usersTable).values({ name }).returning();
await db
    .insert(gameAccessGrantsTable)
    .values({ gameId: matchedGame.id, userId: user!.id });

 // Regenerate the session ID on login to prevent session fixation attacks.
 req.session.regenerate((err) => {
     if (err) {
         res.status(500).json({ error: "Failed to establish session" });
         return;
     }
     req.session.userId = user!.id;
     req.session.userName = user!.name;
     req.session.isAdmin = false;

      const mobileToken = generateMobileToken(user!.id);
     res.json(toJsonSafe({ id: user!.id, name: user!.name, gameId: matchedGame.id, mobileToken }));
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
