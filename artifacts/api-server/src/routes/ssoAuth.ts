/**
 * SSO sign-in routes for HOST accounts (Google and Apple).
 *
 * Web variants   → establish the same cookie session as /auth/email/login.
 * Mobile variants → return the same admin Bearer token as /auth/email/admin-mobile-login.
 *
 * Routes:
 *   POST /auth/sso/google          → web session
 *   POST /auth/sso/google/mobile   → mobile Bearer token
 *   POST /auth/sso/apple           → web session
 *   POST /auth/sso/apple/mobile    → mobile Bearer token
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, adminAccountsTable, adminAuthProvidersTable } from "@workspace/db";
import { authRateLimit } from "../middleware/authRateLimit.ts";
import {
  verifyGoogleToken,
  verifyAppleToken,
  type SSOIdentity,
} from "../lib/ssoVerify.ts";

const router: IRouter = Router();

// ─── Shared account-linking function ─────────────────────────────────────────
//
// Rules applied in strict order:
//
//  1. (provider, provider_subject) already linked → log that account in.
//  2. provider says email is verified AND an admin_accounts row exists with
//     that email → insert link row, log that account in (auto-link).
//  3. account exists but email was NOT verified by the provider → refuse;
//     tell the user to sign in with their password to connect this provider.
//  4. no matching account → create a new one (password_hash = null,
//     email_verified = true), insert link row, log in.
//
// Apple name capture:
//   `identity.name` is set by the caller when Apple sends a name in the
//   request body (first authorisation only).  This function stores it as
//   display_name when creating a new account (rule 4) or when backfilling an
//   account that has no display_name yet (rules 1 and 2).
//   An existing non-empty display_name is NEVER overwritten.

async function linkAndGetAccount(
  identity: SSOIdentity
): Promise<{ id: number; email: string }> {
  const { provider, subject, email, emailVerified, name } = identity;

  // ── Rule 1: existing provider link ─────────────────────────────────────────
  const [existingLink] = await db
    .select({ adminAccountId: adminAuthProvidersTable.adminAccountId })
    .from(adminAuthProvidersTable)
    .where(
      and(
        eq(adminAuthProvidersTable.provider, provider),
        eq(adminAuthProvidersTable.providerSubject, subject)
      )
    )
    .limit(1);

  if (existingLink) {
    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.id, existingLink.adminAccountId))
      .limit(1);
    if (!account) {
      throw Object.assign(new Error("Account not found."), { statusCode: 404 });
    }
    // Backfill display_name only when the account has none and we have a name.
    // Never overwrites an existing non-empty display_name.
    if (name && !account.displayName) {
      await db
        .update(adminAccountsTable)
        .set({ displayName: name })
        .where(eq(adminAccountsTable.id, account.id));
    }
    return account;
  }

  // Rules 2–4 require an email from the provider.
  if (!email) {
    throw Object.assign(
      new Error("No email address was provided by the sign-in provider."),
      { statusCode: 400 }
    );
  }

  const normalised = email.toLowerCase().trim();

  const [existingAccount] = await db
    .select()
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.email, normalised))
    .limit(1);

  if (existingAccount) {
    // ── Rule 3: account found, but email NOT verified by provider ───────────
    if (!emailVerified) {
      throw Object.assign(
        new Error(
          "Your email address was not verified by the sign-in provider. " +
            "Please sign in with your password to connect this provider."
        ),
        { statusCode: 409 }
      );
    }

    // ── Rule 2: email verified → auto-link ──────────────────────────────────
    await db.insert(adminAuthProvidersTable).values({
      adminAccountId: existingAccount.id,
      provider,
      providerSubject: subject,
      providerEmail: email,
    });

    // Backfill display_name only when the account has none and we have a name.
    // Never overwrites an existing non-empty display_name.
    if (name && !existingAccount.displayName) {
      await db
        .update(adminAccountsTable)
        .set({ displayName: name })
        .where(eq(adminAccountsTable.id, existingAccount.id));
    }

    return existingAccount;
  }

  // ── Rule 4: no matching account → create new ─────────────────────────────
  const [newAccount] = await db
    .insert(adminAccountsTable)
    .values({
      email: normalised,
      passwordHash: null,
      emailVerified: true,
      displayName: name ?? null,
    })
    .returning();

  if (!newAccount) {
    throw Object.assign(new Error("Failed to create account."), {
      statusCode: 500,
    });
  }

  await db.insert(adminAuthProvidersTable).values({
    adminAccountId: newAccount.id,
    provider,
    providerSubject: subject,
    providerEmail: email,
  });

  return newAccount;
}

// ─── Session / token finish helpers ──────────────────────────────────────────

/** Web finish: same cookie session as /auth/email/login. */
function establishWebSession(
  req: Request,
  res: Response,
  account: { id: number; email: string }
): void {
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to establish session." });
      return;
    }
    req.session.isAdmin = true;
    req.session.adminEmail = account.email;
    req.session.adminAccountId = account.id;
    res.json({ ok: true, email: account.email });
  });
}

/** Mobile finish: same admin Bearer token as /auth/email/admin-mobile-login. */
async function sendMobileToken(
  res: Response,
  account: { id: number; email: string }
): Promise<void> {
  const { generateAdminToken } = await import("../lib/mobileAuth.js");
  const adminToken = generateAdminToken(account.id);
  res.json({ ok: true, adminToken, email: account.email });
}

// ─── Error forwarder ──────────────────────────────────────────────────────────

function ssoError(res: Response, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  const status = e.statusCode ?? 500;
  // Don't leak internal details for 5xx errors.
  const message = status < 500 ? e.message : "Sign-in failed. Please try again.";
  if (status >= 500) console.error("[ssoAuth]", e);
  res.status(status).json({ error: message });
}

// ─── Google ───────────────────────────────────────────────────────────────────

// POST /api/auth/sso/google  →  web cookie session
router.post(
  "/auth/sso/google",
  authRateLimit,
  async (req, res): Promise<void> => {
    try {
      const { idToken } = req.body as { idToken?: unknown };
      if (typeof idToken !== "string" || !idToken) {
        res.status(400).json({ error: "idToken is required." });
        return;
      }
      const identity = await verifyGoogleToken(idToken);
      const account = await linkAndGetAccount(identity);
      establishWebSession(req, res, account);
    } catch (err) {
      ssoError(res, err);
    }
  }
);

// POST /api/auth/sso/google/mobile  →  mobile Bearer token
router.post(
  "/auth/sso/google/mobile",
  authRateLimit,
  async (req, res): Promise<void> => {
    try {
      const { idToken } = req.body as { idToken?: unknown };
      if (typeof idToken !== "string" || !idToken) {
        res.status(400).json({ error: "idToken is required." });
        return;
      }
      const identity = await verifyGoogleToken(idToken);
      const account = await linkAndGetAccount(identity);
      await sendMobileToken(res, account);
    } catch (err) {
      ssoError(res, err);
    }
  }
);

// ─── Apple ────────────────────────────────────────────────────────────────────

// POST /api/auth/sso/apple  →  web cookie session
router.post(
  "/auth/sso/apple",
  authRateLimit,
  async (req, res): Promise<void> => {
    try {
      const { idToken, name } = req.body as {
        idToken?: unknown;
        name?: unknown;
      };
      if (typeof idToken !== "string" || !idToken) {
        res.status(400).json({ error: "idToken is required." });
        return;
      }
      const identity = await verifyAppleToken(idToken);
      // Apple sends the name only on the very first authorisation, in the
      // request body — not in the identity token.  Attach it here so the
      // linking function can persist it as display_name.
      if (typeof name === "string" && name.trim()) {
        identity.name = name.trim();
      }
      const account = await linkAndGetAccount(identity);
      establishWebSession(req, res, account);
    } catch (err) {
      ssoError(res, err);
    }
  }
);

// POST /api/auth/sso/apple/mobile  →  mobile Bearer token
router.post(
  "/auth/sso/apple/mobile",
  authRateLimit,
  async (req, res): Promise<void> => {
    try {
      const { idToken, name } = req.body as {
        idToken?: unknown;
        name?: unknown;
      };
      if (typeof idToken !== "string" || !idToken) {
        res.status(400).json({ error: "idToken is required." });
        return;
      }
      const identity = await verifyAppleToken(idToken);
      // Apple sends the name only on the very first authorisation, in the
      // request body — not in the identity token.  Attach it here so the
      // linking function can persist it as display_name.
      if (typeof name === "string" && name.trim()) {
        identity.name = name.trim();
      }
      const account = await linkAndGetAccount(identity);
      await sendMobileToken(res, account);
    } catch (err) {
      ssoError(res, err);
    }
  }
);

export default router;
