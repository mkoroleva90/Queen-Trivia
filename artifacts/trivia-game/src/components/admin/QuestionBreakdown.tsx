import { COPY } from "@workspace/copy";
import type { Question } from "@workspace/api-client-react";

/**
 * Per-question breakdown on the host's end-of-game results (web). Mirrors the
 * mobile "Question Breakdown" list in app/admin/results/[gameId].tsx: every
 * question with its correct / answered figures, percentage, bar and the
 * correct answer. Correct answers are shown here only — the game is over.
 */

export type QuestionStatRow = {
  id: number;
  questionText: string;
  questionType: string;
  points: number;
  orderIndex: number;
  totalAnswered: number;
  correctCount: number;
  percentCorrect: number | null;
};

/** Same formatting rules as the mobile results screen. */
export function formatCorrectAnswer(questionType: string, correctAnswer: string): string {
  if (!correctAnswer) return correctAnswer;
  if (questionType === "image_hotspot") {
    const parts = correctAnswer.split(",").map((s) => parseFloat(s).toFixed(1));
    if (parts.length === 2) return `X: ${parts[0]}%, Y: ${parts[1]}%`;
  }
  if (questionType === "ordering") {
    const items = correctAnswer.split("|").map((item) => item.trim()).filter(Boolean);
    if (items.length > 1) return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    try {
      const parsed = JSON.parse(correctAnswer) as string[];
      if (Array.isArray(parsed)) return parsed.map((item, i) => `${i + 1}. ${item}`).join("\n");
    } catch { /* fall through */ }
  }
  if (questionType === "multi_select") {
    const choices = correctAnswer.split("|").map((choice) => choice.trim()).filter(Boolean);
    if (choices.length > 1) return choices.join(" · ");
  }
  if (questionType === "matching") {
    const pairs = correctAnswer
      .split("|")
      .map((pair) => {
        const separator = pair.indexOf(":");
        return separator > 0
          ? ([pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()] as const)
          : null;
      })
      .filter((pair): pair is readonly [string, string] => pair !== null);
    if (pairs.length > 0) return pairs.map(([left, right]) => `${left} → ${right}`).join("\n");
    try {
      const parsed = JSON.parse(correctAnswer) as [string, string][];
      if (Array.isArray(parsed)) return parsed.map(([a, b]) => `${a} → ${b}`).join("\n");
    } catch { /* fall through */ }
  }
  return correctAnswer;
}

export function QuestionBreakdown({
  stats,
  questions,
}: {
  stats: QuestionStatRow[];
  questions: Question[];
}) {
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  return (
    <div className="space-y-3">
      {stats.map((q, idx) => {
        const question = questionsById.get(q.id);
        const correctAnswer = question?.correctAnswer ?? "";
        const pct = q.percentCorrect;
        const good = pct !== null && pct >= 70;
        return (
          <div key={q.id} className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest text-[#66728a]">{COPY.adminResults.questionNumber(idx + 1)}</span>
              <span className="text-xs font-semibold text-[#ffe500]">{q.points}{COPY.gameplay.scorePtsSuffix}</span>
            </div>
            <p className="text-sm font-semibold text-[#eef2f8] leading-snug line-clamp-2">{q.questionText}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-[#00ddff] tabular-nums">{q.correctCount}/{q.totalAnswered}</span>
              <span className="text-xs text-[#66728a]">{COPY.adminResults.correctLabel}</span>
              {pct !== null && (
                <span
                  className="ml-auto rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
                  style={{ background: good ? "rgba(0,221,255,.13)" : "rgba(255,107,107,.13)", color: good ? "#00ddff" : "#ff6b6b" }}
                >
                  {pct}%
                </span>
              )}
            </div>
            {q.totalAnswered > 0 && (
              <div className="h-[5px] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-[#00ddff]" style={{ width: `${pct ?? 0}%` }} />
              </div>
            )}
            {!!correctAnswer && (
              <div className="pt-2 border-t border-[#1b2740]">
                <div className="text-[10px] font-bold tracking-widest text-[#00ddff] mb-1">{COPY.adminResults.correctAnswerLabel}</div>
                <p className="text-sm text-[#00ddff] whitespace-pre-line">{formatCorrectAnswer(q.questionType, correctAnswer)}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
