
import "express-session";


declare module "express-session" {
    interface SessionData {
        userId?: number;
        userName?: string;
        isAdmin?: boolean;
        // Set when the player logged in with a per-game access code;
        // restricts join access to that single game.
        allowedGameId?: number;
    }
}


