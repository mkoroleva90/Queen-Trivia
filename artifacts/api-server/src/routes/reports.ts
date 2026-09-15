import { Router } from "express";
import { SubmitReportBody } from "@workspace/api-zod";
import {
  db,
  contentReportsTable,
  gameAccessGrantsTable,
  gameParticipantsTable,
  gamesTable,
  questionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";
import { sendContentReportEmail } from "../lib/email.ts";
import { reportsRateLimit } from "../middleware/authRateLimit.ts";

const router = Router();

/**
 * POST /reports
 *
 * Player session required. Players do not need a named account, but they must
 * have a server-recorded room-code grant or participant row for the game.
 *
 * Saves a content report, then fires a notification email (best-effort).
 * Returns 201 { id } on success.
 * Returns 422 { error, code: "content_filtered" } if the optional note
 * contains content that fails the server-side content filter.
 * Rate-limited to 15 reports per hour per IP to prevent email-quota
 * exhaustion and DB row flooding.
 */
router.post("/reports", reportsRateLimit, async (req, res): Promise<void> => {
  const parsed = SubmitReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Content filter: block slurs/hate speech in the optional free-text note.
  if (parsed.data.note && containsBannedContent(parsed.data.note)) {
    logFlaggedContent("report_note");
    res.status(422).json({
      error: COPY.contentFilter.reportNote,
      code: "content_filtered",
    });
    return;
  }

  const reporterUserId = req.session.userId;
  if (reporterUserId == null) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [game] = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(eq(gamesTable.id, parsed.data.gameId))
    .limit(1);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [[participant], [grant]] = await Promise.all([
    db
      .select({ userId: gameParticipantsTable.userId })
      .from(gameParticipantsTable)
      .where(
        and(
          eq(gameParticipantsTable.gameId, parsed.data.gameId),
          eq(gameParticipantsTable.userId, reporterUserId),
        ),
      )
      .limit(1),
    db
        .select({ userId: gameAccessGrantsTable.userId })
        .from(gameAccessGrantsTable)
        .where(
          and(
            eq(gameAccessGrantsTable.gameId, parsed.data.gameId),
            eq(gameAccessGrantsTable.userId, reporterUserId),
          ),
        )
        .limit(1),
  ]);
  if (!participant && !grant) {
    res.status(403).json({ error: "Not authorized for this game" });
    return;
  }

  if (parsed.data.questionId != null) {
    const [question] = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.id, parsed.data.questionId),
          eq(questionsTable.gameId, parsed.data.gameId),
        ),
      )
      .limit(1);
    if (!question) {
      res.status(404).json({ error: "Question not found in this game" });
      return;
    }
  }

  const [report] = await db
    .insert(contentReportsTable)
    .values({
      gameId:          parsed.data.gameId,
      questionId:      parsed.data.questionId ?? null,
      reporterUserId,
      reason:          parsed.data.reason,
      note:            parsed.data.note ?? null,
    })
    .returning();

  // Fire notification email without blocking the response.
  // sendContentReportEmail is best-effort: it logs but does not throw on failure.
  sendContentReportEmail(report).catch((err: unknown) => {
    console.error("[reports] Notification email error:", err);
  });

  res.status(201).json({ id: report.id });
});

export default router;
