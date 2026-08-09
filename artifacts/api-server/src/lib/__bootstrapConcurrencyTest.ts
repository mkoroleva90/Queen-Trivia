// Temporary integration test: verifies first-boot seeding is concurrency-safe
// and legacy plain-text admin code migration works. Run against dev DB only —
// it truncates admin_settings and leaves fresh random codes.
import { sql } from "drizzle-orm";
import { db, adminSettingsTable } from "@workspace/db";
import { bootstrapAccessCodes } from "./bootstrapAccessCodes.ts";
import { isBcryptHash } from "./accessCodeValidation.ts";

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
  // Admin code: should be a bcrypt hash (60 chars)
  if (!isBcryptHash(rows[0]!.adminAccessCode))
    throw new Error("FAIL: admin code is not a bcrypt hash after seeding");
  console.log("PASS: concurrent first-boot seed -> single row, admin code hashed");

  // 2) Plain-text admin code migrates to hash
  await db.execute(sql`UPDATE admin_settings SET admin_access_code='ADMIN2026'`);
  await Promise.all([1, 2, 3].map(() => bootstrapAccessCodes()));
  rows = await db.select().from(adminSettingsTable);
  if (rows.length !== 1) throw new Error(`FAIL: expected 1 row, got ${rows.length}`);
  if (!isBcryptHash(rows[0]!.adminAccessCode))
    throw new Error("FAIL: plain-text admin code not migrated to hash");
  console.log("PASS: plain-text admin code migrated to bcrypt hash");

  // 3) Idempotent: already-hashed admin code untouched
  const before = rows[0]!;
  await bootstrapAccessCodes();
  const [after] = await db.select().from(adminSettingsTable);
  if (after!.adminAccessCode !== before.adminAccessCode)
    throw new Error("FAIL: admin code was changed on second run");
  console.log("PASS: idempotent for hashed admin code");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
