
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { and, ne, sql } from "drizzle-orm";
import { db, pool, sessionsTable } from "@workspace/db";

const PgSession = connectPgSimple(session);

const SESSION_SECRET = process.env["SESSION_SECRET"];
if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
}

export const sessionMiddleware = session({
    store: new PgSession({
        pool: pool,
        tableName: "sessions",
        // NOTE: createTableIfMissing reads table.sql from the package dir,
        // which breaks in the esbuild bundle. The table is managed in the
        // drizzle schema (lib/db) instead.
        createTableIfMissing: false,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
});

/**
 * Remove every persisted browser session belonging to an email-authenticated
 * admin. The session store has no foreign key to admin_accounts, so account
 * deletion and password changes must explicitly revoke these rows.
 *
 * Account ID is the primary identity. Email is also accepted to cover older
 * sessions created before adminAccountId was added to the session payload.
 * Callers may preserve the current session when a password change should keep
 * the legitimate browser logged in.
 */
export async function invalidateAdminSessions(options: {
    adminAccountId?: number | null;
    adminEmail?: string | null;
    exceptSessionId?: string;
}): Promise<void> {
    const identity = (() => {
        const conditions = [];
        if (options.adminAccountId != null) {
            conditions.push(
                sql`${sessionsTable.sess}->>'adminAccountId' = ${String(options.adminAccountId)}`,
            );
        }
        if (options.adminEmail) {
            conditions.push(
                sql`${sessionsTable.sess}->>'adminEmail' = ${options.adminEmail}`,
            );
        }

        if (conditions.length === 0) return null;
        if (conditions.length === 1) return conditions[0];
        return sql`(${conditions[0]} OR ${conditions[1]})`;
    })();

    if (!identity) return;

    const where = options.exceptSessionId
        ? and(identity, ne(sessionsTable.sid, options.exceptSessionId))
        : identity;
    await db.delete(sessionsTable).where(where);
}
