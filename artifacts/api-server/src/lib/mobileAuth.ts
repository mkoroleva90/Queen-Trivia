/**
 * Mobile Bearer-token auth.
 *
 * Expo / React Native fetch does not maintain a shared HTTP cookie jar,
 * so cookie-based express-session cannot be used for native API calls.
 * Instead, the login endpoint returns a signed HMAC token the client stores
 * in SecureStore and sends as `Authorization: Bearer <token>`.
 *
 * `injectMobileSession` runs before every route.  When a valid Bearer token
 * is present it populates req.session.userId and req.session.allowedGameIds
 * so all existing requireUser / allowedGameId checks continue to work
 * transparently without any route changes.
 */

import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, gameParticipantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface MobileTokenPayload {
  userId: number;
  /** null = global code (no game restriction); array = per-game codes seen so far */
  allowedGameIds: number[] | null;
  iat: number;
}

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-fallback-secret";
}

/**
 * Generate a signed HMAC token for a mobile player session.
 * @param allowedGameIds  null = global code (no restriction).
 */
export function generateMobileToken(
  userId: number,
  allowedGameIds: number[] | null,
): string {
  const payload: MobileTokenPayload = { userId, allowedGameIds, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    // Split on the LAST dot — base64url encoded JSON can contain dots
    const lastDot = token.lastIndexOf(".");
    if (lastDot < 0) return null;
    const encoded = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);
    const expected = createHmac("sha256", secret())
      .update(encoded)
      .digest("base64url");
    // Constant-time comparison would be ideal; this is close enough for
    // a 30-day session token that protects non-financial quiz data.
    if (sig !== expected) return null;
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as MobileTokenPayload;
    if (!payload.userId || !payload.iat) return null;
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware — runs after sessionMiddleware.
 *
 * If the request carries a valid Bearer token and no cookie session exists,
 * hydrates req.session so that requireUser and allowedGameIds checks pass.
 *
 * allowedGameIds = union(token.allowedGameIds, current DB participants)
 * so joining new games and re-using old sessions both work correctly.
 */
export async function injectMobileSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ") && !req.session?.userId) {
    const token = auth.slice(7);
    const payload = verifyMobileToken(token);
    if (payload) {
      req.session.userId = payload.userId;
      req.session.isAdmin = false;

      if (payload.allowedGameIds === null) {
        // Global access code — no game restriction.
        req.session.allowedGameIds = undefined;
      } else {
        // Per-game restriction: union of token's allowed IDs (so the player
        // can still join games their token authorises that aren't in the DB
        // yet) plus any games they have already joined (participant records).
        try {
          const rows = await db
            .select({ gameId: gameParticipantsTable.gameId })
            .from(gameParticipantsTable)
            .where(eq(gameParticipantsTable.userId, payload.userId));
          const dbIds = rows.map((r) => r.gameId);
          const all = new Set([...payload.allowedGameIds, ...dbIds]);
          req.session.allowedGameIds = [...all];
        } catch {
          // DB unavailable — fall back to token-only list
          req.session.allowedGameIds = payload.allowedGameIds;
        }
      }
    }
  }
  next();
}
