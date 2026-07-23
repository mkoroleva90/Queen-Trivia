
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";

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
