
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, adminSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import {
  validateAdminCode,
} from "../lib/accessCodeValidation.ts";


const router: IRouter = Router();


// GET /api/settings — return whether an admin code is set.
// The admin access code is NEVER returned to the client (it is stored as a
// bcrypt hash and must not be exposed even to the authenticated admin).
router.get("/settings", requireAdmin, async (req, res): Promise<void> => {
  const [row] = await db.select().from(adminSettingsTable).limit(1);
  if (!row) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }
  res.json({
    adminCodeIsSet: row.adminAccessCode.length > 0,
  });
});


// PATCH /api/settings — update admin access code.
// Admin access code : 12–64 characters; stored as bcrypt hash.
//                     Omit or send "" to keep the existing hash unchanged.
router.patch("/settings", requireAdmin, async (req, res): Promise<void> => {
  const [existing] = await db.select().from(adminSettingsTable).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }

  const adminRaw =
    typeof req.body?.adminAccessCode === "string"
      ? req.body.adminAccessCode // do NOT trim — spaces are intentional in passphrases
      : null;

  // ── Admin code validation (only when a new value is supplied) ─────────────
  const adminIsProvided = adminRaw !== null && adminRaw.trim().length > 0;
  if (adminIsProvided) {
    const err = validateAdminCode(adminRaw!);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const updates: Partial<{ adminAccessCode: string }> = {};

  if (adminIsProvided) {
    // Hash with bcrypt cost-12; the plaintext is never stored.
    updates.adminAccessCode = await bcrypt.hash(adminRaw!, 12);
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to change — return current state
    res.json({
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
    adminCodeIsSet: updated!.adminAccessCode.length > 0,
  });
});


export default router;
