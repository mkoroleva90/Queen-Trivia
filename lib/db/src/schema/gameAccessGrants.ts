import {
  pgTable,
  serial,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { gamesTable } from "./games";
import { usersTable } from "./users";

/**
 * Durable proof that a player has supplied a game's room code.
 *
 * Session and mobile-token claims are intentionally not an authorization
 * source: they cannot distinguish a room-code grant from a retired
 * cross-game bridge grant. Only the login route writes this table.
 */
export const gameAccessGrantsTable = pgTable(
  "game_access_grants",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.gameId, t.userId),
    index("idx_game_access_grants_user_id").on(t.userId),
  ],
);