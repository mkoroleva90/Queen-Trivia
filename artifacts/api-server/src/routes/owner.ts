/**
 * Owner-only management endpoints.
 *
 * Protected by the ADMIN_ACCESS_KEY environment variable — the same key the
 * app owner uses to manage the server. Pass it as a Bearer token:
 *   Authorization: Bearer <ADMIN_ACCESS_KEY>
 *
 * This is intentionally separate from the host-account auth system so the
 * owner can inspect and manage the platform without needing a host account.
 */
import { Router } from "express";
import { isNull, eq } from "drizzle-orm";
import { getHostUsageSummaries, getOrphanedGames } from "../lib/usageLimits";
import { db, adminAccountsTable, gamesTable } from "@workspace/db";

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

// PATCH /api/owner/hosts/:id/plan — set a host's plan (free ↔ pro)
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

// GET /api/owner/orphaned-games — games with no owner_admin_id
router.get("/owner/orphaned-games", requireOwnerKey, async (_req, res): Promise<void> => {
  const games = await getOrphanedGames();
  res.json({ games });
});

// POST /api/owner/games/:id/assign — assign an ownerless game to a host account
router.post("/owner/games/:id/assign", requireOwnerKey, async (req, res): Promise<void> => {
  const gameId = parseInt(req.params.id, 10);
  if (!Number.isFinite(gameId)) {
    res.status(400).json({ error: "Invalid game ID" });
    return;
  }

  const hostId = (req.body as { hostId?: unknown }).hostId;
  if (typeof hostId !== "number" || !Number.isFinite(hostId)) {
    res.status(400).json({ error: "hostId must be a number" });
    return;
  }

  // Verify the game exists and is currently ownerless
  const [game] = await db
    .select({ id: gamesTable.id, ownerAdminId: gamesTable.ownerAdminId })
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId))
    .limit(1);

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (game.ownerAdminId !== null) {
    res.status(409).json({ error: "Game already has an owner. Only ownerless games can be assigned." });
    return;
  }

  // Verify the host account exists
  const [host] = await db
    .select({ id: adminAccountsTable.id, email: adminAccountsTable.email })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.id, hostId))
    .limit(1);

  if (!host) {
    res.status(404).json({ error: "Host account not found" });
    return;
  }

  const [updated] = await db
    .update(gamesTable)
    .set({ ownerAdminId: hostId })
    .where(eq(gamesTable.id, gameId))
    .returning({ id: gamesTable.id, topic: gamesTable.topic, ownerAdminId: gamesTable.ownerAdminId });

  res.json({ ok: true, game: updated, assignedTo: host.email });
});

export default router;
