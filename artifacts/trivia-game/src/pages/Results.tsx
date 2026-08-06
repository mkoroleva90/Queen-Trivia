
import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Footer } from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  useListGameQuestions,
  getListGameQuestionsQueryKey,
  useListUserAnswers,
  getListUserAnswersQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Minus,
  Share2,
  BarChart3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameResultParticipant = {
  id: number;
  userId: number;
  userName: string;
  totalScore: number;
  rank: number;
  correctCount: number;
  totalAnswered: number;
  joinedAt: string;
};

type GameResults = {
  game: { id: number; topic: string; difficulty: string; questionCount: number; status: string };
  participants: GameResultParticipant[];
  totalQuestions: number;
};

type QuestionStat = {
  id: number;
  questionText: string;
  questionType: string;
  points: number;
  orderIndex: number;
  totalAnswered: number;
  correctCount: number;
  percentCorrect: number | null;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  true_false:      "True / False",
  write_in:        "Write-In",
  matching:        "Matching",
  image_recognition: "Image",
};

// Avatar colours cycling for leaderboard rows
const RANK_AVATAR_COLORS = ["#ff0080", "#00ddff", "#8b5cf6", "#22c55e", "#f97316", "#a78bfa", "#34d399"];
function rankAvatarColor(idx: number) {
  return RANK_AVATAR_COLORS[idx % RANK_AVATAR_COLORS.length] ?? "#ff0080";
}

// ─── Results page ─────────────────────────────────────────────────────────────

export default function Results() {
  const params = useParams<{ gameId: string }>();
  const gameId = Number(params.gameId);
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [expandedQuestions, setExpandedQuestions] = useState(true);

  const { data: results, isLoading: resultsLoading, error: resultsError } = useQuery<GameResults>({
    queryKey: ["game-results", gameId],
    queryFn: async () => {
      const r = await fetch(`/api/games/${gameId}/results`);
      if (!r.ok) throw new Error(`Failed to load results: ${r.status}`);
      return r.json();
    },
    enabled: !!gameId,
    refetchInterval: 10000,
    retry: 3,
  });

  const { data: questionStats = [] } = useQuery<QuestionStat[]>({
    queryKey: ["question-stats", gameId],
    queryFn: async () => {
      const r = await fetch(`/api/games/${gameId}/questions/stats`);
      if (!r.ok) throw new Error(`Failed to load question stats: ${r.status}`);
      return r.json();
    },
    enabled: !!gameId,
  });

  const { data: questions = [] } = useListGameQuestions(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameQuestionsQueryKey(gameId) },
  });

  const { data: myAnswers = [] } = useListUserAnswers(gameId, userId, {
    query: { enabled: !!gameId && !!userId, queryKey: getListUserAnswersQueryKey(gameId, userId) },
  });

  // ── Derived ──
  const me         = results?.participants.find((p) => p.userId === userId);
  const myRank     = me?.rank ?? 0;
  const myScore    = me?.totalScore ?? 0;
  const myCorrect  = me?.correctCount ?? 0;
  const totalQ     = results?.totalQuestions ?? 0;
  const accuracy   = totalQ > 0 ? Math.round((myCorrect / totalQ) * 100) : 0;
  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.orderIndex - b.orderIndex),
    [questions],
  );
  const answerMap = useMemo(
    () => new Map(myAnswers.map((a) => [a.questionId, a])),
    [myAnswers],
  );
  const streak = useMemo(() => {
    let max = 0, cur = 0;
    for (const q of sortedQuestions) {
      const ans = answerMap.get(q.id);
      if (ans?.isCorrect) { cur++; max = Math.max(max, cur); } else cur = 0;
    }
    return max;
  }, [sortedQuestions, answerMap]);
  const bestType = useMemo(() => {
    const map: Record<string, { correct: number; total: number }> = {};
    for (const q of sortedQuestions) {
      const ans = answerMap.get(q.id);
      if (!ans) continue;
      const t = q.questionType;
      map[t] ??= { correct: 0, total: 0 };
      map[t]!.total++;
      if (ans.isCorrect) map[t]!.correct++;
    }
    let best: string | null = null, bestAcc = -1;
    for (const [type, s] of Object.entries(map)) {
      if (s.total === 0) continue;
      const acc = s.correct / s.total;
      if (acc > bestAcc) { best = type; bestAcc = acc; }
    }
    return best ? { type: best, accuracy: Math.round(bestAcc * 100) } : null;
  }, [sortedQuestions, answerMap]);
  const statsMap = useMemo(
    () => new Map(questionStats.map((s) => [s.id, s])),
    [questionStats],
  );

  // suppress unused-variable warnings while keeping derived values for potential reuse
  void accuracy; void streak; void bestType;

  const handleShare = async () => {
    const text = `I scored ${myScore} points${totalQ > 0 ? ` (${myCorrect}/${totalQ} correct)` : ""} on "${results?.game.topic ?? "Queen Trivia"}!" 🏆`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!", description: text });
    } catch {
      toast({ variant: "destructive", title: "Could not copy to clipboard" });
    }
  };

  // ── Loading / error guards ──
  if (resultsError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Trophy className="mx-auto h-12 w-12 text-destructive/40" />
          <p className="text-muted-foreground">Could not load results.</p>
          <p className="text-xs text-muted-foreground/60">{String(resultsError)}</p>
          <button className="text-sm text-primary underline" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (resultsLoading || !results) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Trophy className="mx-auto h-12 w-12 text-primary/40 animate-pulse" />
          <p className="text-muted-foreground">Loading results…</p>
        </div>
      </div>
    );
  }

  const { game, participants } = results;
  // Sort participants by rank for display order
  const sortedParticipants = [...participants].sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-md px-[22px] pt-12 pb-16 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <p
            className="font-semibold uppercase"
            style={{ fontSize: 10, letterSpacing: ".28em", color: "#a3aec2" }}
          >
            Final Scores
          </p>
          <h1 className="font-extrabold text-white break-words" style={{ fontSize: 26, letterSpacing: "-.02em" }}>
            {game.topic}
          </h1>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#a3aec2" }}>
            {totalQ} question{totalQ !== 1 ? "s" : ""} · {participants.length} player{participants.length !== 1 ? "s" : ""}
          </p>
        </motion.div>

        {/* ── Leaderboard ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div
            className="rounded-[16px] overflow-hidden"
            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}
          >
            {sortedParticipants.map((p, i) => {
              const isWinner = p.rank === 1;
              const isMe     = p.userId === userId;
              const avatarSize = isWinner ? 36 : 32;

              return (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="flex items-center gap-4 px-5"
                  style={{
                    paddingTop: 14,
                    paddingBottom: 14,
                    background: isWinner
                      ? "rgba(255,0,128,.12)"
                      : isMe
                        ? "rgba(255,255,255,.04)"
                        : "rgba(15,10,22,.6)",
                    borderBottom: i < sortedParticipants.length - 1
                      ? "1px solid rgba(255,255,255,.06)"
                      : "none",
                    boxShadow: isMe ? "inset 2px 0 0 #ffe500" : "none",
                  }}
                >
                  {/* Rank */}
                  <span
                    className="tabular-nums font-extrabold shrink-0"
                    style={{
                      fontSize: 15,
                      width: 20,
                      color: isMe ? "#ffe500" : isWinner ? "#ff5aa8" : "#a3aec2",
                    }}
                  >
                    {p.rank}
                  </span>

                  {/* Avatar circle */}
                  <div
                    className="flex items-center justify-center rounded-full font-extrabold shrink-0"
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      fontSize: isWinner ? 14 : 12,
                      background: rankAvatarColor(i),
                      color: "#ffffff",
                    }}
                  >
                    {p.userName.trim().charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <span
                    className="flex-1 min-w-0 font-bold truncate"
                    style={{
                      fontSize: isWinner ? 16 : 15,
                      color: isMe ? "#ffe500" : isWinner ? "#ffffff" : "#e2e8f0",
                    }}
                  >
                    {p.userName}
                    {isMe && !isWinner && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#ffe500", opacity: 0.7, marginLeft: 4 }}>
                        (you)
                      </span>
                    )}
                  </span>

                  {/* Score */}
                  <span
                    className="font-extrabold tabular-nums shrink-0"
                    style={{
                      fontSize: isWinner ? 17 : 15,
                      fontVariantNumeric: "tabular-nums",
                      color: isMe ? "#ffe500" : isWinner ? "#ffffff" : "#a3aec2",
                    }}
                  >
                    {p.totalScore}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Question breakdown ── */}
        {sortedQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-card-border bg-card/60 backdrop-blur">
              <button
                className="w-full flex items-center justify-between p-5 text-left"
                onClick={() => setExpandedQuestions((v) => !v)}
              >
                <span className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Question-by-Question Breakdown
                </span>
                {expandedQuestions
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {expandedQuestions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/50 divide-y divide-border/30">
                      {sortedQuestions.map((q, i) => {
                        const myAns = answerMap.get(q.id);
                        const stat  = statsMap.get(q.id);
                        const status = !myAns
                          ? "unanswered"
                          : myAns.isCorrect
                            ? "correct"
                            : myAns.pointsEarned > 0
                              ? "partial"
                              : "wrong";
                        const missed = status === "wrong" || status === "partial" || status === "unanswered";
                        const correctAnswer = myAns?.correctAnswer ?? q.correctAnswer;

                        return (
                          <div
                            key={q.id}
                            className={missed ? "border-l-[3px] border-red-500/70" : ""}
                            style={missed ? { background: "rgba(239,68,68,.045)" } : undefined}
                          >
                            {/* ── Row header ── */}
                            <div className="flex items-start gap-3 px-5 py-3.5" style={missed ? { paddingLeft: 17 } : undefined}>
                              <span className="text-xs font-bold text-muted-foreground mt-0.5 w-6 shrink-0">
                                Q{i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-snug break-words">
                                  {q.questionText}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType} · {q.points}pts
                                  {stat?.percentCorrect != null && (
                                    <> · {stat.percentCorrect}% got it right</>
                                  )}
                                </p>
                              </div>
                              <div className="shrink-0 mt-0.5">
                                {status === "correct"    && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                                {status === "partial"    && <Minus        className="h-5 w-5 text-amber-400"   />}
                                {status === "wrong"      && <XCircle      className="h-5 w-5 text-red-500"     />}
                                {status === "unanswered" && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </div>

                            {/* ── Answer detail — only for missed / unanswered ── */}
                            {missed && (
                              <div className="pb-3.5 space-y-1.5" style={{ paddingLeft: 17 + 24 + 12 /* border + Q-num col + gap */ }}>
                                {myAns && (
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 shrink-0">
                                      Your answer
                                    </span>
                                    <span className="text-sm text-red-400/60 font-medium line-through leading-snug break-words">
                                      {myAns.userAnswer}
                                    </span>
                                  </div>
                                )}
                                {correctAnswer && (
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 shrink-0">
                                      Correct answer
                                    </span>
                                    <span className="text-sm text-emerald-400 font-bold leading-snug break-words">
                                      {correctAnswer}
                                    </span>
                                  </div>
                                )}
                                {status === "unanswered" && (
                                  <p className="text-[11px] text-muted-foreground italic">
                                    You didn't answer this question.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}

        {/* ── Footer actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3 pt-2"
        >
          {/* Play again */}
          <button
            onClick={() => setLocation("/lobby")}
            className="flex-1 font-extrabold text-[15px]"
            style={{
              height: 52, borderRadius: 14,
              background: "#ffe500", color: "#0a0510",
              border: "none", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(255,229,0,.35)",
              letterSpacing: ".04em",
            }}
          >
            Play again
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="font-semibold text-sm flex items-center gap-2"
            style={{
              width: 92, height: 52, borderRadius: 14,
              background: "rgba(255,255,255,.07)",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,.14)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Share2 className="h-4 w-4 mx-auto" />
          </button>
        </motion.div>

      </div>
      <Footer />
    </div>
  );
}
