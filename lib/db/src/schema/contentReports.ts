import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { gamesTable } from "./games";
import { questionsTable } from "./questions";
import { usersTable } from "./users";

/**
 * Records player-submitted content reports.
 * Used for:
 *  - Apple App Store guideline 1.2 compliance (user-generated content moderation)
 *  - Email notifications to the platform owner on each new report
 *  - Owner-only retrieval via GET /api/owner/reports
 */
export const contentReportsTable = pgTable(
  "content_reports",
  {
    id: serial("id").primaryKey(),
    /** The game the report originated from. Nullable if the game is later deleted. */
    gameId: integer("game_id").references(() => gamesTable.id, {
      onDelete: "set null",
    }),
    /** The question on screen at the time of the report, if applicable. */
    questionId: integer("question_id").references(() => questionsTable.id, {
      onDelete: "set null",
    }),
    /** The player who submitted the report. Nullable if the user row is deleted. */
    reporterUserId: integer("reporter_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" }
    ),
    /** Reason chosen from the fixed list: hateful | sexual | harassment | spam | other. */
    reason: text("reason", {
      enum: ["hateful", "sexual", "harassment", "spam", "other"],
    }).notNull(),
    /** Optional free-text note from the player. Content-filtered before save. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_content_reports_game_id").on(table.gameId),
    index("idx_content_reports_created_at").on(table.createdAt),
  ]
);

export type ContentReport = typeof contentReportsTable.$inferSelect;
