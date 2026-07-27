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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
    Trophy,
    Crown,
    Medal,
    Star,
    Target,
    Zap,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Minus,
    Share2,
    ArrowLeft,
    BarChart3,
} from "lucide-react";

// ─── Types────────────────────────────────────────────────────────────────────

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
    game: {
        id: number;
        topic: string;
        difficulty: string;
        questionCount: number;
        status: string;
    };
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
    true_false: "True / False",
    write_in: "Write-In",
    matching: "Matching",
    image_recognition: "Image",
};

const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "bg-secondary/15 text-secondary border-secondary/40",
    medium: "bg-accent/15 text-accent border-accent/40",
    hard: "bg-primary/15 text-primary border-primary/40",
};

function RankIcon({ rank }: { rank: number }) {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return (
        <span className="text-sm font-bold text-muted-foreground">{rank}</span>
    );
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
    const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set());

    const {
        data: results,
        isLoading: resultsLoading,
        error: resultsError,
    } = useQuery<GameResults>({
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
            if (!r.ok)
                throw new Error(`Failed to load question stats: ${r.status}`);
            return r.json();
        },
        enabled: !!gameId,
    });

    const { data: questions = [] } = useListGameQuestions(gameId, {
        query: {
            enabled: !!gameId,
            queryKey: getListGameQuestionsQueryKey(gameId),
        },
    });

    const { data: myAnswers = [] } = useListUserAnswers(gameId, userId, {
        query: {
            enabled: !!gameId && !!userId,
            queryKey: getListUserAnswersQueryKey(gameId, userId),
        },
    });

    // ── Derived stats ──
    const me = results?.participants.find((p) => p.userId === userId);
    const myRank = me?.rank ?? 0;
    const myScore = me?.totalScore ?? 0;
    const myCorrect = me?.correctCount ?? 0;
    const totalQ = results?.totalQuestions ?? 0;
    const accuracy = totalQ > 0 ? Math.round((myCorrect / totalQ) * 100) : 0;
    const sortedQuestions = useMemo(
        () => [...questions].sort((a, b) => a.orderIndex - b.orderIndex),
        [questions],
    );

    const answerMap = useMemo(
        () => new Map(myAnswers.map((a) => [a.questionId, a])),
        [myAnswers],
    );

    const streak = useMemo(() => {
        let max = 0,
            cur = 0;
        for (const q of sortedQuestions) {
            const ans = answerMap.get(q.id);
            if (ans?.isCorrect) {
                cur++;
                max = Math.max(max, cur);
            } else cur = 0;
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
        let best: string | null = null,
            bestAcc = -1;
        for (const [type, s] of Object.entries(map)) {
            if (s.total === 0) continue;
            const acc = s.correct / s.total;
            if (acc > bestAcc) {
                best = type;
                bestAcc = acc;
            }
        }
        return best
            ? { type: best, accuracy: Math.round(bestAcc * 100) }
            : null;
    }, [sortedQuestions, answerMap]);

    const statsMap = useMemo(
        () => new Map(questionStats.map((s) => [s.id, s])),
        [questionStats],
    );

    const handleShare = async () => {
        const text = `I scored ${myScore} points${totalQ > 0 ? ` (${myCorrect}/${totalQ}correct)` : ""} on "${results?.game.topic ?? "Trivia Night"}!" �`;
        try {
            await navigator.clipboard.writeText(text);
            toast({ title: "Copied to clipboard!", description: text });
        } catch {
            toast({
                variant: "destructive",
                title: "Could not copy to clipboard",
            });
        }
    };

    const toggleQ = (id: number) => {
        setExpandedQ((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    if (resultsError) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Trophy className="mx-auto h-12 w-12 text-destructive/40" />
                    <p className="text-muted-foreground">
                        Could not load results.
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        {String(resultsError)}
                    </p>
                    <button
                        className="text-sm text-primary underline"
                        onClick={() => window.location.reload()}
                    >
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

    return (
        <div className="min-h-[100dvh] p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                {/* ── Header ── */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-3"
                >
                    <div className="flex justify-start mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation("/lobby")}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Lobby
                        </Button>
                    </div>
                    <motion.div
                        initial={{ scale: 0.5, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 18,
                            delay: 0.1,
                        }}
                    >
                        <Trophy className="mx-auto h-20 w-20 text-accent" />
                    </motion.div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary">
                            GAME OVER
                        </h1>
                        <p className="text-xl font-semibold text-muted-foreground mt-1">
                            {game.topic}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <Badge
                            variant="outline"
                            className={`uppercase${DIFFICULTY_COLORS[game.difficulty] ?? ""}`}
                        >
                            {game.difficulty}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                            {totalQ} {totalQ === 1 ? "question" : "questions"}
                        </span>
                    </div>
                </motion.div>

                {/* ── My stats ── */}
                {me && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <Card className="border-2 border-accent/40 bg-accent/5">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center justify-center h-12 w-12 rounded-full border-2border-accent/50 bg-accent/10">
                                        <RankIcon rank={myRank} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold">
                                            {user?.name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Rank #{myRank} of{" "}
                                            {participants.length}
                                        </p>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className="text-4xl font-black tabular-nums text-accent">
                                            {myScore}
                                        </p>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                                            points
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        {
                                            icon: Target,
                                            label: "Correct",
                                            value: `${myCorrect} / ${totalQ}`,
                                            color: "text-secondary",
                                        },
                                        {
                                            icon: BarChart3,
                                            label: "Accuracy",
                                            value: `${accuracy}%`,
                                            color: "text-primary",
                                        },
                                        {
                                            icon: Zap,
                                            label: "Best Streak",
                                            value: `${streak}`,
                                            color: "text-accent",
                                        },
                                        {
                                            icon: Star,
                                            label: "Best Type",
                                            value: bestType
                                                ? `${bestType.accuracy}%`
                                                : "—",
                                            sub: bestType
                                                ? (QUESTION_TYPE_LABELS[
                                                      bestType.type
                                                  ] ?? bestType.type)
                                                : undefined,
                                            color: "text-secondary",
                                        },
                                    ].map((s) => (
                                        <div
                                            key={s.label}
                                            className="rounded-lg border border-card-border bg-background/40 p-3 text-center"
                                        >
                                            <s.icon
                                                className={`h-5 w-5 mx-auto mb-1 ${s.color}`}
                                            />
                                            <p className="text-lg font-bold tabular-nums">
                                                {s.value}
                                            </p>
                                            {s.sub && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    {s.sub}
                                                </p>
                                            )}
                                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                                {s.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* ── Final leaderboard ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                >
                    <Card className="border-card-border bg-card/60 backdrop-blur">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widesttext-muted-foreground">
                                <Trophy className="h-4 w-4 text-accent" /> Final
                                Standings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {participants.map((p, i) => {
                                const isMe = p.userId === userId;
                                const pAcc =
                                    totalQ > 0
                                        ? Math.round(
                                              (p.correctCount / totalQ) * 100,
                                          )
                                        : 0;
                                return (
                                    <motion.div
                                        key={p.userId}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.05 }}
                                        className={`flex items-center gap-4 px-5 py-3.5 border-b border-border/50last:border-0 ${isMe ? "bg-accent/5" : ""}`}
                                    >
                                        {/* Rank */}
                                        <div className="w-8 flex justify-center shrink-0">
                                            <RankIcon rank={p.rank} />
                                        </div>

                                        {/* Name + accuracy */}
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className={`font-semibold truncate ${isMe ? "text-accent" : ""}`}
                                            >
                                                {p.userName}
                                                {isMe && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        (you)
                                                    </span>
                                                )}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Progress
                                                    value={pAcc}
                                                    className="h-1.5 w-20"
                                                />
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    {p.correctCount}/{totalQ} ·{" "}
                                                    {pAcc}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Score */}
                                        <div className="text-right shrink-0">
                                            <span
                                                className={`text-xl font-black tabular-nums ${isMe ? "text-accent" : ""}`}
                                            >
                                                {p.totalScore}
                                            </span>
                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                                pts
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Question breakdown ── */}
                {sortedQuestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
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
                                {expandedQuestions ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
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
                                        <div className="border-t border-border/50 divide-y divide-border/50">
                                            {sortedQuestions.map((q, i) => {
                                                const myAns = answerMap.get(
                                                    q.id,
                                                );
                                                const stat = statsMap.get(q.id);
                                                const isOpen = expandedQ.has(
                                                    q.id,
                                                );
                                                const status = !myAns
                                                    ? "unanswered"
                                                    : myAns.isCorrect
                                                      ? "correct"
                                                      : myAns.pointsEarned > 0
                                                        ? "partial"
                                                        : "wrong";

                                                return (
                                                    <div key={q.id}>
                                                        <button
                                                            className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
                                                            onClick={() =>
                                                                toggleQ(q.id)
                                                            }
                                                        >
                                                            <span className="text-xs font-bold text-muted-foreground mt-0.5 w-6shrink-0">
                                                                Q{i + 1}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium leading-snug line-clamp-2">
                                                                    {
                                                                        q.questionText
                                                                    }
                                                                </p>
                                                                {/* Correct answer — always visible */}
                                                                {(q.correctAnswer ||
                                                                    myAns?.correctAnswer) && (
                                                                    <p className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                                                                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                                        {q.correctAnswer ??
                                                                            myAns?.correctAnswer}
                                                                    </p>
                                                                )}
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                    {QUESTION_TYPE_LABELS[
                                                                        q
                                                                            .questionType
                                                                    ] ??
                                                                        q.questionType}{" "}
                                                                    · {q.points}
                                                                    pts
                                                                    {stat?.percentCorrect !=
                                                                        null && (
                                                                        <>
                                                                            {" "}
                                                                            ·{" "}
                                                                            {
                                                                                stat.percentCorrect
                                                                            }
                                                                            %
                                                                            got
                                                                            it
                                                                            right
                                                                        </>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {status ===
                                                                    "correct" && (
                                                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                                )}
                                                                {status ===
                                                                    "partial" && (
                                                                    <Minus className="h-5 w-5 text-amber-500" />
                                                                )}
                                                                {status ===
                                                                    "wrong" && (
                                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                                )}
                                                                {status ===
                                                                    "unanswered" && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )}
                                                                {isOpen ? (
                                                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                        </button>

                                                        <AnimatePresence>
                                                            {isOpen && (
                                                                <motion.div
                                                                    initial={{
                                                                        height: 0,
                                                                        opacity: 0,
                                                                    }}
                                                                    animate={{
                                                                        height: "auto",
                                                                        opacity: 1,
                                                                    }}
                                                                    exit={{
                                                                        height: 0,
                                                                        opacity: 0,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.15,
                                                                    }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="px-14 pb-4 space-y-2">
                                                                        {myAns ? (
                                                                            <>
                                                                                <div className="grid grid-cols-2 gap-3">
                                                                                    <div
                                                                                        className={`rounded-lg border p-3 text-sm ${
                                                                                            status ===
                                                                                            "correct"
                                                                                                ? "border-emerald-500/40 bg-emerald-500/5"
                                                                                                : status ===
                                                                                                    "partial"
                                                                                                  ? "border-amber-500/40 bg-amber-500/5"
                                                                                                  : "border-red-500/40 bg-red-500/5"
                                                                                        }`}
                                                                                    >
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-widesttext-muted-foreground mb-1">
                                                                                            Your
                                                                                            answer
                                                                                        </p>
                                                                                        <p className="font-medium leading-snug">
                                                                                            {
                                                                                                myAns.userAnswer
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                    {myAns.correctAnswer !==
                                                                                        undefined && (
                                                                                        <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-sm">
                                                                                            <p className="text-[10px] font-semibold uppercase tracking-widesttext-muted-foreground mb-1">
                                                                                                Correct
                                                                                                answer
                                                                                            </p>
                                                                                            <p className="font-medium leading-snug">
                                                                                                {
                                                                                                    myAns.correctAnswer
                                                                                                }
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center justify-between text-sm">
                                                                                    <span
                                                                                        className={`font-bold ${
                                                                                            status ===
                                                                                            "correct"
                                                                                                ? "text-emerald-500"
                                                                                                : status ===
                                                                                                    "partial"
                                                                                                  ? "text-amber-500"
                                                                                                  : "text-muted-foreground"
                                                                                        }`}
                                                                                    >
                                                                                        {myAns.pointsEarned >
                                                                                        0
                                                                                            ? `+${myAns.pointsEarned}`
                                                                                            : "0"}{" "}
                                                                                        /
                                                                                        {
                                                                                            q.points
                                                                                        }{" "}
                                                                                        pts
                                                                                    </span>
                                                                                    {stat &&
                                                                                        stat.totalAnswered >
                                                                                            0 && (
                                                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                                                <span>
                                                                                                    {
                                                                                                        stat.correctCount
                                                                                                    }
                                                                                                    /
                                                                                                    {
                                                                                                        stat.totalAnswered
                                                                                                    }{" "}
                                                                                                    playerscorrect
                                                                                                </span>
                                                                                                <Progress
                                                                                                    value={
                                                                                                        stat.percentCorrect ??
                                                                                                        0
                                                                                                    }
                                                                                                    className="w-16 h-1.5"
                                                                                                />
                                                                                            </div>
                                                                                        )}
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                {q.correctAnswer && (
                                                                                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                                                                                            Correct
                                                                                            answer
                                                                                        </p>
                                                                                        <p className="font-medium leading-snug">
                                                                                            {
                                                                                                q.correctAnswer
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                )}
                                                                                <p className="text-sm text-muted-foreground italic">
                                                                                    You
                                                                                    didn't
                                                                                    answer
                                                                                    this
                                                                                    question.
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
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

                {/* ── Actions ── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-3"
                >
                    <Button
                        size="lg"
                        className="flex-1 h-12 font-bold"
                        onClick={() => setLocation("/lobby")}
                    >
                        Play Again
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 h-12 font-bold"
                        onClick={handleShare}
                    >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Result
                    </Button>
                </motion.div>
            </div>
            <Footer />
        </div>
    );
}
