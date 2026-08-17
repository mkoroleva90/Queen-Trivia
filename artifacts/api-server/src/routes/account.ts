
import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import {
    db,
    adminAccountsTable,
    gamesTable,
    usersTable,
} from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";

const DISPLAY_NAME_MAX = 64;

const router: IRouter = Router();

/**
 * GET /api/account/display-name
 * Returns the host's current stored display name (null if not set).
 */
router.get("/account/display-name", requireAdmin, async (req, res): Promise<void> => {
    const adminId = req.session.adminAccountId!;
    const [account] = await db
        .select({ displayName: adminAccountsTable.displayName })
        .from(adminAccountsTable)
        .where(eq(adminAccountsTable.id, adminId));
    res.json({ displayName: account?.displayName ?? null });
});

/**
 * PATCH /api/account/display-name
 * Saves a new display name for the host.
 * Also syncs the name into the host's player records for any game that is not
 * yet completed, so the leaderboard updates in real time for live games.
 * Completed games are intentionally left unchanged.
 */
router.patch("/account/display-name", requireAdmin, async (req, res): Promise<void> => {
    const rawDisplayName: unknown = (req.body as Record<string, unknown>)?.displayName;
    if (typeof rawDisplayName !== "string") {
        res.status(400).json({ error: "invalid_body", message: "Invalid request body." });
        return;
    }

    const trimmed = rawDisplayName.trim();

    if (!trimmed) {
        res.status(422).json({ error: "empty", message: COPY.account.displayName.errorEmpty });
        return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX) {
        res.status(422).json({ error: "too_long", message: COPY.account.displayName.errorTooLong });
        return;
    }
    if (containsBannedContent(trimmed)) {
        logFlaggedContent("account_display_name");
        res.status(422).json({ error: "content_filtered", message: COPY.account.displayName.errorBlocked });
        return;
    }

    const adminId = req.session.adminAccountId!;

    // 1. Persist the new display name on the host account.
    await db
        .update(adminAccountsTable)
        .set({ displayName: trimmed })
        .where(eq(adminAccountsTable.id, adminId));

    // 2. Sync into host player records for games that are not yet completed.
    //    The new leaderboard name uses priority-1 (stored displayName), so the
    //    suffix always applies here.
    const newLeaderboardName = `${trimmed}${COPY.hostName.suffix}`;

    const incompleteHostGames = await db
        .select({ hostUserId: gamesTable.hostUserId })
        .from(gamesTable)
        .where(
            and(
                eq(gamesTable.ownerAdminId, adminId),
                ne(gamesTable.status, "completed"),
            ),
        );

    const hostUserIds = incompleteHostGames
        .map((g) => g.hostUserId)
        .filter((id): id is number => id != null);

    for (const userId of hostUserIds) {
        await db
            .update(usersTable)
            .set({ name: newLeaderboardName })
            .where(eq(usersTable.id, userId));
    }

    res.json({ ok: true, displayName: trimmed });
});

export default router;
