
import crypto from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { PgRateLimitStore, PgRollingRateLimitStore } from "./pgRateLimitStore.ts";

const isDev = process.env["NODE_ENV"] !== "production";

function isLoopback(req: Request): boolean {
  const ip = req.ip ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

/**
 * Strict rate limit for admin/auth routes:
 * 8 attempts per 15 minutes per IP, persisted in PostgreSQL so limits apply
 * across restarts and all deployed replicas.
 * Applied to admin settings, email login, and admin code verification.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait 15 minutes before trying again." },
  skipSuccessfulRequests: false,
  store: new PgRateLimitStore(),
  // Namespace keys because the shared store also backs the reports limiter.
  keyGenerator: (req) => `auth:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`,
  // Authentication endpoints remain protected in development because the
  // preview proxy presents anonymous traffic to the server as loopback.
});

/**
 * Password-reset codes have limited entropy, so failed mobile reset attempts
 * need a second, account-scoped limit in addition to the IP-based auth limit.
 * The rolling window prevents fixed-window rollover during a code's validity
 * period and remains in force if a new code is issued.
 *
 * An HMAC protects the account identifier stored in the rate-limit table from
 * offline correlation if that table is exposed.
 */
export const mobileResetAttemptStore = new PgRollingRateLimitStore(30 * 60 * 1000);
/**
 * Rate limit for public content reports:
 * 15 reports per hour per IP.
 *
 * Each successful submission inserts a DB row and sends a notification email.
 * This cap prevents email-quota exhaustion and DB row flooding from
 * automated abuse while still allowing legitimate players to submit reports.
 */
export const reportsRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many reports submitted. Please wait before submitting another report." },
  skipSuccessfulRequests: false,
  store: new PgRateLimitStore(),
  skip: (req) => isDev && isLoopback(req),
});

/**
 * Lenient rate limit for trivia player join:
 * 120 attempts per minute per IP.
 *
 * Groups of players often join at the same time from the same network
 * (e.g. venue Wi-Fi). This limit is high enough that a room of 30–40
 * players joining within a minute won't be blocked, while still preventing
 * automated brute-force of the short trivia access code.
 *
 * Failed attempts are counted; successful joins reset the IP's counter
 * (skipSuccessfulRequests: true) so a full room of legitimate players
 * never accumulates enough failures to trigger the limit.
 */
export const triviaJoinRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many join attempts from this network. Please wait a minute and try again." },
  skipSuccessfulRequests: true,
  skip: (req) => isDev && isLoopback(req),
});

export function mobileResetAttemptKey(accountId: number): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured before password reset attempts can be tracked.");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`mobile-password-reset:v1:${accountId}`)
    .digest("hex");
  return `mobile-password-reset:${digest}`;
}
