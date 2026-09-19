import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OpenTdbQuestionMixSelector, type OpenTdbImportMode } from "@/components/OpenTdbQuestionMixSelector";
import { COPY } from "@workspace/copy";
import { useGenerateGeminiQuestions } from "@workspace/api-client-react";
import type { Question } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

/**
 * Bulk "Generate Questions with AI" dialog (web). Mirrors the mobile
 * BulkGenerateModal in app/admin/[gameId].tsx field for field: topic,
 * difficulty, amount (1–20), question mix, avoid duplicates, brief; then a
 * result card with the added / discarded counts.
 */

const AI_COLOR = "#a855f7";
type Difficulty = "easy" | "medium" | "hard";

function extractFreeTierLimitMsg(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const status = "status" in err ? (err as { status: number }).status : 0;
  if (status !== 429) return null;
  const data = "data" in err ? (err as { data: unknown }).data : null;
  if (data && typeof data === "object" && "error" in data) {
    const msg = String((data as { error: unknown }).error);
    if (msg.includes(COPY.usageLimit.title)) return msg;
  }
  return null;
}

export function GenerateQuestionsDialog({
  open,
  gameId,
  gameTopic,
  gameDifficulty,
  gameBrief,
  questions,
  onClose,
  onGenerated,
}: {
  open: boolean;
  gameId: number;
  gameTopic: string;
  gameDifficulty: string;
  gameBrief?: string | null;
  questions: Question[];
  onClose: () => void;
  onGenerated: (count: number) => void;
}) {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [amount, setAmount] = useState("10");
  const [mode, setMode] = useState<OpenTdbImportMode | null>(null);
  const [avoidDups, setAvoidDups] = useState(true);
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<{ imported: number; discarded: number } | null>(null);
  const [error, setError] = useState("");
  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState("");
  const generateGemini = useGenerateGeminiQuestions();

  useEffect(() => {
    if (open) {
      setTopic(gameTopic);
      setDifficulty((gameDifficulty as Difficulty) ?? "medium");
      setAmount("10");
      setMode(null);
      setAvoidDups(true);
      setBrief(gameBrief ?? "");
      setResult(null);
      setError("");
      setUpgradeLimitMsg("");
    }
  }, [open, gameTopic, gameDifficulty, gameBrief]);

  const handleGenerate = async () => {
    setError("");
    const n = parseInt(amount, 10);
    if (isNaN(n) || n < 1 || n > 20) { setError(COPY.aiGenerate.amountRange); return; }
    if (!topic.trim()) { setError(COPY.aiGenerate.topicRequired); return; }
    if (mode === null) { setError(COPY.openTdbQuestionMix.hint); return; }
    try {
      const res = await generateGemini.mutateAsync({
        gameId,
        data: {
          topic: topic.trim(),
          difficulty,
          amount: n,
          existingQuestions: avoidDups ? questions.map((q) => q.questionText) : [],
          brief: brief.trim() || undefined,
          mode,
        },
      });
      setResult({ imported: res.imported, discarded: res.discarded ?? 0 });
      if (res.contentFilteredCount && res.contentFilteredCount > 0 && res.contentFilteredMessage) {
        setError(res.contentFilteredMessage);
      }
      onGenerated(res.imported);
    } catch (e: unknown) {
      const limitMsg = extractFreeTierLimitMsg(e);
      if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
      const errData = e && typeof e === "object" && "data" in e ? (e as { data: unknown }).data : null;
      const apiMsg = errData && typeof errData === "object" && "error" in errData ? String((errData as { error: unknown }).error) : null;
      const msg = apiMsg ?? (e instanceof Error ? e.message : COPY.aiGenerate.failed);
      setError(msg.includes("429") ? COPY.aiGenerate.rateLimited : msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !generateGemini.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: AI_COLOR + "22" }}>
              <Sparkles className="h-4 w-4" style={{ color: AI_COLOR }} />
            </span>
            {COPY.aiGenerate.title}
          </DialogTitle>
        </DialogHeader>

        {upgradeLimitMsg ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
            <p className="text-sm font-semibold">{COPY.usageLimit.title}</p>
            <p className="text-sm text-muted-foreground">{upgradeLimitMsg}</p>
            <p className="text-xs text-muted-foreground">{COPY.usageLimit.resetsNote}</p>
            <Button variant="outline" className="w-full" onClick={onClose}>{COPY.common.gotIt}</Button>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-secondary" />
            <p className="text-sm font-semibold text-secondary">{COPY.aiGenerate.addedResult(result.imported)}</p>
            {result.discarded > 0 && (
              <p className="text-xs text-muted-foreground">{COPY.aiGenerate.discardedResult(result.discarded)}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button variant="outline" className="border-secondary text-secondary" onClick={onClose}>{COPY.common.done}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{COPY.aiGenerate.topicLabel}</Label>
              <Input
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setError(""); }}
                placeholder={COPY.aiGenerate.topicPlaceholder}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{COPY.aiGenerate.difficultyLabel}</Label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className="flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition"
                    style={difficulty === d
                      ? { borderColor: AI_COLOR, background: AI_COLOR + "22", color: AI_COLOR }
                      : undefined}
                  >
                    {COPY.difficulty.selector[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{COPY.aiGenerate.amountLabel}</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                className="h-9 w-28"
              />
            </div>

            <OpenTdbQuestionMixSelector value={mode} onSelect={(m) => { setMode(m); setError(""); }} />

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={avoidDups}
                onChange={(e) => setAvoidDups(e.target.checked)}
              />
              <span className="text-sm text-muted-foreground">{COPY.questionEditor.avoidDuplicates}</span>
            </label>

            <div className="space-y-1.5">
              <Label>{COPY.build.aiSheet.briefLabel}</Label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={COPY.build.aiSheet.briefPlaceholder}
                className="resize-none text-sm"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <Button
              className="w-full text-white"
              style={{ background: AI_COLOR }}
              onClick={handleGenerate}
              disabled={generateGemini.isPending}
            >
              {generateGemini.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{COPY.aiGenerate.generatingLong}</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />{COPY.aiGenerate.generateBtn}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
