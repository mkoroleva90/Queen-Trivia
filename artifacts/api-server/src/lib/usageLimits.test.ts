import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set to run usageLimits.test.ts");
}

const { reserveAiUsage } = await import("../../dist/app.mjs") as {
  reserveAiUsage: (
    adminAccountId: number | null | undefined,
    gameId: number | null | undefined,
    action: "generate_bulk" | "generate_preview" | "regenerate" | "enhance" | "fact_check",
    questionCount?: number,
  ) => Promise<string | null>;
};

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

describe("AI usage reservations", () => {
  let adminAccountId: number;
  const previousEnforcement = process.env["ENFORCE_FREE_TIER_LIMITS"];
  const previousLimit = process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"];

  before(async () => {
    process.env["ENFORCE_FREE_TIER_LIMITS"] = "true";
    process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"] = "3";

    const suffix = `${process.pid}-${Date.now()}`;
    const result = await pool.query<{ id: number }>(
      `INSERT INTO admin_accounts (email, email_verified, plan)
       VALUES ($1, true, 'free')
       RETURNING id`,
      [`__test__ai_reservation_${suffix}@example.test`],
    );
    adminAccountId = result.rows[0]!.id;
  });

  after(async () => {
    if (adminAccountId) {
      await pool.query("DELETE FROM admin_accounts WHERE id = $1", [adminAccountId]);
    }

    if (previousEnforcement === undefined) {
      delete process.env["ENFORCE_FREE_TIER_LIMITS"];
    } else {
      process.env["ENFORCE_FREE_TIER_LIMITS"] = previousEnforcement;
    }
    if (previousLimit === undefined) {
      delete process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"];
    } else {
      process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"] = previousLimit;
    }
    await pool.end();
  });

  it("atomically caps concurrent reservations across database connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        reserveAiUsage(adminAccountId, null, "generate_preview", 1),
      ),
    );

    assert.equal(results.filter((result) => result === null).length, 3);
    assert.equal(results.filter((result) => typeof result === "string").length, 9);

    const stored = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM ai_usage_log WHERE admin_account_id = $1",
      [adminAccountId],
    );
    assert.equal(Number(stored.rows[0]!.count), 3);
  });
});