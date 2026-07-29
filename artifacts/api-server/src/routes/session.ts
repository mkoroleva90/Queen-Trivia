
import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, adminSettingsTable, usersTable, gamesTable } from "@workspace/db";
import { toJsonSafe } from "../lib/serialize";
import { authRateLimit } from "../middleware/authRateLimit";


const router: IRouter = Router();
// POST /api/auth/login — verify trivia code + create/retrieve user, start session
router.post("/auth/login", authRateLimit, async (req, res): Promise<void> => {
const code =
    typeof req.body?.code === "string" ? req.body.code.trim() : "";
const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "";


if (!code || !name) {
    res.status(400).json({ error: "Name and access code are required" });
    return;
}
if (name.length > 50) {
    res.status(400).json({ error: "Name must be 50 characters or fewer" });
    return;
}


const [settings] = await db.select().from(adminSettingsTable).limit(1);
const isGlobalCode = !!settings && code === settings.triviaAccessCode;

// Per-game access codes: a code tied to a specific (non-completed) game
let matchedGame: { id: number } | undefined;
if (!isGlobalCode) {
    const [game] = await db
        .select({ id: gamesTable.id })
        .from(gamesTable)
        .where(and(eq(gamesTable.accessCode, code), ne(gamesTable.status, "completed")))
        .limit(1);
    matchedGame = game;
}

if (!isGlobalCode && !matchedGame) {
    res.status(401).json({ error: "Invalid access code" });
    return;
}


// Always create a new user row — name is a display label, not an identity key.
// Reusing an existing row by name would let any caller impersonate another
// player just by knowing their display name.
const [user] = await db.insert(usersTable).values({ name }).returning();

 // Regenerate the session ID on login to prevent session fixation attacks.
 req.session.regenerate((err) => {
     if (err) {
         res.status(500).json({ error: "Failed to establish session" });
         return;
     }
     req.session.userId = user!.id;
     req.session.userName = user!.name;
     req.session.isAdmin = false;
     // Per-game code: bind this session to that game only
     req.session.allowedGameId = matchedGame?.id;

     res.json(toJsonSafe({ id: user!.id, name: user!.name, gameId: matchedGame?.id ?? null }));
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


// POST /api/admin/login — verify admin code, start admin session
router.post("/admin/login", authRateLimit, async (req, res): Promise<void> => {
 const code =
     typeof req.body?.code === "string" ? req.body.code.trim() : "";
 const rememberMe = req.body?.rememberMe === true;


 if (!code) {
     res.status(400).json({ error: "Access code is required" });
     return;
 }


 const envCode = (process.env.ADMIN_ACCESS_KEY ?? process.env.ADMIN_ACCESS_CODE)?.trim();
 if (envCode) {
     if (code !== envCode) {
      res.status(401).json({ error: "Invalid admin code" });
      return;
     }
 } else {
     const [settings] = await db.select().from(adminSettingsTable).limit(1);
     if (!settings || code !== settings.adminAccessCode) {
         res.status(401).json({ error: "Invalid admin code" });
         return;
     }
 }


 // Regenerate the session ID on login to prevent session fixation attacks.
 req.session.regenerate((err) => {
     if (err) {
         res.status(500).json({ error: "Failed to establish session" });
         return;
     }
     req.session.isAdmin = true;
     req.session.userId = undefined;
     req.session.userName = undefined;
     if (rememberMe) {
         // 30 days for "remember me" — consistent with email login
         req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
     }

     res.json({ ok: true });
 });
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


