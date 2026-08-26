
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
import { gamesTable } from "./games";
import { questionsTable } from "./questions";
export const answersTable = pgTable("answers", {
 id: serial("id").primaryKey(),
 userId: integer("user_id")
  .notNull()
  .references(() => usersTable.id, { onDelete: "cascade" }),
 gameId: integer("game_id")
  .notNull()
  .references(() => gamesTable.id, { onDelete: "cascade" }),
 questionId: integer("question_id")
  .notNull()
  .references(() => questionsTable.id, { onDelete: "cascade" }),
 userAnswer: text("user_answer").notNull(),
 isCorrect: boolean("is_correct").notNull(),
 pointsEarned: integer("points_earned").notNull().default(0),
 gradingStatus: text("grading_status", {
  enum: ["graded", "needs_review", "reviewed"],
 }).notNull().default("graded"),
 reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
 answeredAt: timestamp("answered_at", { withTimezone: true })
  .notNull()
  .defaultNow(),
});


export const insertAnswerSchema = createInsertSchema(answersTable).omit({
 id: true,
 answeredAt: true,
});
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answersTable.$inferSelect;
