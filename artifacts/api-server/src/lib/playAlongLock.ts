import type { Response } from "express";
import { eq } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import { COPY } from "@workspace/copy";

/**
 * A host who plays along is a player until the game ends. While such a game is
 * live its questions are served to the host in the redacted player form, and
 * every route that would show or change a question's answer is closed.
 */
export function isLivePlayAlong(game: { status: string; hostPlaysAlong: boolean | null }): boolean {
  return game.status === "active" && game.hostPlaysAlong === true;
}

/**
 * Returns `true` when the game's questions may be edited (caller may proceed).
 * Returns `false` when the game is live with the host playing along — a 409
 * response has already been sent; the caller must return immediately.
 */
export async function assertQuestionsEditable(res: Response, gameId: number): Promise<boolean> {
  const [game] = await db
    .select({ status: gamesTable.status, hostPlaysAlong: gamesTable.hostPlaysAlong })
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId))
    .limit(1);
  if (game && isLivePlayAlong(game)) {
    res.status(409).json({ error: COPY.gameEditor.playAlongLocked, code: "play_along_locked" });
    return false;
  }
  return true;
}
