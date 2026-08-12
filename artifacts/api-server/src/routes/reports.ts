import { Router } from "express";
import { SubmitReportBody } from "@workspace/api-zod";
import { db, contentReportsTable } from "@workspace/db";
import { containsBannedContent, logFlaggedContent } from "../lib/contentFilter.ts";
import { COPY } from "@workspace/copy";
import { sendContentReportEmail } from "../lib/email.ts";
import { reportsRateLimit } from "../middleware/authRateLimit.ts";

const router = Router();

/**
 * POST /reports
 *
 * Public — no authentication required. Players are anonymous.
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

  // Capture the player's user ID from their session if available.
  const reporterUserId = req.session.userId ?? null;

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
