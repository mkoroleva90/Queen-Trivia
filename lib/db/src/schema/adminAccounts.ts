import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const adminAccountsTable = pgTable("admin_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationTokenHash: text("verification_token_hash"),
  verificationTokenExpiry: timestamp("verification_token_expiry", {
    withTimezone: true,
  }),
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Monetization: plan tier and per-host state.
  // Enforcement is gated behind ENFORCE_FREE_TIER_LIMITS env var (default off).
  plan: text("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  // Used to invalidate mobile Bearer tokens issued before a password change.
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
});

export type AdminAccount = typeof adminAccountsTable.$inferSelect;
