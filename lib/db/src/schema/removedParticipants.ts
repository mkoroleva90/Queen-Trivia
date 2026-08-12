import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { gamesTable } from "./games";
import { usersTable } from "./users";

export const removedParticipantsTable = pgTable(
  "removed_participants",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Display name of the removed player, captured at kick time.
     *  Used as a secondary block so a player cannot rejoin under a fresh
     *  identity (cleared storage / new device) by re-entering the same name.
     *  The functional index (game_id, lower(display_name)) is managed via
     *  migration SQL rather than Drizzle push. */
    displayName: text("display_name"),
    removedAt: timestamp("removed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.gameId, t.userId),
    index("idx_removed_participants_game_id").on(t.gameId),
  ],
);
