
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
 createdAt: timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow(),
 createdByAdmin: boolean("created_by_admin").notNull().default(true),
});


export const insertGameSchema = createInsertSchema(gamesTable).omit({
 id: true,
 createdAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;


