
import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
 useGetGame,
 getGetGameQueryKey,
 useListGameQuestions,
 getListGameQuestionsQueryKey,
 useListGameParticipants,
 getListGameParticipantsQueryKey,
 useListUserAnswers,
 getListUserAnswersQueryKey,
 useSubmitAnswer,
} from "@workspace/api-client-react";
import type { Question } from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
import { useGameSocket } from "../hooks/useGameSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
ArrowLeft,
Trophy,
Crown,
CheckCircle2,
XCircle,
Sparkles,
Loader2,
Star,
Clock,
Check,
X,
Minus,
} from "lucide-react";
// ─── Types────────────────────────────────────────────────────────────────────


type Feedback = {
 isCorrect: boolean;
 pointsEarned: number;
 totalScore: number;
 timeTaken: string;
 questionId: number;
 questionType: string;
 factCheckUrl?: string | null;
};


type QuestionStats = {
 totalAnswered: number;
 correctCount: number;
};


const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"];


// ─── Helpers──────────────────────────────────────────────────────────────────


function formatCorrectAnswer(type: string, answer: string): string {
 if (type === "matching") {
     return answer
     .split("|")
     .map((pair) => {
         const idx = pair.indexOf(":");
         return idx === -1 ? pair : `${pair.slice(0, idx)} → ${pair.slice(idx + 1)}`;
        })
        .join(", ");
    }
    if (type === "true_false") {
        return answer.charAt(0).toUpperCase() + answer.slice(1);
    }
    return answer;
}


// ─── Full-screen feedback overlay ────────────────────────────────────────────


function FeedbackOverlay({
    feedback,
    gameId,
    userId,
    isLastQuestion,
    onNext,
    onViewResults,
}: {
    feedback: Feedback;
    gameId: number;
    userId: number;
    isLastQuestion: boolean;
    onNext: () => void;
 onViewResults: () => void;
}) {
 const isPartial = !feedback.isCorrect && feedback.pointsEarned > 0;


 const { data: questionStats } = useQuery<QuestionStats>({
  queryKey: ["question-stats", gameId, feedback.questionId],
  queryFn: () =>
       fetch(`/api/games/${gameId}/questions/${feedback.questionId}/answers`).then(
        (r) => r.json(),
       ),
  refetchInterval: 3000,
 });


 const bgClass = feedback.isCorrect
  ? "from-emerald-950 to-emerald-900"
  : isPartial
       ? "from-amber-950 to-amber-900"
       : "from-red-950 to-red-900";


 const accentClass = feedback.isCorrect
  ? "text-emerald-400"
  : isPartial
       ? "text-amber-400"
       : "text-red-400";


 const borderClass = feedback.isCorrect
 ? "border-emerald-700"
 : isPartial
  ? "border-amber-700"
  : "border-red-700";


return (
 <motion.div
  initial={{ y: "100%" }}
  animate={{ y: 0 }}
  exit={{ y: "100%" }}
  transition={{ type: "spring", stiffness: 280, damping: 30 }}
  className={`fixed inset-0 z-50 bg-gradient-to-b ${bgClass} flex flex-col overflow-y-auto`}
 >
  <div className="flex flex-col min-h-full max-w-lg mx-auto w-full px-5 py-8 gap-6">


     {/* ── Result hero ── */}
     <div className="flex flex-col items-center text-center gap-3 pt-4">
      <motion.div
       initial={{ scale: 0.3, opacity: 0 }}
       animate={{ scale: 1, opacity: 1 }}
       transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
      >
       {feedback.isCorrect ? (
          <CheckCircle2 className="h-24 w-24 text-emerald-400" />
       ) : isPartial ? (
    <Star className="h-24 w-24 text-amber-400" />
):(
    <XCircle className="h-24 w-24 text-red-400" />
)}
</motion.div>


<motion.h2
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.12 }}
className={`text-5xl font-black tracking-tight ${accentClass}`}
>
{feedback.isCorrect
    ? "NAILED IT!"
    : isPartial
     ? "PARTIAL!"
     : "NOT QUITE"}
</motion.h2>


<motion.div
initial={{ opacity: 0, scale: 0.8 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ type: "spring", stiffness: 350, damping: 20, delay: 0.2 }}
className="space-y-1"
>
{feedback.pointsEarned > 0 ? (
  <p className={`text-4xl font-bold ${accentClass}`}>
      +{feedback.pointsEarned} pts
  </p>
 ):(
  <p className="text-3xl font-bold text-white/40">0 pts</p>
 )}
 {isPartial && (
  <p className="text-sm text-amber-300/70">Partial credit earned</p>
 )}
</motion.div>


<div className="flex items-center gap-1.5 text-white/50 text-sm">
 <Clock className="h-4 w-4" />
 <span>Answered in {feedback.timeTaken}s</span>
 <span className="mx-1.5 text-white/20">·</span>
 <span className="text-white/50">Total: {feedback.totalScore} pts</span>
</div>


</div>


{/* ── Per-question aggregate stats ── */}
<div className={`rounded-xl border ${borderClass} bg-white/5 overflow-hidden`}>
<div className="px-4 py-3 border-b border-white/10">
 <p className="text-xs font-bold uppercase tracking-widest text-white/50">
  This question
 </p>
    </div>
    {!questionStats ? (
     <p className="text-white/30 text-sm text-center py-6">
      Waiting for answers…
     </p>
    ):(
     <div className="flex divide-x divide-white/10">
      <div className="flex-1 flex flex-col items-center py-4 gap-1">
       <span className="text-2xl font-black text-white tabular-nums">
          {questionStats.totalAnswered}
       </span>
      <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">
          Answered
       </span>
      </div>
      <div className="flex-1 flex flex-col items-center py-4 gap-1">
       <span className="text-2xl font-black text-emerald-400 tabular-nums">
          {questionStats.correctCount}
       </span>
      <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">
          Correct
       </span>
      </div>
      <div className="flex-1 flex flex-col items-center py-4 gap-1">
       <span className="text-2xl font-black text-red-400 tabular-nums">
                {questionStats.totalAnswered - questionStats.correctCount}
               </span>
      <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">
                Wrong
               </span>
               </div>
           </div>
          )}
         </div>


         {/* ── Source link ── */}
         {feedback.factCheckUrl && (
          <a
           href={feedback.factCheckUrl}
           target="_blank"
           rel="noopener noreferrer"
           className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 text-center transition-colors block"
          >
           Source ↗
          </a>
         )}

         {/* ── Next button ── */}
         <div className="mt-auto pt-2">
          <Button
           onClick={isLastQuestion ? onViewResults : onNext}
           size="lg"
     className="w-full h-14 text-lg font-bold bg-white/15 hover:bg-white/25 text-whiteborder border-white/20"
          >
           {isLastQuestion ? "View Final Results →" : "Next Question →"}
          </Button>
         </div>
         </div>
     </motion.div>
    );
}
// ─── Question sub-components──────────────────────────────────────────────────


function MultipleChoiceQuestion({
 question,
 onSubmit,
 disabled,
}: {
 question: Question;
 onSubmit: (a: string) => void;
 disabled: boolean;
}) {
 const opts = question.options as { choices?: string[] } | null;
 const choices = opts?.choices ?? [];
 const [selected, setSelected] = useState<string | null>(null);
 useEffect(() => { setSelected(null); }, [question.id]);


 return (
   <div className="space-y-3">
       <div className="grid gap-3 sm:grid-cols-2">
       {choices.map((choice, i) => {
        const isSel = selected === choice;
        return (
         <motion.button
          key={choice}
          initial={{ opacity: 0, x: -8 }}
         animate={{ opacity: 1, x: 0 }}
         transition={{ delay: i * 0.06 }}
         disabled={disabled}
         onClick={() => !disabled && setSelected(choice)}
         className={`
          flex items-center gap-3 w-full rounded-xl border-2 px-4 py-4 text-left font-medium
          transition-all duration-150 focus:outline-none
          ${isSel
              ? "border-primary bg-primary/15 shadow-sm shadow-primary/20"
              : "border-card-border bg-card/60 hover:border-primary/40 hover:bg-primary/5"
          }
          ${disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
         `}
     >
         <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full
              text-sm font-bold border-2 transition-colors
        ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"}`}
         >
          {CHOICE_LABELS[i]}
         </span>
         <span className="leading-snug">{choice}</span>
     </motion.button>
    );
   })}
         </div>
         <AnimatePresence>
         {selected && (
          <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
          >
              <Button
               className="w-full h-12 font-bold"
               disabled={disabled}
               onClick={() => onSubmit(selected)}
              >
               {disabled
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                  : <>Confirm: {selected}</>}
              </Button>
          </motion.div>
         )}
         </AnimatePresence>
     </div>
    );
}


function TrueFalseQuestion({
    question,
 onSubmit,
 disabled,
}: {
 question: Question;
 onSubmit: (a: string) => void;
 disabled: boolean;
}) {
 const [selected, setSelected] = useState<"true" | "false" | null>(null);
 useEffect(() => { setSelected(null); }, [question.id]);


 return (
   <div className="space-y-3">
       <div className="grid grid-cols-2 gap-3">
       {(["true", "false"] as const).map((val) => {
        const isSel = selected === val;
        return (
         <motion.button
          key={val}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: val === "true" ? 0 : 0.06 }}
          disabled={disabled}
          onClick={() => !disabled && setSelected(val)}
          className={`
           h-20 rounded-xl border-2 text-xl font-bold transition-all duration-150 focus:outline-none
         ${isSel && val === "true"
       ? "border-secondary bg-secondary/20 text-secondary shadow-sm shadow-secondary/20"
          : isSel && val === "false"
              ? "border-destructive bg-destructive/15 text-destructive"
              : val === "true"
         ? "border-card-border bg-card/60 hover:border-secondary/50 hover:bg-secondary/10"
          : "border-card-border bg-card/60 hover:border-destructive/50 hover:bg-destructive/10"}
         ${disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
         `}
     >
         {val === "true" ? "✓ TRUE" : "✗ FALSE"}
     </motion.button>
    );
   })}
  </div>
  <AnimatePresence>
   {selected && (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
     <Button
         className={`w-full h-12 font-bold ${selected === "true"
         ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
         : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}
         disabled={disabled}
         onClick={() => onSubmit(selected)}
              >
              {disabled
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                  : <>Confirm: {selected === "true" ? "True" : "False"}</>}
              </Button>
          </motion.div>
         )}
         </AnimatePresence>
     </div>
    );
}


function WriteInQuestion({
    question,
    onSubmit,
    disabled,
}: {
    question: Question;
    onSubmit: (a: string) => void;
    disabled: boolean;
}) {
    const [val, setVal] = useState("");
    useEffect(() => { setVal(""); }, [question.id]);
    return (
 <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (val.trim())onSubmit(val.trim()); }}>
  <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Type youranswer…" className="h-14 text-lg" disabled={disabled} autoFocus />
   <Button type="submit" className="w-full h-12 font-bold" disabled={!val.trim() ||disabled}>
   {disabled ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> :"Lock It In"}
         </Button>
     </form>
    );
}


function ImageQuestion({
    question,
    onSubmit,
    disabled,
}: {
    question: Question;
    onSubmit: (a: string) => void;
    disabled: boolean;
}) {
    const [val, setVal] = useState("");
    useEffect(() => { setVal(""); }, [question.id]);
    return (
     <div className="space-y-4">
         {question.imageUrl && (
         <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
    className="overflow-hidden rounded-xl border border-card-border bg-background/60">
    <img src={question.imageUrl} alt="Identify this" className="w-full max-h-80 object-contain" />
          </motion.div>
         )}
  <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (val.trim())onSubmit(val.trim()); }}>
   <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Youranswer…" className="h-14 text-lg" disabled={disabled} autoFocus />
    <Button type="submit" className="w-full h-12 font-bold" disabled={!val.trim() ||disabled}>
    {disabled ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> :"Lock It In"}
          </Button>
         </form>
     </div>
    );
}


function MatchingBoard({
    question,
    onSubmit,
    disabled,
}: {
    question: Question;
    onSubmit: (a: string) => void;
    disabled: boolean;
}) {
 const pairs = useMemo(() => {
  const opts = question.options as { pairs?: { left: string; right: string }[] } | null;
  return opts?.pairs ?? [];
 }, [question.options]);


 const shuffledRights = useMemo(() => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5), [pairs]);
 const [choices, setChoices] = useState<Record<string, string>>({});
 const allChosen = pairs.length > 0 && pairs.every((p) => choices[p.left]);


 const submit = () => {
  const answer = pairs
       .map((p) => `${p.left}:${choices[p.left]}`)
       .sort((a, b) => a.localeCompare(b))
       .join("|");
  onSubmit(answer);
 };


 return (
  <div className="space-y-3">
  <p className="text-xs text-muted-foreground">Match each item on the left with itsanswer on the right.</p>
       {pairs.map((p) => (
        <div key={p.left} className="flex items-center gap-3">
     <div className="flex-1 rounded-md border border-card-border bg-background/60 px-4 py-3 font-medium text-sm">{p.left}</div>
           <span className="text-muted-foreground shrink-0">→</span>
     <Select value={choices[p.left] ?? ""} onValueChange={(v) => setChoices((c) => ({ ...c,[p.left]: v }))} disabled={disabled}>
     <SelectTrigger className={`flex-1 ${choices[p.left] ? "border-secondary/50 bg-secondary/5" : ""}`}>
               <SelectValue placeholder="Match with…" />
               </SelectTrigger>
               <SelectContent>
               {shuffledRights.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
               </SelectContent>
           </Select>
          </div>
         ))}
  <Button className="w-full h-12 font-bold mt-2" disabled={!allChosen || disabled}onClick={submit}>
   {disabled ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> :"Lock In Matches"}
         </Button>
     </div>
    );
}


// ─── Main GamePlay page───────────────────────────────────────────────────────


export default function GamePlay() {
    const params = useParams<{ id: string }>();
 const gameId = Number(params.id);
 const { user } = useAuth();
 const userId = user?.id ?? 0;
 const [, setLocation] = useLocation();
 const { toast } = useToast();
 const queryClient = useQueryClient();


 const [feedback, setFeedback] = useState<Feedback | null>(null);
 const questionStartRef = useRef<number>(Date.now());


 useGameSocket(gameId || null, {
  onAnswerSubmitted: ({ playerName, isCorrect }) => {
      queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId)});
      toast({
       title: isCorrect ? `� ${playerName} got it right!` : `� ${playerName} just answered`,
       duration: 2500,
      });
  },
  onGameEnded: () => {
      toast({ title: "� Game over! Redirecting to results…" });
      setTimeout(() => setLocation(`/results/${gameId}`), 1500);
  },
 });


 const { data: game } = useGetGame(gameId, {
 query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
});
const { data: questions } = useListGameQuestions(gameId, {
  query: { enabled: !!gameId, queryKey: getListGameQuestionsQueryKey(gameId),refetchInterval: 10000 },
});
const { data: myAnswers } = useListUserAnswers(gameId, userId, {
  query: { enabled: !!gameId && !!userId, queryKey: getListUserAnswersQueryKey(gameId,userId) },
});
const { data: participants } = useListGameParticipants(gameId, {
  query: { enabled: !!gameId, queryKey: getListGameParticipantsQueryKey(gameId),refetchInterval: 5000 },
});


const submitAnswer = useSubmitAnswer();


const sorted = useMemo(
 () => [...(questions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
 [questions],
);
const answeredIds = useMemo(
 () => new Set((myAnswers ?? []).map((a) => a.questionId)),
 [myAnswers],
);


const current = sorted.find((q) => !answeredIds.has(q.id));
const answeredCount = sorted.filter((q) => answeredIds.has(q.id)).length;
const total = sorted.length;
const isLastQuestion = !!current && sorted.indexOf(current) === total - 1;


const sortedParticipants = useMemo(
 () => [...(participants ?? [])].sort((a, b) => b.totalScore - a.totalScore),
 [participants],
);
const myScore = participants?.find((p) => p.userId === userId)?.totalScore ?? 0;
const myRank = sortedParticipants.findIndex((p) => p.userId === userId) + 1;


// Reset timer when question changes
useEffect(() => {
 if (current?.id) {
     questionStartRef.current = Date.now();
 }
}, [current?.id]);


const handleSubmit = (question: Question, userAnswer: string) => {
 if (!userAnswer.trim() || submitAnswer.isPending) return;
 const timeTaken = ((Date.now() - questionStartRef.current) / 1000).toFixed(1);


 submitAnswer.mutate(
     { gameId, data: { questionId: question.id, userAnswer } },
     {
         onSuccess: (res) => {
           setFeedback({
               isCorrect: res.isCorrect,
               pointsEarned: res.pointsEarned,
               totalScore: res.totalScore,
               timeTaken,
               questionId: question.id,
               questionType: question.questionType,
               factCheckUrl: question.factCheckUrl ?? null,
           });
           queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId)});
       },
       onError: (err: unknown) => {
           const msg = err instanceof Error ? err.message : String(err);
           if (msg.includes("409") || msg.toLowerCase().includes("already answered")) {
               nextQuestion();
               return;
           }
    toast({ variant: "destructive", title: "Could not submit answer", description: "Please tryagain." });
       },
      },
  );
 };


 const nextQuestion = () => {
  setFeedback(null);
   queryClient.invalidateQueries({ queryKey: getListUserAnswersQueryKey(gameId, userId)});
};


const renderQuestion = (q: Question) => {
 const sub = { question: q, disabled: submitAnswer.isPending };
 switch (q.questionType) {
     case "multiple_choice":
     return <MultipleChoiceQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
     case "true_false":
     return <TrueFalseQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
     case "matching":
     return <MatchingBoard key={q.id} {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
     case "image_recognition":
     return <ImageQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
     case "write_in":
     return <WriteInQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
     default:
     return null;
 }
};


if (!user) return null;


return (
 <div className="min-h-[100dvh] p-4 md:p-6 relative">
{/* ── Feedback overlay ── */}
<AnimatePresence>
{feedback && (
 <FeedbackOverlay
     feedback={feedback}
     gameId={gameId}
     userId={userId}
     isLastQuestion={isLastQuestion}
     onNext={nextQuestion}
     onViewResults={() => setLocation(`/results/${gameId}`)}
 />
)}
</AnimatePresence>


<div className="mx-auto max-w-6xl space-y-5">


{/* Header */}
<header className="flex items-center gap-3">
 <Button variant="ghost" size="sm" onClick={() => setLocation("/lobby")}
     className="text-muted-foreground hover:text-foreground shrink-0">
     <ArrowLeft className="mr-1 h-4 w-4" /> Lobby
 </Button>


 <div className="flex-1 min-w-0 text-center">
     <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">
     {game?.topic ?? "Loading…"}
     </h1>
     {game && (
      <div className="flex items-center justify-center gap-2 mt-0.5">
       <Badge variant="outline" className="uppercase text-[10px]">{game.difficulty}</Badge>
          {total > 0 && (
           <span className="text-xs text-muted-foreground">
               Q{Math.min(answeredCount + 1, total)} of {total}
           </span>
          )}
      </div>
     )}
    </div>


    <div className="text-right shrink-0">
       <div className="text-2xl font-bold tabular-nums text-accent flex items-center gap-1justify-end">
      <Star className="h-4 w-4" />{myScore}
     </div>
     <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
      {myRank > 0 ? `Rank #${myRank}` : "Points"}
     </div>
    </div>
   </header>


   {/* Progress bar */}
   {total > 0 && (
 <div className="space-y-1">
     <Progress value={(answeredCount / total) * 100} className="h-2.5 rounded-full" />
     <div className="flex justify-between text-[11px] text-muted-foreground">
     <span>{answeredCount} answered</span>
     <span>{total - answeredCount} remaining</span>
     </div>
 </div>
)}


{/* Question + Leaderboard */}
<div className="grid gap-5 lg:grid-cols-[1fr_300px]">
 <div>
     <AnimatePresence mode="wait">
     {total === 0 ? (
      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
       <Card className="border-dashed border-primary/30 bg-card/40">
        <CardContent className="py-16 text-center space-y-3">
         <Sparkles className="mx-auto h-12 w-12 text-primary/50" />
         <h3 className="text-2xl font-bold">Questions loading soon</h3>
         <p className="text-muted-foreground max-w-md mx-auto">
          The host hasn't added questions yet — this page checks automatically.
         </p>
        </CardContent>
       </Card>
      </motion.div>
     ) : current ? (
<motion.div
 key={current.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 transition={{ type: "spring", stiffness: 280, damping: 26 }}
>
 <Card className="border-card-border bg-card/60 backdrop-blur">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-2">
      <Badge variant="outline" className="uppercase tracking-widest text-[10px]">
       {current.questionType.replace(/_/g, " ")}
      </Badge>
      <span className="text-sm font-bold text-accent flex items-center gap-1">
       <Star className="h-3.5 w-3.5" /> {current.points} pts
      </span>
      </div>
      <CardTitle className="text-xl md:text-2xl leading-snug pt-2">
      {current.questionText}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-2">{renderQuestion(current)}</CardContent>
 </Card>
</motion.div>
):(
/* All done */
<motion.div
key="done"
initial={{ opacity: 0, scale: 0.92 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ type: "spring", stiffness: 280, damping: 24 }}
>
<Card className="border-2 border-accent/50 bg-accent/5">
    <CardContent className="py-16 text-center space-y-4">
    <motion.div
     initial={{ scale: 0.5, rotate: -10 }}
     animate={{ scale: 1, rotate: 0 }}
     transition={{ type: "spring", stiffness: 350, damping: 18 }}
    >
     <Trophy className="mx-auto h-20 w-20 text-accent" />
    </motion.div>
    <h2 className="text-4xl font-bold tracking-tight">THAT'S A WRAP!</h2>
    <p className="text-xl">
     You finished with{" "}
     <span className="font-bold text-accent">{myScore} points</span>
     {myRank > 0 && (
        <span className="text-muted-foreground"> · Rank #{myRank}</span>
     )}
    </p>
    <p className="text-muted-foreground max-w-sm mx-auto">
     Watch the leaderboard — other players are still answering.
    </p>
            <div className="flex gap-3 justify-center flex-wrap">
           <Button className="font-bold h-12 px-8" onClick={() => setLocation(`/results/${gameId}`)}>
              View Results
             </Button>
         <Button variant="outline" onClick={() => setLocation("/lobby")}className="font-bold h-12 px-8">
              Back to Lobby
             </Button>
            </div>
           </CardContent>
           </Card>
       </motion.div>
      )}
     </AnimatePresence>
    </div>


    {/* Live leaderboard sidebar */}
    <aside>
     <Card className="border-card-border bg-card/60 backdrop-blur lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest text-muted-foregroundflex items-center gap-2">
           <Trophy className="h-4 w-4 text-accent" /> Live Leaderboard
       </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
       {sortedParticipants.length === 0 ? (
           <p className="text-sm text-muted-foreground py-4 text-center">No players yet.</p>
       ):(
           sortedParticipants.map((p, i) => {
           const isMe = p.userId === userId;
           return (
            <motion.div
             key={p.id}
             layout
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
           className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${isMe ? "bg-primary/10 border border-primary/30" : "bg-background/40"}`}
            >
           <span className="w-6 text-center font-bold tabular-nums text-muted-foreground shrink-0">
          {i === 0 ? <Crown className="h-4 w-4 text-accent mx-auto" /> : <span className="text-xs">{i + 1}</span>}
             </span>
             <span className="flex-1 truncate text-sm font-medium">
                {p.userName}
                {isMe && <span className="text-primary text-[10px] ml-1">(you)</span>}
             </span>
            <span className="font-bold tabular-nums text-accent text-sm shrink-0">{p.totalScore}</span>
            </motion.div>
                  );
              })
             )}
            </CardContent>
           </Card>
          </aside>
         </div>
         </div>
         <Footer />
     </div>
    );
}


