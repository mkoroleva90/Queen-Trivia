import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminAccountsTable, gamesTable } from "@workspace/db";
import {
  EmailRegisterBody,
  EmailLoginBody,
  EmailVerifyBody,
  EmailForgotPasswordBody,
  EmailResetPasswordBody,
  EmailChangePasswordBody,
  MobileForgotPasswordBody,
  MobileResetPasswordBody,
} from "@workspace/api-zod";
import {
  authRateLimit,
  mobileResetAttemptKey,
  mobileResetAttemptStore,
} from "../middleware/authRateLimit.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { invalidateAdminSessions } from "../lib/session.ts";
import { revokeAdminSockets } from "../lib/socket.ts";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetCodeEmail,
} from "../lib/email.ts";
import { logger } from "../lib/logger.ts";

const router: IRouter = Router();

// ── helpers ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(req: import("express").Request): string {
  // Prefer the published domain; fall back to the incoming host in dev
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const primary = domains.split(",")[0]!.trim();
    return `https://${primary}`;
  }
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${req.headers.host}`;
}

// ── routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/email/register
// Open self-service registration — any visitor may create a host account.
// Account is inactive until the email verification link is clicked.
router.post(
  "/auth/email/register",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailRegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;
    const normalised = email.toLowerCase().trim();
    const genericOk = { ok: true, message: "Check your email for a verification link." };

    // Check for existing account — always respond generically to avoid enumeration
    const [existing] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    if (existing) {
      // Same response as success to avoid account enumeration
      res.json(genericOk);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    await db.insert(adminAccountsTable).values({
      email: normalised,
      passwordHash,
      emailVerified: false,
      verificationTokenHash: tokenHash,
      verificationTokenExpiry: expiry,
    });

    const base = appBaseUrl(req);
    const verifyUrl = `${base}/verify-email?token=${token}`;

    try {
      await sendVerificationEmail(normalised, verifyUrl);
    } catch (err) {
      // Do not reveal delivery failures; that would make registration an
      // account-enumeration oracle when the mail service is unavailable.
      logger.error({ err }, "Verification email delivery failed");
    }

    res.json(genericOk);
  }
);

// POST /api/auth/email/verify
router.post(
  "/auth/email/verify",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailVerifyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const tokenHash = hashToken(parsed.data.token);
    const now = new Date();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.verificationTokenHash, tokenHash))
      .limit(1);

    if (
      !account ||
      !account.verificationTokenExpiry ||
      account.verificationTokenExpiry < now
    ) {
      res.status(400).json({ error: "Verification link is invalid or has expired." });
      return;
    }

    await db
      .update(adminAccountsTable)
      .set({
        emailVerified: true,
        verificationTokenHash: null,
        verificationTokenExpiry: null,
      })
      .where(eq(adminAccountsTable.id, account.id));

    // Establish admin session immediately after verification
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to establish session" });
        return;
      }
      req.session.isAdmin = true;
      req.session.adminEmail = account.email;
      req.session.adminAccountId = account.id;
      res.json({ ok: true, message: "Email verified. You are now logged in." });
    });
  }
);

// POST /api/auth/email/login
router.post(
  "/auth/email/login",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailLoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { email, password, rememberMe } = parsed.data;
    const normalised = email.toLowerCase().trim();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    // Guard: SSO-only accounts have no password set.
    if (account && account.passwordHash === null) {
      res.status(401).json({ error: "This account uses Google or Apple sign-in. Please sign in with your connected provider." });
      return;
    }

    // Constant-time path: always run bcrypt.compare to avoid timing attacks
    const dummyHash = "$2b$12$invalidhashpaddingtoensureconstanttimepath000000000000";
    const passwordHash = account?.passwordHash ?? dummyHash;
    const passwordOk = await bcrypt.compare(password, passwordHash);

    if (!account || !passwordOk) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    if (!account.emailVerified) {
      res.status(403).json({ error: "Please verify your email address before logging in." });
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to establish session" });
        return;
      }
      req.session.isAdmin = true;
      req.session.adminEmail = account.email;
      req.session.adminAccountId = account.id;
      if (rememberMe) {
        // 30 days for "remember me"
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      res.json({ ok: true, email: account.email });
    });
  }
);

// POST /api/auth/email/forgot-password
router.post(
  "/auth/email/forgot-password",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailForgotPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const normalised = parsed.data.email.toLowerCase().trim();

    // Always respond with the same message to avoid account enumeration
    const genericOk = { ok: true, message: "If that address is registered, a reset link is on its way." };

    const [account] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    if (!account) {
      res.json(genericOk);
      return;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 h

    await db
      .update(adminAccountsTable)
      .set({ resetTokenHash: tokenHash, resetTokenExpiry: expiry })
      .where(eq(adminAccountsTable.id, account.id));

    const base = appBaseUrl(req);
    const resetUrl = `${base}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(normalised, resetUrl);
    } catch (err) {
      // Keep this indistinguishable from the no-account response.
      logger.error({ err }, "Password reset email delivery failed");
    }

    res.json(genericOk);
  }
);

// POST /api/auth/email/reset-password
router.post(
  "/auth/email/reset-password",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const tokenHash = hashToken(parsed.data.token);
    const now = new Date();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.resetTokenHash, tokenHash))
      .limit(1);

    if (
      !account ||
      !account.resetTokenExpiry ||
      account.resetTokenExpiry < now
    ) {
      res.status(400).json({ error: "Reset link is invalid or has expired." });
      return;
    }

    // Guard: SSO-only accounts have no password; they cannot use the password reset flow.
    if (account.passwordHash === null) {
      res.status(400).json({ error: "This account uses Google or Apple sign-in. Please sign in with your connected provider." });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await db
      .update(adminAccountsTable)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiry: null,
      })
      .where(eq(adminAccountsTable.id, account.id));

    // Invalidate all existing sessions for this admin so stolen sessions cannot
    // continue to be used after a password reset.
    await invalidateAdminSessions({
      adminAccountId: account.id,
      adminEmail: account.email,
    });
    await revokeAdminSockets({
      adminAccountId: account.id,
      adminEmail: account.email,
    });

    res.json({ ok: true, message: "Password updated. You can now log in." });
  }
);

// POST /api/auth/email/mobile-forgot-password
// Mobile variant: generates a 6-digit numeric code (rather than a URL token)
// and emails it directly so the host can complete the reset inside the app.
// Uses the same resetTokenHash / resetTokenExpiry columns; no schema change.
router.post(
  "/auth/email/mobile-forgot-password",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = MobileForgotPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const normalised = parsed.data.email.toLowerCase().trim();

    // Always respond with the same message to avoid account enumeration.
    const genericOk = { ok: true, message: "If that address is registered, a reset code is on its way." };

    const [account] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    if (!account) {
      res.json(genericOk);
      return;
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const tokenHash = hashToken(code);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db
      .update(adminAccountsTable)
      .set({ resetTokenHash: tokenHash, resetTokenExpiry: expiry })
      .where(eq(adminAccountsTable.id, account.id));

    try {
      await sendPasswordResetCodeEmail(normalised, code);
    } catch (err) {
      // Keep this indistinguishable from the no-account response.
      logger.error({ err }, "Password reset code email delivery failed");
    }

    res.json(genericOk);
  }
);

// POST /api/auth/email/mobile-reset-password
// Mobile variant: accepts email + 6-digit code + new password.
// A persistent, account-scoped failed-attempt limit is applied in addition to
// the persistent IP limit, preventing distributed OTP guessing across code
// reissues.
// On success clears the token, invalidates web sessions, and returns a
// mobile Bearer token so the app can sign the host in immediately.
router.post(
  "/auth/email/mobile-reset-password",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = MobileResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, code, password } = parsed.data;
    const normalised = email.toLowerCase().trim();
    const tokenHash = hashToken(code);
    const now = new Date();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    if (
      !account ||
      !account.resetTokenExpiry ||
      account.resetTokenExpiry < now ||
      !account.resetTokenHash
    ) {
      res.status(400).json({ error: "That code is invalid or has expired." });
      return;
    }

    const resetAttempt = await mobileResetAttemptStore.increment(
      mobileResetAttemptKey(account.id),
    );
    if (resetAttempt.totalHits > 5) {
      res.status(429).json({
        error: "Too many reset attempts for this account. Please request a new code and try again later.",
      });
      return;
    }

    if (account.resetTokenHash !== tokenHash) {
      res.status(400).json({ error: "That code is invalid or has expired." });
      return;
    }

    // Guard: SSO-only accounts have no password; they cannot use the password reset flow.
    if (account.passwordHash === null) {
      res.status(400).json({ error: "This account uses Google or Apple sign-in. Please sign in with your connected provider." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(adminAccountsTable)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiry: null,
      })
      .where(eq(adminAccountsTable.id, account.id));

    // Invalidate existing web sessions for this admin.
    await invalidateAdminSessions({
      adminAccountId: account.id,
      adminEmail: account.email,
    });
    await revokeAdminSockets({
      adminAccountId: account.id,
      adminEmail: account.email,
    });

    const { generateAdminToken } = await import("../lib/mobileAuth.js");
    const adminToken = generateAdminToken(account.id);
    res.json({ ok: true, adminToken });
  }
);

// POST /api/auth/email/change-password
// Requires an active admin session. Verifies the current password, then hashes
// and stores the new one. Issues a fresh mobile token; does NOT invalidate the
// current session so the host stays logged in.
router.post(
  "/auth/email/change-password",
  authRateLimit,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = EmailChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const adminAccountId = req.session.adminAccountId;
    if (adminAccountId == null) {
      res.status(400).json({ error: "This endpoint requires an email-based account session." });
      return;
    }

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.id, adminAccountId))
      .limit(1);

    if (!account) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    // Guard: SSO-only accounts have no password to change.
    if (account.passwordHash === null) {
      res.status(400).json({ error: "This account uses Google or Apple sign-in and has no password to change." });
      return;
    }

    const currentOk = await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
    if (!currentOk) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

    const passwordChangedAt = new Date();
    await db
      .update(adminAccountsTable)
      .set({ passwordHash: newHash, passwordChangedAt })
      .where(eq(adminAccountsTable.id, adminAccountId));

    // Revoke every other browser and Socket.IO session after the new password
    // timestamp is durable. Old mobile tokens now fail closed even if they
    // reconnect while distributed socket revocation is in flight.
    await invalidateAdminSessions({
      adminAccountId: account.id,
      adminEmail: account.email,
      exceptSessionId: req.sessionID,
    });
    await revokeAdminSockets({
      adminAccountId: account.id,
      adminEmail: account.email,
      exceptSessionId: req.sessionID,
    });

    // Issue a fresh mobile token with iat guaranteed to be after passwordChangedAt
    // (by +1 ms) so it always passes the revocation check in injectMobileSession,
    // even if JS Date.now() and the stored timestamp land in the same millisecond.
    const { generateAdminToken } = await import("../lib/mobileAuth.js");
    const newAdminToken = generateAdminToken(adminAccountId, {
      issuedAt: passwordChangedAt.getTime() + 1,
    });

    res.json({ ok: true, message: "Password changed successfully.", newAdminToken });
  }
);

// GET /api/auth/email/config-check
// Requires the ADMIN_ACCESS_KEY header — no email session needed so it can be
// called before any admin has ever registered.
router.get("/auth/email/config-check", (req, res): void => {
  const envKey = process.env["ADMIN_ACCESS_KEY"]?.trim();
  const provided = (req.headers["x-admin-key"] as string | undefined)?.trim();

  if (!envKey || provided !== envKey) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const resendKey = process.env["RESEND_API_KEY"];
  const emailFrom = process.env["EMAIL_FROM"];
  const replitDomains = process.env["REPLIT_DOMAINS"];

  const issues: string[] = [];
  if (!resendKey) issues.push("RESEND_API_KEY is not set");
  if (!emailFrom) issues.push("EMAIL_FROM is not set");
  if (!replitDomains) issues.push("REPLIT_DOMAINS is not set — email links will fall back to request host");

  if (issues.length > 0) {
    res.status(503).json({ ok: false, issues });
    return;
  }

  const primaryDomain = replitDomains!.split(",")[0]!.trim();
  res.json({
    ok: true,
    emailFrom,
    baseUrl: `https://${primaryDomain}`,
    sampleVerifyUrl: `https://${primaryDomain}/verify-email?token=<token>`,
    sampleResetUrl: `https://${primaryDomain}/reset-password?token=<token>`,
  });
});

// DELETE /api/auth/email/admin-account
// Requires an active admin session. Deletes the signed-in admin's own account
// so test registrations can be cleaned up after end-to-end verification.
router.delete(
  "/auth/email/admin-account",
  requireAdmin,
  async (req, res): Promise<void> => {
    const email = req.session.adminEmail;
    if (!email) {
      res.status(400).json({ error: "No admin email in session" });
      return;
    }

    const adminAccountId = req.session.adminAccountId;
    await db
      .delete(adminAccountsTable)
      .where(eq(adminAccountsTable.email, email));

    await invalidateAdminSessions({
      adminAccountId,
      adminEmail: email,
    });
    await revokeAdminSockets({
      adminAccountId,
      adminEmail: email,
    });

    req.session.destroy(() => {
      res.json({ ok: true, message: `Account ${email} deleted and session cleared.` });
    });
  }
);

// DELETE /api/auth/email/account
// User-facing account deletion for email-auth hosts (both web and mobile).
// Requires a valid email-auth session/token (adminAccountId must be set).
// 1. Null out owned games so they become legacy/shared games.
// 2. Delete the account — ai_usage_log cascades automatically.
// 3. Destroy the session / invalidate cookie.
router.delete(
  "/auth/email/account",
  requireAdmin,
  async (req, res): Promise<void> => {
    const adminAccountId = req.session.adminAccountId;
    if (adminAccountId == null) {
      // Code-based legacy session — no account to delete
      res.status(400).json({ error: "This endpoint requires an email-based account session." });
      return;
    }

    // Delete owned games — questions cascade via FK (ON DELETE CASCADE)
    await db
      .delete(gamesTable)
      .where(eq(gamesTable.ownerAdminId, adminAccountId));

    // Delete account — ai_usage_log cascades via FK
    await db
      .delete(adminAccountsTable)
      .where(eq(adminAccountsTable.id, adminAccountId));

    await invalidateAdminSessions({
      adminAccountId,
      adminEmail: req.session.adminEmail,
    });
    await revokeAdminSockets({
      adminAccountId,
      adminEmail: req.session.adminEmail,
    });

    // Invalidate the current session
    req.session.destroy(() => {
      res.json({ ok: true, message: "Account deleted." });
    });
  }
);

// POST /api/auth/email/admin-mobile-login
// Mobile-only: validate email + password, return a Bearer token scoped to the
// admin's account ID.  The token embeds adminAccountId so injectMobileSession
// can hydrate req.session.adminAccountId and assertGameOwnership enforces game
// ownership correctly (same as the cookie-based email login path).
router.post(
  "/auth/email/admin-mobile-login",
  authRateLimit,
  async (req, res): Promise<void> => {
    const parsed = EmailLoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { email, password } = parsed.data;
    const normalised = email.toLowerCase().trim();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    // Guard: SSO-only accounts have no password set.
    if (account && account.passwordHash === null) {
      res.status(401).json({ error: "This account uses Google or Apple sign-in. Please sign in with your connected provider." });
      return;
    }

    // Constant-time path to prevent timing attacks.
    const dummyHash = "$2b$12$invalidhashpaddingtoensureconstanttimepath000000000000";
    const passwordHash = account?.passwordHash ?? dummyHash;
    const passwordOk = await bcrypt.compare(password, passwordHash);

    if (!account || !passwordOk) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    if (!account.emailVerified) {
      res
        .status(403)
        .json({ error: "Please verify your email address before logging in." });
      return;
    }

    const { generateAdminToken } = await import("../lib/mobileAuth.js");
    const adminToken = generateAdminToken(account.id);
    res.json({ ok: true, adminToken, email: account.email });
  }
);

export default router;
