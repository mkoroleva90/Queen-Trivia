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
import { db, gameParticipantsTable, adminAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Payload types ─────────────────────────────────────────────────────────

interface PlayerTokenPayload {
  role?: "player"; // optional — old tokens omit this field
  userId: number;
  /** Array of game IDs this player is allowed to join. */
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

function makeToken(payload: AnyTokenPayload, issuedAt?: number): string {
  const withIat = { ...payload, iat: issuedAt ?? payload.iat };
  const encoded = Buffer.from(JSON.stringify(withIat)).toString("base64url");
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
 * @param allowedGameIds  Array of game IDs this player may join.
 */
export function generateMobileToken(
  userId: number,
  allowedGameIds: number[],
): string {
  return makeToken({ role: "player", userId, allowedGameIds, iat: Date.now() });
}

/**
 * Generate a signed HMAC token for a mobile admin session.
 *
 * @param adminAccountId  Pass the email-admin account ID for scoped access (owns
 *   only their games), or `null` for a legacy code-based super-admin token (all
 *   games, matching existing code-admin cookie behaviour).
 * @param options.issuedAt  Override the `iat` field (ms since epoch). Use when you
 *   need the token to be provably newer than a known `passwordChangedAt` timestamp
 *   (e.g. pass `passwordChangedAt.getTime() + 1` from the change-password route).
 */
export function generateAdminToken(
  adminAccountId: number | null = null,
  options?: { issuedAt?: number },
): string {
  const iat = options?.issuedAt ?? Date.now();
  return makeToken({ role: "admin", adminAccountId, iat }, iat);
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

  // No Bearer header — leave any established cookie session untouched.
  if (!auth?.startsWith("Bearer ")) {
    return next();
  }

  const token = auth.slice(7);
  const payload = parseToken(token);

  // ── Admin bearer token path ──────────────────────────────────────────────
  // When a Bearer header is present and decodes as an admin token (or fails
  // to decode entirely), we evaluate it before honoring any cookie session.
  // This prevents a stale/stolen bearer from falling back to cookie-derived
  // admin access after a password change.
  if (!payload || payload.role === "admin") {
    if (!payload) {
      // Invalid or expired signature — revoke admin access unconditionally.
      req.session.isAdmin = false;
      req.session.adminAccountId = undefined;
      return next();
    }

    // For email-authenticated admin tokens, verify the token was issued after
    // the most recent password change to enforce revocation.
    if (payload.adminAccountId != null) {
      let revoked = false;
      try {
        const [acct] = await db
          .select({ passwordChangedAt: adminAccountsTable.passwordChangedAt })
          .from(adminAccountsTable)
          .where(eq(adminAccountsTable.id, payload.adminAccountId))
          .limit(1);
        // Fail closed: account not found, or token predates the last password change.
        if (!acct || (acct.passwordChangedAt && payload.iat <= acct.passwordChangedAt.getTime())) {
          revoked = true;
        }
      } catch {
        // DB unavailable — fail closed to ensure stale tokens cannot be used
        // during transient outages when revocation cannot be verified.
        revoked = true;
      }
      if (revoked) {
        req.session.isAdmin = false;
        req.session.adminAccountId = undefined;
        return next();
      }
    }

    // Valid admin token — grant admin access, overriding any cookie session.
    req.session.isAdmin = true;
    req.session.userId = undefined;
    req.session.userName = undefined;
    // null → legacy code-based super-admin; number → email-auth scoped admin.
    req.session.adminAccountId = payload.adminAccountId ?? undefined;
    return next();
  }

  // ── Player bearer token path ─────────────────────────────────────────────
  // Only hydrate a player session when no session already exists (cookie or
  // prior admin token). Admin sessions are never overwritten by a player token.
  if (!req.session?.userId && !req.session?.isAdmin) {
    const p = payload as PlayerTokenPayload;
    if (!p.userId) {
      return next(); // malformed
    }
    req.session.userId = p.userId;
    req.session.isAdmin = false;

    // Per-game: union of token's allowed IDs + current participant rows.
    const tokenIds = p.allowedGameIds ?? [];
    try {
      const rows = await db
        .select({ gameId: gameParticipantsTable.gameId })
        .from(gameParticipantsTable)
        .where(eq(gameParticipantsTable.userId, p.userId));
      const dbIds = rows.map((r) => r.gameId);
      const all = new Set([...tokenIds, ...dbIds]);
      req.session.allowedGameIds = [...all];
    } catch {
      req.session.allowedGameIds = tokenIds;
    }
  }

  next();
}
