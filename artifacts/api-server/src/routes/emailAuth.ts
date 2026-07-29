import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, adminAccountsTable, sessionsTable } from "@workspace/db";
import {
  EmailRegisterBody,
  EmailLoginBody,
  EmailVerifyBody,
  EmailForgotPasswordBody,
  EmailResetPasswordBody,
} from "@workspace/api-zod";
import { authRateLimit } from "../middleware/authRateLimit";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/email";

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
// Requires an existing admin session — only authenticated admins may add new admin accounts.
router.post(
  "/auth/email/register",
  authRateLimit,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = EmailRegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;
    const normalised = email.toLowerCase().trim();

    // Check for existing account — always respond generically to avoid enumeration
    const [existing] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

    if (existing) {
      // Same response as success to avoid account enumeration
      res.json({ ok: true, message: "Check your email for a verification link." });
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
      // Log config errors server-side; never expose token or address in response
      console.error((err as Error).message);
      res.status(503).json({ error: "Email service unavailable. Check server configuration." });
      return;
    }

    res.json({ ok: true, message: "Check your email for a verification link." });
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

    const { email, password } = parsed.data;
    const normalised = email.toLowerCase().trim();

    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.email, normalised))
      .limit(1);

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
      console.error((err as Error).message);
      res.status(503).json({ error: "Email service unavailable. Check server configuration." });
      return;
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

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await db
      .update(adminAccountsTable)
      .set({
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiry: null,
      })
      .where(eq(adminAccountsTable.id, account.id));

    // Invalidate all existing sessions for this admin so stolen sessions cannot
    // continue to be used after a password reset.
    // connect-pg-simple stores session data as JSON in the `sess` column;
    // we delete any row whose sess->>'adminEmail' matches the account directly.
    await db
      .delete(sessionsTable)
      .where(sql`${sessionsTable.sess}->>'adminEmail' = ${account.email}`);

    res.json({ ok: true, message: "Password updated. You can now log in." });
  }
);

export default router;
