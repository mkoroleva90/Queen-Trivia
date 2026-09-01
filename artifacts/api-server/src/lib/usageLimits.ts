/**
 * Free-tier usage limits and enforcement logic.
 *
 * ALL enforcement is gated behind the ENFORCE_FREE_TIER_LIMITS env var (default: false).
 * When the switch is off, every host is effectively unlimited — nothing is blocked.
 * Recording still happens regardless so the owner can set real limits based on data.
 *
 * When the switch is on:
 *  - Free-tier hosts are capped at FREE_TIER_GAMES_PER_MONTH games per calendar month
 *  - Free-tier hosts are capped at FREE_TIER_AI_ACTIONS_PER_MONTH AI operations per month
 *  - Pro hosts have no enforcement (unlimited)
 *
 * To enable limits:  set ENFORCE_FREE_TIER_LIMITS=true in env vars.
 * To change limits:  set FREE_TIER_GAMES_PER_MONTH=N  (default 20)
 *                    set FREE_TIER_AI_ACTIONS_PER_MONTH=N  (default 150)
 */

import { and, eq, gte, count, sql } from "drizzle-orm";
import { db, gamesTable, aiUsageLogTable, adminAccountsTable } from "@workspace/db";

// ── Kill switch ───────────────────────────────────────────────────────────────

export function enforcementEnabled(): boolean {
  return process.env["ENFORCE_FREE_TIER_LIMITS"] === "true";
}

// ── Configurable limits ───────────────────────────────────────────────────────

export function freeTierGamesPerMonth(): number {
  const n = parseInt(process.env["FREE_TIER_GAMES_PER_MONTH"] ?? "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export function freeTierAiActionsPerMonth(): number {
  const n = parseInt(process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"] ?? "150", 10);
  return Number.isFinite(n) && n > 0 ? n : 150;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Returns a human-readable date string for the first day of next month (UTC). */
function resetDateString(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function getAdminPlan(adminAccountId: number): Promise<"free" | "pro"> {
  const [row] = await db
    .select({ plan: adminAccountsTable.plan })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.id, adminAccountId))
    .limit(1);
  return (row?.plan as "free" | "pro") ?? "free";
}

// ── Game creation limit ────────────────────────────────────────────────────────

/**
 * Check whether the host may create another game this month.
 * Returns null if allowed, or a friendly error message string if blocked.
 * Always returns null when enforcement is off.
 */
export async function checkGameCreationLimit(
  adminAccountId: number | null | undefined,
): Promise<string | null> {
  if (!enforcementEnabled()) return null;
  if (adminAccountId == null) return null; // legacy/code-based session

  const plan = await getAdminPlan(adminAccountId);
  if (plan === "pro") return null;

  const limit = freeTierGamesPerMonth();
  const since = startOfCurrentMonth();

  const [row] = await db
    .select({ value: count() })
    .from(gamesTable)
    .where(
      and(
        eq(gamesTable.ownerAdminId, adminAccountId),
        gte(gamesTable.createdAt, since),
      ),
    );

  const used = row?.value ?? 0;
  if (used >= limit) {
    return (
      `Monthly limit reached: you've created ${used} of ${limit} games allowed this month. ` +
      `Your limit resets on ${resetDateString()}.`
    );
  }
  return null;
}

// ── AI usage reservation ───────────────────────────────────────────────────────

/**
 * Atomically reserve and record an AI action before any provider work begins.
 *
 * The transaction-scoped advisory lock serializes reservations for one host
 * across every API replica. This prevents concurrent requests from observing
 * the same pre-limit count and all starting expensive provider operations.
 *
 * Returns null when reserved, or a friendly error message when blocked.
 * Metering still occurs when enforcement is disabled and for pro accounts.
 * Database errors intentionally propagate so provider work fails closed when
 * a durable reservation cannot be created.
 */
export async function reserveAiUsage(
  adminAccountId: number | null | undefined,
  gameId: number | null | undefined,
  action: "generate_bulk" | "generate_preview" | "regenerate" | "enhance" | "fact_check",
  questionCount = 1,
): Promise<string | null> {
  if (adminAccountId == null) return null; // legacy session — nothing to record

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${adminAccountId})`);

    if (enforcementEnabled()) {
      const [account] = await tx
        .select({ plan: adminAccountsTable.plan })
        .from(adminAccountsTable)
        .where(eq(adminAccountsTable.id, adminAccountId))
        .limit(1);

      if ((account?.plan ?? "free") !== "pro") {
        const limit = freeTierAiActionsPerMonth();
        const since = startOfCurrentMonth();
        const [row] = await tx
          .select({ value: count() })
          .from(aiUsageLogTable)
          .where(
            and(
              eq(aiUsageLogTable.adminAccountId, adminAccountId),
              gte(aiUsageLogTable.createdAt, since),
            ),
          );

        const used = row?.value ?? 0;
        if (used >= limit) {
          return (
            `Monthly limit reached: you've used ${used} of ${limit} AI generation actions this month. ` +
            `Your limit resets on ${resetDateString()}.`
          );
        }
      }
    }

    await tx.insert(aiUsageLogTable).values({
      adminAccountId,
      gameId: gameId ?? null,
      action,
      questionCount,
    });
    return null;
  });
}

// ── Aggregate helpers for owner dashboard ─────────────────────────────────────

export async function getHostUsageSummaries() {
  const since = startOfCurrentMonth();

  const gameStats = await db
    .select({
      adminAccountId: gamesTable.ownerAdminId,
      gamesThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${gamesTable.createdAt} >= ${since})`,
      gamesTotal: count(),
    })
    .from(gamesTable)
    .where(sql`${gamesTable.ownerAdminId} IS NOT NULL`)
    .groupBy(gamesTable.ownerAdminId);

  const aiStats = await db
    .select({
      adminAccountId: aiUsageLogTable.adminAccountId,
      aiActionsThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogTable.createdAt} >= ${since})`,
      aiActionsTotal: count(),
    })
    .from(aiUsageLogTable)
    .groupBy(aiUsageLogTable.adminAccountId);

  const hosts = await db
    .select({
      id: adminAccountsTable.id,
      email: adminAccountsTable.email,
      plan: adminAccountsTable.plan,
      createdAt: adminAccountsTable.createdAt,
    })
    .from(adminAccountsTable)
    .orderBy(adminAccountsTable.createdAt);

  const gameMap = new Map(gameStats.map((g) => [g.adminAccountId, g]));
  const aiMap = new Map(aiStats.map((a) => [a.adminAccountId, a]));

  return hosts.map((h) => {
    const g = gameMap.get(h.id);
    const a = aiMap.get(h.id);
    return {
      id: h.id,
      email: h.email,
      plan: h.plan,
      createdAt: h.createdAt,
      gamesTotal: Number(g?.gamesTotal ?? 0),
      gamesThisMonth: Number(g?.gamesThisMonth ?? 0),
      aiActionsTotal: Number(a?.aiActionsTotal ?? 0),
      aiActionsThisMonth: Number(a?.aiActionsThisMonth ?? 0),
    };
  });
}

export async function getOrphanedGames() {
  const { isNull, desc } = await import("drizzle-orm");
  const { questionsTable } = await import("@workspace/db");

  const games = await db
    .select({
      id: gamesTable.id,
      topic: gamesTable.topic,
      difficulty: gamesTable.difficulty,
      status: gamesTable.status,
      questionCount: gamesTable.questionCount,
      createdAt: gamesTable.createdAt,
    })
    .from(gamesTable)
    .where(isNull(gamesTable.ownerAdminId))
    .orderBy(desc(gamesTable.createdAt));

  return games;
}
