import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, gameParticipantsTable, gamesTable } from "@workspace/db";

/**
 * Players may access data only for games they have joined. This check is
 * deliberately based on the participant record, not a session game ID, so it
 * remains authoritative for cookie and mobile-token sessions alike.
 *
 * For email-auth admins (those with `adminAccountId` in session), verify the
 * requested game belongs to them. Ownerless games are NOT accessible to regular
 * hosts — they are surfaced only through the owner dashboard.
 *
 * Legacy code-based admins (no `adminAccountId`) may still manage ownerless
 * legacy games while those games are being assigned to host accounts. They
 * cannot access games owned by an email-authenticated host because they have
 * no tenant identity to authorize against.
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
  if (req.session.isAdmin !== true) {
    const userId = req.session.userId;
    if (userId == null) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }

    const [participant] = await db
      .select({ id: gameParticipantsTable.id })
      .from(gameParticipantsTable)
      .where(
        and(
          eq(gameParticipantsTable.gameId, gameId),
          eq(gameParticipantsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!participant) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }

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

  const ownerAdminId = req.session.adminAccountId;
  if (ownerAdminId == null) {
    // Legacy sessions have no tenant identity. Keep the migration path for
    // ownerless legacy games, but never let it cross into an owned tenant.
    if (game.ownerAdminId == null) return true;
    res.status(403).json({ error: "A host account is required to access this game" });
    return false;
  }

  // Ownerless games are not accessible to regular hosts.
  if (game.ownerAdminId == null) {
    res.status(403).json({ error: "This game has no owner. Contact the app owner to have it assigned to your account." });
    return false;
  }

  if (game.ownerAdminId !== ownerAdminId) {
    res.status(403).json({ error: "You do not own this game" });
    return false;
  }
  return true;
}
