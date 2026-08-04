// Temporary integration test: verifies first-boot seeding is concurrency-safe
// and legacy default rotation works. Run against dev DB, restores nothing —
// it truncates admin_settings and leaves fresh random codes.
import { sql } from "drizzle-orm";
import { db, adminSettingsTable } from "@workspace/db";
import { bootstrapAccessCodes } from "./bootstrapAccessCodes.ts";

async function main() {
  if (process.env.BOOTSTRAP_TEST !== "1") {
    throw new Error(
      "Destructive test (truncates admin_settings). Set BOOTSTRAP_TEST=1 to run against a dev database only.",
    );
  }
  // 1) First boot: empty table + 5 concurrent bootstraps -> exactly 1 row
  await db.execute(sql`TRUNCATE admin_settings`);
  await Promise.all([1, 2, 3, 4, 5].map(() => bootstrapAccessCodes()));
  let rows = await db.select().from(adminSettingsTable);
  if (rows.length !== 1) throw new Error(`FAIL: expected 1 row after concurrent seed, got ${rows.length}`);
  if (rows[0]!.triviaAccessCode.length < 8 || rows[0]!.adminAccessCode.length < 8)
    throw new Error("FAIL: seeded codes too short");
  console.log("PASS: concurrent first-boot seed -> single row with random codes");

  // 2) Legacy defaults rotate
  await db.execute(sql`UPDATE admin_settings SET trivia_access_code='PLAY2026', admin_access_code='ADMIN2026'`);
  await Promise.all([1, 2, 3].map(() => bootstrapAccessCodes()));
  rows = await db.select().from(adminSettingsTable);
  if (rows.length !== 1) throw new Error(`FAIL: expected 1 row, got ${rows.length}`);
  if (rows[0]!.triviaAccessCode === "PLAY2026" || rows[0]!.adminAccessCode === "ADMIN2026")
    throw new Error("FAIL: defaults not rotated");
  console.log("PASS: legacy defaults rotated to random codes");

  // 3) Idempotent: non-default codes untouched
  const before = rows[0]!;
  await bootstrapAccessCodes();
  const [after] = await db.select().from(adminSettingsTable);
  if (after!.triviaAccessCode !== before.triviaAccessCode || after!.adminAccessCode !== before.adminAccessCode)
    throw new Error("FAIL: non-default codes were changed");
  console.log("PASS: idempotent for non-default codes");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
