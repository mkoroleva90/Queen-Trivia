/**
 * NextQuestionPrompt — popup that asks the host whether to advance.
 *
 * Opens at the moment the old inline "Next question" / "End game" control
 * would have appeared. "Not yet" (or closing the dialog) hides it; the host
 * reopens it from the small button rendered in that control's old spot.
 * The primary button calls the caller's existing advance function.
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
}

export function NextQuestionPrompt({ open, onDismiss, onConfirm, isLastQuestion }: NextQuestionPromptProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm bg-[#0f1724] border-[#1b2740] text-[#eef2f8]">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-extrabold text-[#eef2f8]">
            {COPY.hostPlayAlong.nextPromptTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:brightness-110 transition"
          >
            {COPY.hostPlayAlong.nextPromptDismiss}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-[#08130c] bg-[#ff0080] shadow-[0_8px_22px_-6px_rgba(255,0,128,.6)] hover:brightness-110 transition"
          >
            {isLastQuestion ? COPY.hostPlayAlong.endGameBtn : COPY.hostPlayAlong.nextQuestionBtn}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
