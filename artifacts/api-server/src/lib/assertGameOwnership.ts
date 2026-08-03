import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";

/**
 * For email-auth admins (those with `adminAccountId` in session), verify the
 * requested game belongs to them OR is an unowned legacy game (owner_admin_id IS NULL).
 * Unowned games are accessible to any email-auth admin — they are legacy games
 * created before per-account ownership was introduced.
 *
 * Legacy code-based admins (no `adminAccountId`) are treated as super-admins
 * and bypass the check (backwards-compatibility path).
 *
 * Returns `true` if access is allowed (caller may proceed).
 * Returns `false` if access was denied — a 403 or 404 response has already been
 * sent; the caller must return immediately.
 */
export async function assertGameOwnership(
  req: Request,
  res: Response,
  gameId: number,
): Promise<boolean> {
  const ownerAdminId = req.session.adminAccountId;
  if (ownerAdminId == null) {
    // Code-based (legacy) admin — no ownership restriction.
    return true;
  }

  const [game] = await db
    .select({ ownerAdminId: gamesTable.ownerAdminId })
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId))
    .limit(1);

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return false;
  }

  // Unowned games (legacy) are accessible to any email-auth admin.
  if (game.ownerAdminId == null) return true;

  if (game.ownerAdminId !== ownerAdminId) {
    res.status(403).json({ error: "You do not own this game" });
    return false;
  }
  return true;
}
