import type { Request } from "express";

/**
 * Header a client sends when a request comes from the PLAYER experience.
 *
 * On web the host and the player share one cookie session, so a host who
 * joins their own game as a player would otherwise receive the unredacted
 * host payload (correct answers, grading order) mid-game. Player screens send
 * this header so the server treats the request as a player's regardless of
 * the session's admin flag. Mobile scopes player requests with a separate
 * Bearer token and does not need it.
 */
export const PLAYER_ROLE_HEADER = "x-trivia-role";

/** True when the request should receive host-only data. */
export function isAdminRequest(req: Request): boolean {
  return req.session.isAdmin === true && req.get(PLAYER_ROLE_HEADER) !== "player";
}
