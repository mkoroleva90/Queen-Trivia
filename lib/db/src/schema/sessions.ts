
import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// Session storage table for connect-pg-simple (express-session store).
export const sessionsTable = pgTable(
    "sessions",
    {
        sid: varchar("sid").primaryKey(),
        sess: json("sess").notNull(),
        expire: timestamp("expire", { precision: 6 }).notNull(),
    },
    (table) => [index("IDX_session_expire").on(table.expire)],
);
