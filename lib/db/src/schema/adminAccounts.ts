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
});

export type AdminAccount = typeof adminAccountsTable.$inferSelect;
