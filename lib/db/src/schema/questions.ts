
import {
 pgTable,
 text,
 serial,
 integer,
 jsonb,
 boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";


export const questionsTable = pgTable("questions", {
 id: serial("id").primaryKey(),
 gameId: integer("game_id")
  .notNull()
  .references(() => gamesTable.id, { onDelete: "cascade" }),
 questionText: text("question_text").notNull(),
 questionType: text("question_type", {
  enum: [
      "multiple_choice",
      "write_in",
      "matching",
      "image_recognition",
      "true_false",
      "multi_select",
      "ordering",
      "slider",
      "image_hotspot",
  ],
 }).notNull(),
 correctAnswer: text("correct_answer").notNull(),
 options: jsonb("options"),
 imageUrl: text("image_url"),
 points: integer("points").notNull().default(10),
 orderIndex: integer("order_index").notNull().default(0),
 source: text("source"),
 factCheckUrl: text("fact_check_url"),
 aiGenerated: boolean("ai_generated").notNull().default(false),
 verifiedByAdmin: boolean("verified_by_admin").notNull().default(false),
});


export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
 id: true,
});
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;


