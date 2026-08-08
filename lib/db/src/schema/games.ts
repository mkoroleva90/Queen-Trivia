
import {
 pgTable,
 text,
 serial,
 integer,
 boolean,
 timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";


export const gamesTable = pgTable("games", {
 id: serial("id").primaryKey(),
 topic: text("topic").notNull(),
 difficulty: text("difficulty", {
  enum: ["easy", "medium", "hard"],
 }).notNull(),
 questionCount: integer("question_count").notNull().default(0),
 status: text("status", { enum: ["waiting", "active", "completed"] })
  .notNull()
  .default("waiting"),
 accessCode: text("access_code").unique(),
 brief: text("brief"),
 createdAt: timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow(),
 createdByAdmin: boolean("created_by_admin").notNull().default(true),
 // Nullable so legacy/code-based-admin games remain valid.
 // When set, this game belongs exclusively to that admin account.
 ownerAdminId: integer("owner_admin_id"),
 // Play-along: host joins as a player and answers questions inline.
 hostPlaysAlong: boolean("host_plays_along").notNull().default(false),
 // The player-user record created for the host when hostPlaysAlong is on.
 hostUserId: integer("host_user_id").references(() => usersTable.id, { onDelete: "set null" }),
});


export const insertGameSchema = createInsertSchema(gamesTable).omit({
 id: true,
 createdAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;


