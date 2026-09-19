import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { COPY } from "@workspace/copy";
import {
  useRegenerateQuestion,
  useEnhanceQuestion,
  useFactCheckQuestion,
  useUpdateQuestion,
} from "@workspace/api-client-react";
import type {
  Question,
  RegenerateQuestionPreview,
  EnhanceQuestionResult,
  FactCheckSingleResult,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";

/**
 * Per-question AI tools (web). Mirrors the mobile AIActionMenu in
 * app/admin/[gameId].tsx exactly: pick Regenerate / Enhance / Fact-Check, wait,
 * review the result, then Apply or Discard. Used by the game editor and the
 * review list.
 */

type AIAction = "regenerate" | "enhance" | "fact-check";

const AI_COLOR = "#a855f7";

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

export function AiToolsDialog({
  question,
  gameId,
  onClose,
  onUpdate,
}: {
  /** The question the tools act on; null closes the dialog. */
  question: Question | null;
  gameId: number;
  onClose: () => void;
  /** Called after Apply saved the change. */
  onUpdate: (q: Question) => void;
}) {
  const [action, setAction] = useState<AIAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regenPreview, setRegenPreview] = useState<RegenerateQuestionPreview | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceQuestionResult | null>(null);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckSingleResult | null>(null);
  const [upgradeLimitMsg, setUpgradeLimitMsg] = useState("");

  const updateQuestion = useUpdateQuestion();
  const regenerate = useRegenerateQuestion();
  const enhance = useEnhanceQuestion();
  const factCheck = useFactCheckQuestion();

  const visible = question !== null;
  useEffect(() => {
    if (!visible) {
      setAction(null);
      setRegenPreview(null);
      setEnhanceResult(null);
      setFactCheckResult(null);
      setError("");
      setUpgradeLimitMsg("");
    }
  }, [visible]);

  if (!question) return null;

  const runAction = async (a: AIAction) => {
    setAction(a);
    setLoading(true);
    setError("");
    setRegenPreview(null);
    setEnhanceResult(null);
    setFactCheckResult(null);
    try {
      if (a === "regenerate") {
        const res = await regenerate.mutateAsync({ gameId, questionId: question.id, data: {} });
        setRegenPreview(res);
      } else if (a === "enhance") {
        const res = await enhance.mutateAsync({ gameId, questionId: question.id });
        setEnhanceResult(res);
      } else {
        const res = await factCheck.mutateAsync({ gameId, questionId: question.id });
        setFactCheckResult(res);
      }
    } catch (e: unknown) {
      const limitMsg = extractFreeTierLimitMsg(e);
      if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
      const msg = e instanceof Error ? e.message : COPY.aiGenerate.requestFailed;
      setError(msg.includes("429") ? COPY.aiGenerate.requestRateLimited : msg);
    } finally {
      setLoading(false);
    }
  };

  const applyRegenerate = async () => {
    if (!regenPreview) return;
    setLoading(true);
    try {
      const updated = await updateQuestion.mutateAsync({
        questionId: question.id,
        data: {
          questionType: regenPreview.questionType as Parameters<typeof updateQuestion.mutateAsync>[0]["data"]["questionType"],
          questionText: regenPreview.questionText,
          correctAnswer: regenPreview.correctAnswer,
          // Wrap string[] choices; if null (true_false / write_in), pass null — do NOT
          // fall back to the old question's options, which may be from a different type.
          options: regenPreview.options?.length ? { choices: regenPreview.options } : null,
          points: regenPreview.points,
          source: regenPreview.source || undefined,
        },
      });
      onUpdate(updated);
      onClose();
    } catch {
      setError(COPY.aiTools.applyFailed);
    } finally {
      setLoading(false);
    }
  };

  const applyEnhance = async () => {
    if (!enhanceResult) return;
    setLoading(true);
    try {
      const opts = enhanceResult.improvedOptions?.length
        ? { choices: enhanceResult.improvedOptions }
        : (question.options as Record<string, unknown> | null);
      const updated = await updateQuestion.mutateAsync({
        questionId: question.id,
        data: {
          questionText: enhanceResult.improvedQuestionText,
          options: opts,
          source: enhanceResult.suggestedSource || (question.source ?? undefined),
        },
      });
      onUpdate(updated);
      onClose();
    } catch {
      setError(COPY.aiTools.applyFailed);
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = factCheckResult
    ? factCheckResult.verdict === "CORRECT" ? "#00ddff"
      : factCheckResult.verdict === "INCORRECT" ? "#ff6b6b"
      : "#ffe500"
    : "#66728a";
  const VerdictIcon = factCheckResult?.verdict === "CORRECT" ? CheckCircle2
    : factCheckResult?.verdict === "INCORRECT" ? XCircle
    : HelpCircle;

  const actions: Array<{ id: AIAction; Icon: typeof RefreshCw; label: string; desc: string }> = [
    { id: "regenerate", Icon: RefreshCw, label: COPY.aiTools.regenerate.label, desc: COPY.aiTools.regenerate.desc },
    { id: "enhance", Icon: Wand2, label: COPY.aiTools.enhance.label, desc: COPY.aiTools.enhance.desc },
    { id: "fact-check", Icon: ShieldCheck, label: COPY.aiTools.factCheck.label, desc: COPY.aiTools.factCheck.desc },
  ];

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: AI_COLOR + "22" }}>
              <Sparkles className="h-4 w-4" style={{ color: AI_COLOR }} />
            </span>
            {COPY.aiTools.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground line-clamp-2">{question.questionText}</p>

        {/* Action selection */}
        {!action && (
          <div className="space-y-2">
            {actions.map(({ id, Icon, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => runAction(id)}
                className="flex w-full items-center gap-3 rounded-xl border border-card-border px-3 py-3 text-left hover:border-muted-foreground/50 transition"
              >
                <Icon className="h-5 w-5 shrink-0" style={{ color: AI_COLOR }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {action && loading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: AI_COLOR }} />
            <p className="text-sm text-muted-foreground">
              {action === "regenerate" ? COPY.aiTools.regenerate.loading
                : action === "enhance" ? COPY.aiTools.enhance.loading
                : COPY.aiTools.factCheck.loading}
            </p>
          </div>
        )}

        {/* Free-tier limit */}
        {!!upgradeLimitMsg && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
            <p className="text-sm font-semibold">{COPY.usageLimit.title}</p>
            <p className="text-sm text-muted-foreground">{upgradeLimitMsg}</p>
            <p className="text-xs text-muted-foreground">{COPY.usageLimit.resetsNote}</p>
            <Button variant="outline" className="w-full" onClick={onClose}>{COPY.common.gotIt}</Button>
          </div>
        )}

        {/* Error */}
        {!upgradeLimitMsg && !!error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Regenerate result */}
        {action === "regenerate" && !loading && regenPreview && (
          <div className="space-y-3">
            <div className="rounded-xl border border-card-border bg-card/50 p-3 space-y-2">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.newQuestionLabel}</p>
              <p className="text-sm font-medium leading-snug">{regenPreview.questionText}</p>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.correctAnswerLabel}</p>
              <p className="text-sm font-semibold text-secondary">{regenPreview.correctAnswer}</p>
              {regenPreview.options && regenPreview.options.length > 0 && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.optionsLabel}</p>
                  {regenPreview.options.map((o, i) => (
                    <p key={i} className="text-sm">• {o}</p>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>{COPY.common.discard}</Button>
              <Button className="flex-1 text-white" style={{ background: AI_COLOR }} onClick={applyRegenerate} disabled={loading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />{COPY.common.apply}
              </Button>
            </div>
          </div>
        )}

        {/* Enhance result */}
        {action === "enhance" && !loading && enhanceResult && (
          <div className="space-y-3">
            <div className="rounded-xl border border-card-border bg-card/50 p-3 space-y-2">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.improvedQuestionLabel}</p>
              <p className="text-sm font-medium leading-snug">{enhanceResult.improvedQuestionText}</p>
              {enhanceResult.improvedOptions && enhanceResult.improvedOptions.length > 0 && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.improvedOptionsLabel}</p>
                  {enhanceResult.improvedOptions.map((o, i) => (
                    <p key={i} className="text-sm">• {o}</p>
                  ))}
                </>
              )}
              {!!enhanceResult.factCheckNotes && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.notesLabel}</p>
                  <p className="text-sm text-muted-foreground">{enhanceResult.factCheckNotes}</p>
                </>
              )}
              {!!enhanceResult.suggestedSource && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.suggestedSourceLabel}</p>
                  <p className="text-sm text-accent">{enhanceResult.suggestedSource}</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>{COPY.common.discard}</Button>
              <Button className="flex-1 text-white" style={{ background: AI_COLOR }} onClick={applyEnhance} disabled={loading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />{COPY.common.apply}
              </Button>
            </div>
          </div>
        )}

        {/* Fact-check result */}
        {action === "fact-check" && !loading && factCheckResult && (
          <div className="space-y-3">
            <div className="rounded-xl border border-card-border bg-card/50 p-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: verdictColor + "22" }}>
                <VerdictIcon className="h-5 w-5" style={{ color: verdictColor }} />
                <span className="text-sm font-bold" style={{ color: verdictColor }}>
                  {factCheckResult.verdict.charAt(0).toUpperCase() + factCheckResult.verdict.slice(1)}
                  {" · "}
                  {COPY.aiTools.confidence(factCheckResult.confidence)}
                </span>
              </div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.explanationLabel}</p>
              <p className="text-sm leading-snug">{factCheckResult.explanation}</p>
              {!!factCheckResult.correctAnswerIfWrong && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.correctAnswerShouldBeLabel}</p>
                  <p className="text-sm font-semibold text-secondary">{factCheckResult.correctAnswerIfWrong}</p>
                </>
              )}
              {!!factCheckResult.groundingUrl && (
                <>
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{COPY.aiTools.sourceLabel}</p>
                  <a
                    href={factCheckResult.groundingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-accent underline underline-offset-2 break-all"
                  >
                    {factCheckResult.groundingUrl}
                  </a>
                </>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>{COPY.common.done}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
