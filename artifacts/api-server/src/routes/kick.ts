import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  gamesTable,
  gameParticipantsTable,
  usersTable,
  gameAccessGrantsTable,
  removedParticipantsTable,
} from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { assertGameOwnership } from "../lib/assertGameOwnership.ts";
import { revokePlayerFromGame, safeEmit } from "../lib/socket.ts";
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

    const outcome = await db.transaction(async (tx) => {
      // Serialize the full moderation action with joins, room-code logins, and
      // room-code rotation by locking the game row first.
      const [game] = await tx
        .select({ status: gamesTable.status })
        .from(gamesTable)
        .where(eq(gamesTable.id, gameId))
        .for("update");

      if (!game || game.status !== "active") return { kind: "inactive" as const };

      // Serialize participant deletion with Socket.IO admission on every
      // replica. Both paths use the same transaction-scoped advisory lock.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${gameId}, ${userId})`);

      const [participant] = await tx
        .select({ id: gameParticipantsTable.id, userName: usersTable.name })
        .from(gameParticipantsTable)
        .innerJoin(usersTable, eq(gameParticipantsTable.userId, usersTable.id))
        .where(
          and(
            eq(gameParticipantsTable.gameId, gameId),
            eq(gameParticipantsTable.userId, userId),
          ),
        );

      if (!participant) return { kind: "missing-participant" as const };

      await tx
        .insert(removedParticipantsTable)
        .values({
          gameId,
          userId,
          displayName: participant.userName,
        })
        .onConflictDoNothing();

      // Existing participants remain authorized by their participant rows.
      // Clearing all grants also closes alternate sessions opened pre-kick.
      await tx
        .delete(gameAccessGrantsTable)
        .where(eq(gameAccessGrantsTable.gameId, gameId));

      await tx
        .delete(gameParticipantsTable)
        .where(
          and(
            eq(gameParticipantsTable.gameId, gameId),
            eq(gameParticipantsTable.userId, userId),
          ),
        );

      return { kind: "removed" as const };
    });

    if (outcome.kind === "inactive") {
      res.status(409).json({ error: "Players can only be removed from active games" });
      return;
    }
    if (outcome.kind === "missing-participant") {
      res.status(404).json({ error: "Player is not a participant of this game" });
      return;
    }

    // Revoke the kicked player's existing room memberships before notifying
    // everyone else. The direct event lets the official client update its UI,
    // while the server-side leave prevents custom clients from remaining
    // subscribed after ignoring that event.
    await revokePlayerFromGame(gameId, userId);
    safeEmit(`game:${gameId}`, "player:kicked", { gameId, userId });

    res.status(200).json({ ok: true });
  },
);

export default router;
