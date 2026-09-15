/**
 * Mobile Bearer-token auth.
 *
 * Expo / React Native fetch does not maintain a shared HTTP cookie jar,
 * so cookie-based express-session cannot be used for native API calls.
 * Instead, the login endpoint returns a signed HMAC token the client stores
 * in SecureStore and sends as `Authorization: Bearer <token>`.
 *
 * Supports two token roles:
 *  - 'player' — regular trivia player (has userId)
 *  - 'admin'  — host/admin (sets isAdmin = true on the session)
 *
 * `injectMobileSession` runs after sessionMiddleware on every request.
 * When a valid Bearer token is present it populates req.session so that
 * existing requireUser / requireAdmin checks work transparently.
 * transparently without any route changes.
 */

import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, adminAccountsTable } from "@workspace/db";
import { and, eq, isNull, lt, or } from "drizzle-orm";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Payload types ─────────────────────────────────────────────────────────

interface PlayerTokenPayload {
  role?: "player"; // optional — old tokens omit this field
  userId: number;
  iat: number;
}

interface AdminTokenPayload {
  role: "admin";
  /** Scoped to an email-authenticated admin account. */
  adminAccountId: number;
  iat: number;
}

type AnyTokenPayload = PlayerTokenPayload | AdminTokenPayload;

export type MobileTokenIdentity =
  | { role: "player"; userId: number }
  | { role: "admin"; adminAccountId: number };

// ─── Helpers ───────────────────────────────────────────────────────────────

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "dev-fallback-secret") {
    throw new Error(
      "FATAL: SESSION_SECRET is missing or set to the insecure fallback value. " +
        "Set a strong random secret in the SESSION_SECRET environment variable before starting the server.",
    );
  }
  return s;
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
 */
export function generateMobileToken(
  userId: number,
): string {
  return makeToken({ role: "player", userId, iat: Date.now() });
}

/**
 * Generate a signed HMAC token for a mobile admin session.
 *
 * @param adminAccountId  The email-admin account ID that scopes access to the
 *   account's games.
 * @param options.issuedAt  Override the `iat` field (ms since epoch). Use when you
 *   need the token to be provably newer than a known `passwordChangedAt` timestamp
 *   (e.g. pass `passwordChangedAt.getTime() + 1` from the change-password route).
 */
export function generateAdminToken(
  adminAccountId: number,
  options?: { issuedAt?: number },
): string {
  const iat = options?.issuedAt ?? Date.now();
  return makeToken({ role: "admin", adminAccountId, iat }, iat);
}

/**
 * Revoke every mobile token issued for the Bearer identity before this call.
 * Invalid/malformed tokens do not identify a subject and are ignored.
 */
export async function revokeMobileBearerToken(
  authorization: string | undefined,
): Promise<MobileTokenIdentity | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const payload = parseToken(authorization.slice(7));
  if (!payload) return null;

  const revokedAt = new Date();
  if (payload.role === "admin") {
    if (!Number.isSafeInteger(payload.adminAccountId) || payload.adminAccountId <= 0) return null;
    const revoked = await db
      .update(adminAccountsTable)
      .set({ mobileTokensRevokedAt: revokedAt })
      .where(and(
        eq(adminAccountsTable.id, payload.adminAccountId),
        or(
          isNull(adminAccountsTable.passwordChangedAt),
          lt(adminAccountsTable.passwordChangedAt, new Date(payload.iat)),
        ),
        or(
          isNull(adminAccountsTable.mobileTokensRevokedAt),
          lt(adminAccountsTable.mobileTokensRevokedAt, new Date(payload.iat)),
        ),
      ))
      .returning({ id: adminAccountsTable.id });
    if (revoked.length === 0) return null;
    return { role: "admin", adminAccountId: payload.adminAccountId };
  }

  if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0) return null;
  const revoked = await db
    .update(usersTable)
    .set({ mobileTokensRevokedAt: revokedAt })
    .where(and(
      eq(usersTable.id, payload.userId),
      or(
        isNull(usersTable.mobileTokensRevokedAt),
        lt(usersTable.mobileTokensRevokedAt, new Date(payload.iat)),
      ),
    ))
    .returning({ id: usersTable.id });
  if (revoked.length === 0) return null;
  return { role: "player", userId: payload.userId };
}

/** Re-check a Bearer token and return its current persisted identity. */
export async function getActiveMobileBearerIdentity(
  token: string,
): Promise<MobileTokenIdentity | null> {
  const payload = parseToken(token);
  if (!payload) return null;
  try {
    if (payload.role === "admin") {
      if (!Number.isSafeInteger(payload.adminAccountId) || payload.adminAccountId <= 0) {
        return null;
      }
      const [acct] = await db
        .select({
          passwordChangedAt: adminAccountsTable.passwordChangedAt,
          mobileTokensRevokedAt: adminAccountsTable.mobileTokensRevokedAt,
        })
        .from(adminAccountsTable)
        .where(eq(adminAccountsTable.id, payload.adminAccountId))
        .limit(1);
      return (
        acct
        && (!acct.passwordChangedAt || payload.iat > acct.passwordChangedAt.getTime())
        && (!acct.mobileTokensRevokedAt || payload.iat > acct.mobileTokensRevokedAt.getTime())
      )
        ? { role: "admin", adminAccountId: payload.adminAccountId }
        : null;
    }

    if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0) return null;
    const [user] = await db
      .select({ mobileTokensRevokedAt: usersTable.mobileTokensRevokedAt })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);
    return (
      user
      && (!user.mobileTokensRevokedAt || payload.iat > user.mobileTokensRevokedAt.getTime())
    )
      ? { role: "player", userId: payload.userId }
      : null;
  } catch {
    return null;
  }
}

// ─── Express middleware ───────────────────────────────────────────────────

/**
 * Runs after sessionMiddleware. If the request carries a valid Bearer token
 * and no active cookie session exists, hydrates req.session so that
 * requireUser and requireAdmin checks all pass.
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

    // Reject legacy/null admin tokens. A token without a tenant identity must
    // never hydrate a super-admin session.
    if (!Number.isSafeInteger(payload.adminAccountId) || payload.adminAccountId <= 0) {
      req.session.isAdmin = false;
      req.session.adminAccountId = undefined;
      return next();
    }

    // Verify the token was issued after the most recent password change to
    // enforce revocation.
    {
      let revoked = false;
      try {
        const [acct] = await db
          .select({
            passwordChangedAt: adminAccountsTable.passwordChangedAt,
            mobileTokensRevokedAt: adminAccountsTable.mobileTokensRevokedAt,
          })
          .from(adminAccountsTable)
          .where(eq(adminAccountsTable.id, payload.adminAccountId))
          .limit(1);
        // Fail closed: account not found, or token predates the last password change.
        if (
          !acct
          || (acct.passwordChangedAt && payload.iat <= acct.passwordChangedAt.getTime())
          || (acct.mobileTokensRevokedAt && payload.iat <= acct.mobileTokensRevokedAt.getTime())
        ) {
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
    req.session.adminAccountId = payload.adminAccountId;
    return next();
  }

  // ── Player bearer token path ─────────────────────────────────────────────
  // Only hydrate a player session when no session already exists (cookie or
  // prior admin token). Admin sessions are never overwritten by a player token.
  if (!req.session?.userId && !req.session?.isAdmin) {
    const p = payload as PlayerTokenPayload;
    if (!Number.isSafeInteger(p.userId) || p.userId <= 0) {
      return next(); // malformed
    }
    let revoked = false;
    try {
      const [user] = await db
        .select({ mobileTokensRevokedAt: usersTable.mobileTokensRevokedAt })
        .from(usersTable)
        .where(eq(usersTable.id, p.userId))
        .limit(1);
      revoked = !user
        || Boolean(
          user.mobileTokensRevokedAt
          && p.iat <= user.mobileTokensRevokedAt.getTime(),
        );
    } catch {
      revoked = true;
    }
    if (revoked) return next();
    req.session.userId = p.userId;
    req.session.isAdmin = false;

  }

  next();
}
