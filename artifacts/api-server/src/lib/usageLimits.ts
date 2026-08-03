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
 * To enable limits: set ENFORCE_FREE_TIER_LIMITS=true in env vars.
 * To set limits:    set FREE_TIER_GAMES_PER_MONTH=N  (default 5)
 *                   set FREE_TIER_AI_ACTIONS_PER_MONTH=N  (default 30)
 */

import { and, eq, gte, count, sql } from "drizzle-orm";
import { db, gamesTable, aiUsageLogTable, adminAccountsTable } from "@workspace/db";

// ── Kill switch ───────────────────────────────────────────────────────────────

export function enforcementEnabled(): boolean {
  return process.env["ENFORCE_FREE_TIER_LIMITS"] === "true";
}

// ── Configurable limits ───────────────────────────────────────────────────────

export function freeTierGamesPerMonth(): number {
  const n = parseInt(process.env["FREE_TIER_GAMES_PER_MONTH"] ?? "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function freeTierAiActionsPerMonth(): number {
  const n = parseInt(process.env["FREE_TIER_AI_ACTIONS_PER_MONTH"] ?? "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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
 * Returns null if allowed, or an error message string if blocked.
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
    return `Free plan limit reached: ${limit} games per month. Upgrade to Pro for unlimited games.`;
  }
  return null;
}

// ── AI usage limit ─────────────────────────────────────────────────────────────

/**
 * Check whether the host may perform another AI action this month.
 * Returns null if allowed, or an error message string if blocked.
 * Always returns null when enforcement is off.
 */
export async function checkAiUsageLimit(
  adminAccountId: number | null | undefined,
): Promise<string | null> {
  if (!enforcementEnabled()) return null;
  if (adminAccountId == null) return null;

  const plan = await getAdminPlan(adminAccountId);
  if (plan === "pro") return null;

  const limit = freeTierAiActionsPerMonth();
  const since = startOfCurrentMonth();

  const [row] = await db
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
    return `Free plan limit reached: ${limit} AI actions per month. Upgrade to Pro for unlimited AI.`;
  }
  return null;
}

// ── Usage recording ────────────────────────────────────────────────────────────

/**
 * Record one AI usage event.  Called after every successful Gemini operation,
 * regardless of whether enforcement is on.  Errors are swallowed so logging
 * never blocks the response.
 */
export async function recordAiUsage(
  adminAccountId: number | null | undefined,
  gameId: number | null | undefined,
  action: "generate_bulk" | "generate_preview" | "regenerate" | "enhance" | "fact_check",
  questionCount = 1,
): Promise<void> {
  if (adminAccountId == null) return; // legacy session — nothing to record
  try {
    await db.insert(aiUsageLogTable).values({
      adminAccountId,
      gameId: gameId ?? null,
      action,
      questionCount,
    });
  } catch (err) {
    // Non-fatal — never block the response for a logging failure
    console.error("[usageLimits] recordAiUsage failed:", err);
  }
}

// ── Aggregate helpers for owner dashboard ─────────────────────────────────────

export async function getHostUsageSummaries() {
  // Games per host this month
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

  // AI actions per host this month
  const aiStats = await db
    .select({
      adminAccountId: aiUsageLogTable.adminAccountId,
      aiActionsThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${aiUsageLogTable.createdAt} >= ${since})`,
      aiActionsTotal: count(),
    })
    .from(aiUsageLogTable)
    .groupBy(aiUsageLogTable.adminAccountId);

  // All host accounts
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
