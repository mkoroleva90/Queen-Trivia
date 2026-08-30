import {
  bigserial,
  customType,
  pgTable,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Temporary storage used by @socket.io/postgres-adapter for binary payloads or
 * notifications larger than PostgreSQL's 8 KB NOTIFY limit.
 */
export const socketIoAttachmentsTable = pgTable(
  "socket_io_attachments",
  {
    id: bigserial("id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    payload: bytea("payload"),
  },
  (table) => [unique().on(table.id)],
);