/**
 * NextQuestionPrompt — popup that shows the host their answer result and asks
 * whether to advance.
 *
 * Opens at the moment the old inline "Next question" / "End game" control
 * would have appeared. With a result it reads, top to bottom: verdict heading
 * (Correct! / Not quite — / Skipped), points earned and running total, any AI
 * feedback, then the advance button and "Not yet". Without a result (a
 * monitoring host, or an answer the server holds without feedback) the heading
 * is the plain "Ready for the next question?". "Not yet" (or closing the
 * dialog) hides it; the host reopens it from the small button rendered in
 * that control's old spot. The primary button calls the caller's existing
 * advance function.
 */

import { COPY } from "@workspace/copy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NextQuestionPromptProps {
  open: boolean;
  /** Fired on "Not yet", the close button, the overlay, or Escape. */
  onDismiss: () => void;
  /** Fired by the primary button — wire this to the existing advance function. */
  onConfirm: () => void;
  /** True when the current question is the last one, so the primary reads "End game". */
  isLastQuestion: boolean;
  /**
   * The result of the answer just submitted, shown above the buttons. Omit when
   * there is nothing to show (monitoring host, or an answer without feedback).
   */
  result?: { isCorrect: boolean; pointsEarned: number; totalScore: number; feedback?: string } | null;
  /** True when the result is for a skip (blank answer) — the heading reads "Skipped". */
  skipped?: boolean;
}

export function NextQuestionPrompt({
  open,
  onDismiss,
  onConfirm,
  isLastQuestion,
  result = null,
  skipped = false,
}: NextQuestionPromptProps) {
  // Verdict heading and its colour — same wording and colours as the inline feedback card.
  const heading = result
    ? skipped
      ? COPY.results.skipped
      : result.isCorrect
        ? COPY.gameplay.feedbackCorrect
        : COPY.gameplay.feedbackWrong
    : COPY.hostPlayAlong.nextPromptTitle;
  const headingColor = result
    ? skipped
      ? "text-[#ffe500]"
      : result.isCorrect
        ? "text-[#00ddff]"
        : "text-[#ff5aa8]"
    : "text-[#eef2f8]";
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm bg-[#0f1724] border-[#1b2740] text-[#eef2f8]">
        <DialogHeader>
          <DialogTitle className={`text-[18px] font-extrabold ${headingColor}`}>
            {heading}
          </DialogTitle>
        </DialogHeader>
        {result && (
          <div className="space-y-2">
            {/* Points earned and running total */}
            <p className="text-[13px] font-semibold text-[#9aa6bc]">
              +{result.pointsEarned} {COPY.gameplay.scorePtsSuffix} · {COPY.gameplay.feedbackTotalLabel} {result.totalScore}
            </p>
            {/* AI feedback (short-response questions) */}
            {result.feedback && (
              <p className="text-[13px] text-[#9aa6bc] leading-relaxed">
                {result.feedback}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 rounded-xl text-sm font-extrabold text-[#08130c] bg-[#ff0080] shadow-[0_8px_22px_-6px_rgba(255,0,128,.6)] hover:brightness-110 transition"
          >
            {isLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:brightness-110 transition"
          >
            {COPY.hostPlayAlong.nextPromptDismiss}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
