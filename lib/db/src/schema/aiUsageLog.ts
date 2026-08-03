import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { adminAccountsTable } from "./adminAccounts";
import { gamesTable } from "./games";

/**
 * Records every AI question-generation action per host account.
 * Used for:
 *  - Per-host usage metering (free-tier enforcement when ENFORCE_FREE_TIER_LIMITS=true)
 *  - Owner dashboard showing real AI spend per host
 *  - Audit trail of what was generated, when, and for which game
 */
export const aiUsageLogTable = pgTable(
  "ai_usage_log",
  {
    id: serial("id").primaryKey(),
    adminAccountId: integer("admin_account_id")
      .notNull()
      .references(() => adminAccountsTable.id, { onDelete: "cascade" }),
    gameId: integer("game_id").references(() => gamesTable.id, {
      onDelete: "set null",
    }),
    /** The kind of AI action performed. */
    action: text("action", {
      enum: [
        "generate_bulk",
        "generate_preview",
        "regenerate",
        "enhance",
        "fact_check",
      ],
    }).notNull(),
    /** Number of questions involved (>1 for bulk generate, 1 for single ops). */
    questionCount: integer("question_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_usage_log_admin_id").on(table.adminAccountId),
    index("idx_ai_usage_log_created_at").on(table.createdAt),
  ],
);

export type AiUsageLog = typeof aiUsageLogTable.$inferSelect;
