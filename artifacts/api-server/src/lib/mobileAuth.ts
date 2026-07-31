/**
 * Mobile Bearer-token auth.
 *
 * Expo / React Native fetch does not maintain a shared HTTP cookie jar,
 * so cookie-based express-session cannot be used for native API calls.
 * Instead, the login endpoint returns a signed HMAC token the client stores
 * in SecureStore and sends as `Authorization: Bearer <token>`.
 *
 * Supports two token roles:
 *  - 'player' — regular trivia player (has userId, allowedGameIds)
 *  - 'admin'  — host/admin (sets isAdmin = true on the session)
 *
 * `injectMobileSession` runs after sessionMiddleware on every request.
 * When a valid Bearer token is present it populates req.session so that
 * all existing requireUser / requireAdmin / allowedGameIds checks work
 * transparently without any route changes.
 */

import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, gameParticipantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Payload types ─────────────────────────────────────────────────────────

interface PlayerTokenPayload {
  role?: "player"; // optional — old tokens omit this field
  userId: number;
  /** null = global code (no game restriction); array = per-game codes */
  allowedGameIds: number[] | null;
  iat: number;
}

interface AdminTokenPayload {
  role: "admin";
  /** Scoped to an email-authenticated admin account. Null = legacy code-based super-admin. */
  adminAccountId: number | null;
  iat: number;
}

type AnyTokenPayload = PlayerTokenPayload | AdminTokenPayload;

// ─── Helpers ───────────────────────────────────────────────────────────────

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-fallback-secret";
}

function sign(encoded: string): string {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function makeToken(payload: AnyTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseToken(token: string): AnyTokenPayload | null {
  try {
    const lastDot = token.lastIndexOf(".");
    if (lastDot < 0) return null;
    const encoded = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);
    if (sign(encoded) !== sig) return null;
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as AnyTokenPayload;
    if (!payload.iat) return null;
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Public token generators ──────────────────────────────────────────────

/**
 * Generate a signed HMAC token for a mobile player session.
 * @param allowedGameIds  null = global code (no restriction).
 */
export function generateMobileToken(
  userId: number,
  allowedGameIds: number[] | null,
): string {
  return makeToken({ role: "player", userId, allowedGameIds, iat: Date.now() });
}

/**
 * Generate a signed HMAC token for a mobile admin session.
 *
 * @param adminAccountId  Pass the email-admin account ID for scoped access (owns
 *   only their games), or `null` for a legacy code-based super-admin token (all
 *   games, matching existing code-admin cookie behaviour).
 */
export function generateAdminToken(adminAccountId: number | null = null): string {
  return makeToken({ role: "admin", adminAccountId, iat: Date.now() });
}

// ─── Express middleware ───────────────────────────────────────────────────

/**
 * Runs after sessionMiddleware. If the request carries a valid Bearer token
 * and no active cookie session exists, hydrates req.session so that
 * requireUser, requireAdmin, and allowedGameIds checks all pass.
 */
export async function injectMobileSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;

  // Only act when there is a Bearer token and no established cookie session.
  if (
    auth?.startsWith("Bearer ") &&
    !req.session?.userId &&
    !req.session?.isAdmin
  ) {
    const token = auth.slice(7);
    const payload = parseToken(token);

    if (payload) {
      if (payload.role === "admin") {
        // Admin token — grant admin access, no userId.
        req.session.isAdmin = true;
        req.session.userId = undefined;
        req.session.userName = undefined;
        // Hydrate ownership scope: null → legacy super-admin (all games);
        // number → email-authenticated admin (scoped to their games).
        req.session.adminAccountId = payload.adminAccountId ?? undefined;
      } else {
        // Player token (role === 'player', or old token without role field).
        const p = payload as PlayerTokenPayload;
        if (!p.userId) {
          return next(); // malformed
        }
        req.session.userId = p.userId;
        req.session.isAdmin = false;

        if (p.allowedGameIds === null) {
          // Global code — no game restriction.
          req.session.allowedGameIds = undefined;
        } else {
          // Per-game: union of token's allowed IDs + current participant rows.
          try {
            const rows = await db
              .select({ gameId: gameParticipantsTable.gameId })
              .from(gameParticipantsTable)
              .where(eq(gameParticipantsTable.userId, p.userId));
            const dbIds = rows.map((r) => r.gameId);
            const all = new Set([...p.allowedGameIds, ...dbIds]);
            req.session.allowedGameIds = [...all];
          } catch {
            req.session.allowedGameIds = p.allowedGameIds;
          }
        }
      }
    }
  }

  next();
}
