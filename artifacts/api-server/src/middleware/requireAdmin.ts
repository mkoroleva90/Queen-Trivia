
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { adminAccountsTable, db } from "@workspace/db";

export async function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    if (!req.session.isAdmin) {
        res.status(403).json({ error: "Admin access required" });
        return;
    }

    // Legacy ADMIN_ACCESS_KEY sessions intentionally have no account identity.
    // Email-authenticated sessions must still be tied to a live account;
    // otherwise a deleted account's cookie remains a privileged tenant ID.
    // Older email sessions have adminEmail but no adminAccountId, so reserve
    // the legacy bypass only for sessions with neither identity field.
    const adminAccountId = req.session.adminAccountId;
    const adminEmail = req.session.adminEmail;
    if (adminAccountId == null && !adminEmail) {
        next();
        return;
    }

    try {
        const [account] = await db
            .select({ id: adminAccountsTable.id })
            .from(adminAccountsTable)
            .where(
                adminAccountId != null
                    ? eq(adminAccountsTable.id, adminAccountId)
                    : eq(adminAccountsTable.email, adminEmail!),
            )
            .limit(1);

        if (!account) {
            // Do not rely solely on deleting the session row: this request may
            // have loaded a stale cookie before account deletion completed.
            req.session.isAdmin = false;
            req.session.adminAccountId = undefined;
            req.session.adminEmail = undefined;
            res.status(403).json({ error: "Admin access required" });
            return;
        }
    } catch {
        // Account existence is part of authorization. If it cannot be checked,
        // fail closed rather than allowing a stale privileged session through.
        res.status(503).json({ error: "Unable to verify admin access" });
        return;
    }

    next();
}


