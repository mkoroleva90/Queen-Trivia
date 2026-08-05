
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, adminSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import {
  validateTriviaCode,
  validateAdminCode,
  isBcryptHash,
} from "../lib/accessCodeValidation.ts";


const router: IRouter = Router();


// GET /api/settings — return trivia code and whether an admin code is set.
// The admin access code is NEVER returned to the client (it is stored as a
// bcrypt hash and must not be exposed even to the authenticated admin).
router.get("/settings", requireAdmin, async (req, res): Promise<void> => {
  const [row] = await db.select().from(adminSettingsTable).limit(1);
  if (!row) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }
  res.json({
    triviaAccessCode: row.triviaAccessCode,
    adminCodeIsSet: row.adminAccessCode.length > 0,
  });
});


// PATCH /api/settings — update access codes.
// Rules:
//   Trivia access code : 4–6 alphanumeric characters; stored uppercase.
//   Admin access code  : 12–64 characters; stored as bcrypt hash.
//                        Omit or send "" to keep the existing hash unchanged.
router.patch("/settings", requireAdmin, async (req, res): Promise<void> => {
  const [existing] = await db.select().from(adminSettingsTable).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }

  const triviaRaw =
    typeof req.body?.triviaAccessCode === "string"
      ? req.body.triviaAccessCode.trim()
      : null;
  const adminRaw =
    typeof req.body?.adminAccessCode === "string"
      ? req.body.adminAccessCode // do NOT trim — spaces are intentional in passphrases
      : null;

  // ── Trivia code validation ────────────────────────────────────────────────
  if (triviaRaw !== null) {
    const err = validateTriviaCode(triviaRaw);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }

  // ── Admin code validation (only when a new value is supplied) ─────────────
  const adminIsProvided = adminRaw !== null && adminRaw.trim().length > 0;
  if (adminIsProvided) {
    const err = validateAdminCode(adminRaw!);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }

  // ── Codes must differ (case-insensitive) ──────────────────────────────────
  const triviaNorm = (triviaRaw ?? existing.triviaAccessCode).toUpperCase();
  if (adminIsProvided) {
    if (triviaNorm === adminRaw!.trim().toUpperCase()) {
      res
        .status(400)
        .json({ error: "Trivia access code and admin access code must be different." });
      return;
    }
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const updates: Partial<{ triviaAccessCode: string; adminAccessCode: string }> = {};

  if (triviaRaw !== null) {
    // Normalise to uppercase so comparisons are always case-insensitive
    updates.triviaAccessCode = triviaRaw.toUpperCase();
  }

  if (adminIsProvided) {
    // Hash with bcrypt cost-12; the plaintext is never stored.
    updates.adminAccessCode = await bcrypt.hash(adminRaw!, 12);
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to change — return current state
    res.json({
      triviaAccessCode: existing.triviaAccessCode,
      adminCodeIsSet: existing.adminAccessCode.length > 0,
    });
    return;
  }

  const [updated] = await db
    .update(adminSettingsTable)
    .set(updates)
    .where(eq(adminSettingsTable.id, existing.id))
    .returning();

  res.json({
    triviaAccessCode: updated!.triviaAccessCode,
    adminCodeIsSet: updated!.adminAccessCode.length > 0,
  });
});


export default router;
