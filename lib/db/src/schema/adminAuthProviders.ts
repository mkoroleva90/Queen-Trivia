import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { adminAccountsTable } from "./adminAccounts";

export const adminAuthProvidersTable = pgTable(
  "admin_auth_providers",
  {
    id: serial("id").primaryKey(),
    adminAccountId: integer("admin_account_id")
      .notNull()
      .references(() => adminAccountsTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    providerEmail: text("provider_email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.provider, t.providerSubject),
    index("idx_admin_auth_providers_account_id").on(t.adminAccountId),
  ]
);

export type AdminAuthProvider =
  typeof adminAuthProvidersTable.$inferSelect;
