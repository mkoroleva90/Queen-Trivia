import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";
import { COPY } from "@workspace/copy";

/**
 * Shown once, right after the player answers the last question. Mirrors the
 * mobile QuizCompleteModal in app/game/[id].tsx: same title, body and button.
 */
export function QuizCompleteModal({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(0,221,255,.13)" }}>
          <Flag className="h-7 w-7" style={{ color: "#00ddff" }} />
        </div>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">{COPY.gameplay.quizCompleteTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{COPY.gameplay.quizCompleteBody}</p>
        <Button className="w-full" onClick={onDismiss}>{COPY.common.gotIt}</Button>
      </DialogContent>
    </Dialog>
  );
}
