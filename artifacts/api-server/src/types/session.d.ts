
import "express-session";


declare module "express-session" {
    interface SessionData {
        userId?: number;
        userName?: string;
        isAdmin?: boolean;
        adminEmail?: string;
        // Set for email-authenticated admins; used to scope game ownership.
        // Not set for legacy code-based (ADMIN_ACCESS_KEY) admin sessions.
        adminAccountId?: number;
        // Set when the player logged in with a per-game access code;
        // restricts join access to only the listed games. A player may
        // accumulate multiple games by joining additional rooms without
        // losing their existing session.
        allowedGameIds?: number[];
    }
}


