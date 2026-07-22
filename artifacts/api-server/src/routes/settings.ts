
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adminSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";


const router: IRouter = Router();


// GET /api/settings — return current access codes (masked) for admins
router.get("/settings", requireAdmin, async (req, res): Promise<void> => {
 const [row] = await db.select().from(adminSettingsTable).limit(1);
 if (!row) {
     res.status(404).json({ error: "Settings not found" });
     return;
 }
 res.json({
     triviaAccessCode: row.triviaAccessCode,
     adminAccessCode: row.adminAccessCode,
 });
});


// PATCH /api/settings — update access codes
router.patch("/settings", requireAdmin, async (req, res): Promise<void> => {
 const [existing] = await db.select().from(adminSettingsTable).limit(1);
 if (!existing) {
     res.status(404).json({ error: "Settings not found" });
     return;
 }


 const triviaCode =
     typeof req.body?.triviaAccessCode === "string"
      ? req.body.triviaAccessCode.trim()
      : null;
 const adminCode =
     typeof req.body?.adminAccessCode === "string"
      ? req.body.adminAccessCode.trim()
      : null;


 if (triviaCode !== null && triviaCode.length < 4) {
     res
      .status(400)
      .json({ error: "Trivia access code must be at least 4 characters" });
    return;
}
if (adminCode !== null && adminCode.length < 4) {
    res
     .status(400)
     .json({ error: "Admin access code must be at least 4 characters" });
    return;
}
if (triviaCode !== null && adminCode !== null && triviaCode === adminCode) {
    res
     .status(400)
     .json({ error: "Trivia and admin codes must be different" });
    return;
}


const [updated] = await db
    .update(adminSettingsTable)
    .set({
     ...(triviaCode !== null && { triviaAccessCode: triviaCode }),
     ...(adminCode !== null && { adminAccessCode: adminCode }),
    })
    .where(eq(adminSettingsTable.id, existing.id))
    .returning();


res.json({
    triviaAccessCode: updated!.triviaAccessCode,
  adminAccessCode: updated!.adminAccessCode,
 });
});


export default router;


