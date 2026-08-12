import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  gamesTable,
  gameParticipantsTable,
  removedParticipantsTable,
} from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { safeEmit } from "../lib/socket.ts";
import { COPY } from "@workspace/copy";

const router: IRouter = Router();

/**
 * DELETE /api/games/:gameId/participants/:userId
 *
 * Host removes a player from a live game.
 * - Requires an authenticated admin session owning the game.
 * - Records the removal in removed_participants (prevents rejoin).
 * - Deletes the player from game_participants (removes from leaderboard).
 * - Emits player:kicked to the game room so the player's client can react.
 */
router.delete(
  "/games/:gameId/participants/:userId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const gameId = parseInt(String(req.params.gameId ?? ""), 10);
    const userId = parseInt(String(req.params.userId ?? ""), 10);

    if (!Number.isFinite(gameId) || !Number.isFinite(userId)) {
      res.status(400).json({ error: "Invalid gameId or userId" });
      return;
    }

    // Verify the requesting admin owns this game.
    if (!(await assertGameOwnership(req, res, gameId))) return;

    // Confirm the player is actually a participant.
    const [participant] = await db
      .select({ id: gameParticipantsTable.id })
      .from(gameParticipantsTable)
      .where(
        and(
          eq(gameParticipantsTable.gameId, gameId),
          eq(gameParticipantsTable.userId, userId),
        ),
      );

    if (!participant) {
      res.status(404).json({ error: "Player is not a participant of this game" });
      return;
    }

    // Verify the game exists and is still active (can only kick from live games).
    const [game] = await db
      .select({ status: gamesTable.status })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));

    if (!game || game.status !== "active") {
      res.status(409).json({ error: "Players can only be removed from active games" });
      return;
    }

    // Record removal first (idempotent via ON CONFLICT DO NOTHING equivalent —
    // the UNIQUE constraint means a second attempt just fails gracefully).
    await db
      .insert(removedParticipantsTable)
      .values({ gameId, userId })
      .onConflictDoNothing();

    // Remove from the live leaderboard / answered-by list.
    await db
      .delete(gameParticipantsTable)
      .where(
        and(
          eq(gameParticipantsTable.gameId, gameId),
          eq(gameParticipantsTable.userId, userId),
        ),
      );

    // Notify all clients in the game room. Each client checks whether the
    // kicked userId matches their own and self-disconnects if so.
    safeEmit(`game:${gameId}`, "player:kicked", { gameId, userId });

    res.status(200).json({ ok: true });
  },
);

export default router;
