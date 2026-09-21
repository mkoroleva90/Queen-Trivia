import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COPY } from "@workspace/copy";
import { useImportOpenTdbQuestions } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Database, Loader2 } from "lucide-react";

/**
 * Import Open Trivia Database questions into an existing game (web). Mirrors
 * the mobile ImportOpenTdbModal in app/admin/[gameId].tsx: category,
 * difficulty, amount (1–50), then a result card.
 */

const OPENTDB_CATEGORIES = COPY.openTdbCategories;
type Difficulty = "easy" | "medium" | "hard";

export function ImportOpenTdbDialog({
  open,
  gameId,
  onClose,
  onImported,
}: {
  open: boolean;
  gameId: number;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [categoryId, setCategoryId] = useState<number>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [amount, setAmount] = useState("10");
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState("");
  const importMutation = useImportOpenTdbQuestions();

  useEffect(() => {
    if (open) {
      setCategoryId(9);
      setDifficulty("medium");
      setAmount("10");
      setResult(null);
      setError("");
    }
  }, [open]);

  const handleImport = async () => {
    setError("");
    const n = parseInt(amount, 10);
    if (isNaN(n) || n < 1 || n > 50) { setError(COPY.openTdbImport.amountError); return; }
    try {
      const res = await importMutation.mutateAsync({
        gameId,
        data: { categoryId, difficulty, amount: n },
      });
      setResult({ imported: res.imported });
      onImported(res.imported);
    } catch (e) {
      // Same mapping as mobile.
      const msg = e instanceof Error ? e.message : COPY.aiGenerate.importFailed;
      const lower = msg.toLowerCase();
      const isNetworkError = e instanceof TypeError || lower.includes("failed to fetch") || lower.includes("network error");
      const isTimeoutError = (e instanceof Error && e.name === "AbortError") || lower.includes("timeout") || lower.includes("timed out");
      if (isNetworkError || isTimeoutError) {
        setError(COPY.openTdbImport.errorNetwork);
      } else if (msg.includes("429") || lower.includes("rate limit")) {
        setError(COPY.openTdbImport.errorRateLimit);
      } else if (msg.includes("422") || lower.includes("no questions")) {
        setError(COPY.openTdbImport.errorNoQuestions);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importMutation.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> {COPY.heading.importFromOtdb}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-secondary" />
            <p className="text-sm font-semibold text-secondary">{COPY.openTdbImport.importedResult(result.imported)}</p>
            <Button variant="outline" className="border-secondary text-secondary" onClick={onClose}>{COPY.common.done}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{COPY.openTdbImport.categoryLabel}</Label>
              <Select value={String(categoryId)} onValueChange={(v) => { setCategoryId(Number(v)); setError(""); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder={COPY.openTdbImport.selectPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {OPENTDB_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{COPY.openTdbImport.difficultyLabel}</Label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      difficulty === d ? "border-primary bg-primary/15 text-primary" : "border-card-border text-muted-foreground"
                    }`}
                  >
                    {COPY.difficulty.selector[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{COPY.openTdbImport.amountLabel}</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                className="h-9 w-28"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <Button className="w-full" onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{COPY.openTdbImport.importing}</>
              ) : (
                <><Database className="mr-2 h-4 w-4" />{COPY.openTdbImport.importBtn}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
