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
    removedAt: timestamp("removed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.gameId, t.userId),
    index("idx_removed_participants_game_id").on(t.gameId),
  ],
);
