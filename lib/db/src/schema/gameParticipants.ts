
import {
 pgTable,
 serial,
 integer,
 timestamp,
 unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { gamesTable } from "./games";


export const gameParticipantsTable = pgTable(
 "game_participants",
 {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
   .notNull()
   .references(() => gamesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
   .notNull()
   .references(() => usersTable.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true })
   .notNull()
   .defaultNow(),
 },
 (t) => [unique().on(t.gameId, t.userId)],
);


export const insertGameParticipantSchema = createInsertSchema(
 gameParticipantsTable,
).omit({ id: true, joinedAt: true });
export type InsertGameParticipant = z.infer<
 typeof insertGameParticipantSchema
>;
export type GameParticipant = typeof gameParticipantsTable.$inferSelect;


