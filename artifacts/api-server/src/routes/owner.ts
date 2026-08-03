/**
 * Owner-only usage dashboard.
 *
 * Protected by the ADMIN_ACCESS_KEY environment variable — the same key the
 * app owner uses to manage the server. Pass it as a Bearer token:
 *   Authorization: Bearer <ADMIN_ACCESS_KEY>
 *
 * This endpoint is intentionally separate from the host-account auth system
 * so the owner can inspect usage without needing a host account.
 */
import { Router } from "express";
import { getHostUsageSummaries } from "../lib/usageLimits";
import { db, adminAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireOwnerKey(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const ownerKey = process.env["ADMIN_ACCESS_KEY"];
  if (!ownerKey) {
    res.status(503).json({ error: "ADMIN_ACCESS_KEY is not configured on this server." });
    return;
  }
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== ownerKey) {
    res.status(401).json({ error: "Invalid owner key." });
    return;
  }
  next();
}

// GET /api/owner/usage — list all hosts with plan + game/AI counts
router.get("/owner/usage", requireOwnerKey, async (_req, res): Promise<void> => {
  const summaries = await getHostUsageSummaries();
  res.json({ hosts: summaries });
});

// PATCH /api/owner/hosts/:id/plan — set a host's plan (free → pro or vice versa)
router.patch("/owner/hosts/:id/plan", requireOwnerKey, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid host ID" });
    return;
  }
  const plan = (req.body as { plan?: string }).plan;
  if (plan !== "free" && plan !== "pro") {
    res.status(400).json({ error: "plan must be 'free' or 'pro'" });
    return;
  }
  const [updated] = await db
    .update(adminAccountsTable)
    .set({ plan })
    .where(eq(adminAccountsTable.id, id))
    .returning({ id: adminAccountsTable.id, email: adminAccountsTable.email, plan: adminAccountsTable.plan });

  if (!updated) {
    res.status(404).json({ error: "Host not found" });
    return;
  }
  res.json(updated);
});

export default router;
