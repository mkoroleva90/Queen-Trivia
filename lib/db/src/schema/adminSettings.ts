
import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";


export const adminSettingsTable = pgTable("admin_settings", {
 id: serial("id").primaryKey(),
 triviaAccessCode: text("trivia_access_code").notNull(),
 adminAccessCode: text("admin_access_code").notNull(),
});


export const insertAdminSettingsSchema = createInsertSchema(
 adminSettingsTable,
).omit({ id: true });
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettingsTable.$inferSelect;


