
import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import AdminSettings from "./AdminSettings";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTallyStore,
  recordAnswerEvent,
  applySeed,
  resetTallyStore,
  type TallyStore,
} from "@workspace/live-tally";
import { COPY } from "@workspace/copy";
import { RunModeScreen, type RunMode } from "@/components/RunModeScreen";
import { JoinCodeScreen } from "@/components/JoinCodeScreen";

/**
 * Maps a PATCH /games/:id join-code failure to the shared field-level message,
 * chosen by the server's machine-readable error code / status (never raw text).
 * Must stay identical to the mobile mapping in BuildTab.tsx.
 */
function mapJoinCodeError(err: unknown): string {
  const data = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
  const code = data && typeof data === "object" && "code" in data ? String((data as { code: unknown }).code) : null;
  const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
  if (code === "content_filtered") return COPY.contentFilter.accessCode;
  if (code === "code_taken" || status === 409) return COPY.joinCode.takenError;
  return COPY.joinCode.invalidError;
}
import { cn } from "@/lib/utils";
import {
 DndContext,
 closestCenter,
 PointerSensor,
 KeyboardSensor,
 useSensor,
 useSensors,
 type DragEndEvent,
} from "@dnd-kit/core";
import {
 SortableContext,
 sortableKeyboardCoordinates,
 verticalListSortingStrategy,
 useSortable,
 arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
 useListGames,
 getListGamesQueryKey,
 useCreateGame,
 useUpdateGame,
 useDeleteGame,
 useListGameQuestions,
 getListGameQuestionsQueryKey,
 useCreateQuestion,
 useUpdateQuestion,
 useDeleteQuestion,
 getGetStatsSummaryQueryKey,
 useListGameParticipants,
 getListGameParticipantsQueryKey,
 useImportOpenTdbQuestions,
 useGenerateGeminiQuestions,
 useRegenerateQuestion,
 useEnhanceQuestion,
} from "@workspace/api-client-react";
import type {
 Game,
 Question,
 RegenerateQuestionPreview,
 EnhanceQuestionResult,
} from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
import { CrownMark } from "@/components/Brand";
import { useGameSocket } from "../hooks/useGameSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
Shield,
Plus,
Trash2,
Pencil,
Play,
Info,
Flag,
ListChecks,
X,
Gamepad2,
Radio,
Users,
Zap,
LayoutDashboard,
PlusCircle,
Settings,
HelpCircle,
LogOut,
Crown,
AlertTriangle,
ChevronRight,
Trophy,
CheckCircle2,
GripVertical,
CheckSquare,
ToggleLeft,
PenLine,
ImageIcon,
ArrowLeftRight,
ShieldAlert,
Star,
BarChart3,
Download,
ChevronDown,
ChevronUp,
BookOpen,
Lightbulb,
ExternalLink,
Loader2,
Database,
RefreshCw,
Copy,
Check,
ShieldCheck,
Square,
SlidersHorizontal,
Wand2,
Sparkles,
ArrowLeft,
Calendar,
} from "lucide-react";


// ─── Types ───────────────────────────────────────────────────────────────────
type Section = "games" | "live" | "build" | "results" | "rooms";
type QuestionType = Question["questionType"];


type QuestionFormState = {
 questionText: string;
 questionType: QuestionType;
 correctAnswer: string;
 choices: string[];
 pairs: { left: string; right: string }[];
 imageUrl: string;
 points: string;
 alternateAnswers: string;
 source: string;
 factCheckUrl: string;
};


// ─── Question form helpers ────────────────────────────────────────────────────


const DEFAULT_POINTS: Record<QuestionType, number> = {
 multiple_choice: 10,
 true_false: 5,
 write_in: 15,
 matching: 20,
 image_recognition: 15,
 multi_select: 10,
 ordering: 15,
 slider: 10,
 image_hotspot: 15,
 short_response: 10,
};
const emptyForm: QuestionFormState = {
    questionText: "",
    questionType: "multiple_choice",
    correctAnswer: "",
    choices: ["", "", "", ""],
    pairs: [
     { left: "", right: "" },
     { left: "", right: "" },
     { left: "", right: "" },
     { left: "", right: "" },
    ],
    imageUrl: "",
    points: "10",
    alternateAnswers: "",
    source: "",
    factCheckUrl: "",
};


function emptyFormForType(type: QuestionType): QuestionFormState {
    return { ...emptyForm, questionType: type, points: String(DEFAULT_POINTS[type]) };
}


// ─── Free-tier upgrade helpers ────────────────────────────────────────────────

/** Returns the "Monthly limit reached: …" message from a 429 ApiError, or null. */
function extractFreeTierLimitMsg(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const status = "status" in err ? (err as { status: number }).status : 0;
  if (status !== 429) return null;
  const data = "data" in err ? (err as { data: unknown }).data : null;
  if (data && typeof data === "object" && "error" in data) {
    const msg = String((data as { error: unknown }).error);
    if (msg.includes("Monthly limit reached")) return msg;
  }
  return null;
}

function FreeTierLimitModal({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!msg} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" /> Monthly limit reached
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{msg}</p>
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-4 py-3 text-sm text-yellow-300 leading-relaxed">
            This resets at the start of next month. You can still add questions manually in the meantime.
          </div>
          <Button className="w-full" onClick={onClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function formFromQuestion(q: Question): QuestionFormState {
    const opts = q.options as
     |{
         choices?: string[];
         pairs?: { left: string; right: string }[];
         alternateAnswers?: string[];
     }
 | null;
return {
 questionText: q.questionText,
 questionType: q.questionType,
 correctAnswer: q.questionType === "matching" ? "" : (q.correctAnswer ?? ""),
 choices: opts?.choices?.length
     ? [...opts.choices]
     : ["", "", "", ""],
 pairs: opts?.pairs?.length
     ? opts.pairs.map((p) => ({ ...p }))
     :[
          { left: "", right: "" },
          { left: "", right: "" },
          { left: "", right: "" },
          { left: "", right: "" },
         ],
 imageUrl: q.imageUrl ?? "",
 points: String(q.points),
 alternateAnswers: opts?.alternateAnswers?.join(", ") ?? "",
 source: q.source ?? "",
 factCheckUrl: q.factCheckUrl ?? "",
};
}


function buildPayload(form: QuestionFormState, orderIndex: number) {
 const points = Math.max(1, Number(form.points) ||DEFAULT_POINTS[form.questionType]);
    const base = {
        questionText: form.questionText.trim(),
        questionType: form.questionType,
        points,
        orderIndex,
        imageUrl:
         form.questionType === "image_recognition" && form.imageUrl.trim()
             ? form.imageUrl.trim()
             : null,
        source: form.source.trim() || null,
        factCheckUrl: form.factCheckUrl.trim() || null,
    };


    if (form.questionType === "multiple_choice") {
        const choices = form.choices.map((c) => c.trim()).filter(Boolean);
        return {
         ...base,
         options: { choices },
         correctAnswer: form.correctAnswer.trim(),
        };
    }
if (form.questionType === "matching") {
    const pairs = form.pairs
     .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
     .filter((p) => p.left && p.right);
    const correctAnswer = pairs
     .map((p) => `${p.left}:${p.right}`)
     .sort((a, b) => a.localeCompare(b))
     .join("|");
    return { ...base, options: { pairs }, correctAnswer };
}
if (form.questionType === "true_false") {
    return {
     ...base,
     options: null,
     correctAnswer: form.correctAnswer === "false" ? "false" : "true",
    };
}
// write_in / image_recognition
const alternates = form.alternateAnswers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
return {
    ...base,
    options: alternates.length ? { alternateAnswers: alternates } : null,
    correctAnswer: form.correctAnswer.trim(),
    };
}


function payloadFromExisting(q: Question, orderIndex: number) {
    const opts = q.options as {
     choices?: string[];
     pairs?: { left: string; right: string }[];
     alternateAnswers?: string[];
    } | null;
    return {
     questionText: q.questionText,
     questionType: q.questionType,
     points: q.points,
     orderIndex,
     imageUrl: q.imageUrl ?? null,
     options: opts ?? null,
     correctAnswer: q.correctAnswer,
    };
}


function validateForm(form: QuestionFormState): string | null {
    if (!form.questionText.trim()) return "Question text is required";
    if (form.questionType === "multiple_choice") {
     const choices = form.choices.map((c) => c.trim()).filter(Boolean);
     if (choices.length < 2) return "Add at least two choices";
     if (!form.correctAnswer.trim()) return "Pick the correct choice";
        if (!choices.includes(form.correctAnswer.trim()))
         return "Correct answer must be one of the choices";
    } else if (form.questionType === "matching") {
        const pairs = form.pairs.filter((p) => p.left.trim() && p.right.trim());
        if (pairs.length < 2) return "Add at least two complete pairs";
    } else if (form.questionType === "true_false") {
        if (form.correctAnswer !== "true" && form.correctAnswer !== "false")
         return "Pick true or false";
    } else {
        if (!form.correctAnswer.trim()) return "Correct answer is required";
        if (form.questionType === "image_recognition" && !form.imageUrl.trim())
         return "Image URL is required";
    }
    return null;
}


// ─── Question type meta ───────────────────────────────────────────────────────


const TYPE_META: Record<
    QuestionType,
    { label: string; Icon: typeof CheckSquare; color: string }
>={
    multiple_choice: { label: "Multiple Choice", Icon: CheckSquare, color: "text-primary" },
    true_false: { label: "True / False", Icon: ToggleLeft, color: "text-secondary" },
    write_in: { label: "Write-In", Icon: PenLine, color: "text-accent" },
    image_recognition: { label: "Image", Icon: ImageIcon, color: "text-orange-400" },
 matching: { label: "Matching", Icon: ArrowLeftRight, color: "text-purple-400" },
 multi_select: { label: "Multi-Select", Icon: CheckSquare, color: "text-cyan-400" },
 ordering: { label: "Ordering", Icon: ArrowLeftRight, color: "text-emerald-400" },
 slider: { label: "Slider", Icon: SlidersHorizontal, color: "text-yellow-400" },
 image_hotspot: { label: "Image Hotspot", Icon: ImageIcon, color: "text-rose-400" },
 short_response: { label: "Short Response", Icon: PenLine, color: "text-violet-400" },
};


const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"];


// ─── OpenTDB categories───────────────────────────────────────────────────────


const OPENTDB_CATEGORIES = [
 { id: 9, name: "General Knowledge" },
 { id: 10, name: "Books" },
 { id: 11, name: "Film" },
 { id: 12, name: "Music" },
 { id: 14, name: "Television" },
 { id: 15, name: "Video Games" },
 { id: 17, name: "Science & Nature" },
 { id: 21, name: "Sports" },
 { id: 22, name: "Geography" },
 { id: 23, name: "History" },
 { id: 25, name: "Art" },
 { id: 26, name: "Celebrities" },
 { id: 27, name: "Animals" },
 { id: 28, name: "Vehicles" },
] as const;


// ─── QuestionForm─────────────────────────────────────────────────────────────
function QuestionForm({
 initial,
 onSubmit,
 pending,
 submitLabel,
 onFillWithAi,
}: {
 initial: QuestionFormState;
 onSubmit: (form: QuestionFormState) => void;
 pending: boolean;
 submitLabel: string;
 onFillWithAi?: (type: QuestionType) => Promise<QuestionFormState | null>;
}) {
 const [form, setForm] = useState<QuestionFormState>(initial);
 const [aiLoading, setAiLoading] = useState(false);
 const [upgradeLimitMsg, setUpgradeLimitMsg] = useState<string | null>(null);
 const { toast } = useToast();
 const set = <K extends keyof QuestionFormState>(k: K, v: QuestionFormState[K]) =>
  setForm((f) => ({ ...f, [k]: v }));

 const handleFillWithAi = async () => {
  if (!onFillWithAi) return;
  setAiLoading(true);
  try {
   const filled = await onFillWithAi(form.questionType);
   if (filled) setForm(filled);
  } catch (err) {
   const msg = err instanceof Error ? err.message : "";
   if (msg.includes("Monthly limit reached")) {
    setUpgradeLimitMsg(msg);
   } else {
    toast({ variant: "destructive", title: "AI generation failed. Please try again." });
   }
  } finally {
   setAiLoading(false);
  }
 };


 const handleTypeChange = (v: QuestionType) => {
  setForm((f) => ({
       ...f,
       questionType: v,
       correctAnswer: "",
       points: String(DEFAULT_POINTS[v]),
   }));
 };
const validChoices = form.choices.map((c) => c.trim()).filter(Boolean);


return (
 <div className="space-y-5">
  <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
  {/* Type selector */}
  <div className="space-y-2">
   <Label>Question Type</Label>
   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {(Object.keys(TYPE_META) as QuestionType[]).map((t) => {
     const { label, Icon, color } = TYPE_META[t];
     const active = form.questionType === t;
     return (
      <button
       key={t}
       type="button"
       onClick={() => handleTypeChange(t)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
           active
           ? "border-primary bg-primary/10 text-foreground"
         : "border-border bg-background/40 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
       }`}
      >
       <Icon className={`h-4 w-4 shrink-0 ${active ? color : ""}`} />
       {label}
      </button>
      );
  })}
    </div>
    {onFillWithAi && (
     <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300"
      onClick={handleFillWithAi}
      disabled={aiLoading || pending}
     >
      {aiLoading ? (
       <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
      ) : (
       <><Sparkles className="h-3.5 w-3.5" />Fill with AI</>
      )}
     </Button>
    )}
   </div>


{/* Question text */}
<div className="space-y-2">
 <Label>
  {form.questionType === "image_recognition" ? "Caption / Prompt" : "Question"}
 </Label>
 <Textarea
  value={form.questionText}
  onChange={(e) => set("questionText", e.target.value)}
  placeholder={
      form.questionType === "image_recognition"
       ? 'e.g. "Name this landmark" or "Which country is this flag from?"'
       : "Type the question players will see..."
  }
  rows={3}
 />
</div>


{/* ── Multiple Choice ── */}
{form.questionType === "multiple_choice" && (
 <div className="space-y-3">
  <Label>Answer Choices</Label>
    <div className="space-y-2">
     {form.choices.map((choice, i) => {
      const isCorrect = form.correctAnswer === choice.trim() && choice.trim();
      return (
       <div key={i} className="flex items-center gap-2">
        <button
         type="button"
         onClick={() => choice.trim() && set("correctAnswer", choice.trim())}
          className={`h-8 w-8 shrink-0 rounded-full border-2 text-sm font-boldtransition-colors ${
            isCorrect
             ? "border-secondary bg-secondary text-secondary-foreground"
             : "border-border text-muted-foreground hover:border-muted-foreground/60"
         }`}
         title="Click to mark as correct"
        >
         {CHOICE_LABELS[i]}
        </button>
        <Input
         value={choice}
         onChange={(e) => {
            const next = [...form.choices];
            next[i] = e.target.value;
            // if this was the correct answer, keep it synced
            const updated = { ...form, choices: next };
            if (form.correctAnswer === form.choices[i]?.trim()) {
         updated.correctAnswer = e.target.value.trim();
     }
     setForm(updated);
 }}
 placeholder={`Choice ${CHOICE_LABELS[i]}`}
 className={isCorrect ? "border-secondary/60 bg-secondary/5" : ""}
/>
{form.choices.length > 2 && (
 <Button
     type="button"
     variant="ghost"
     size="icon"
     className="shrink-0"
     onClick={() => {
         const next = form.choices.filter((_, j) => j !== i);
         setForm((f) => ({
          ...f,
          choices: next,
          correctAnswer:
           f.correctAnswer === choice.trim() ? "" : f.correctAnswer,
         }));
     }}
 >
     <X className="h-4 w-4" />
 </Button>
)}
      </div>
     );
 })}
</div>


{form.choices.length < 6 && (
 <Button
     type="button"
     variant="outline"
     size="sm"
     onClick={() => set("choices", [...form.choices, ""])}
 >
     <Plus className="mr-1 h-3.5 w-3.5" /> Add choice
 </Button>
)}


{form.correctAnswer ? (
 <p className="text-sm text-secondary font-medium flex items-center gap-1.5">
     <CheckCircle2 className="h-4 w-4" />
     Correct: "{form.correctAnswer}"
 </p>
):(
 <p className="text-xs text-muted-foreground">
     Click a letter button to mark the correct answer.
 </p>
)}
   </div>
  )}


  {/* ── True / False ── */}
  {form.questionType === "true_false" && (
   <div className="space-y-2">
       <Label>Correct Answer</Label>
       <div className="grid grid-cols-2 gap-3">
       {(["true", "false"] as const).map((val) => (
        <button
         key={val}
         type="button"
         onClick={() => set("correctAnswer", val)}
        className={`rounded-xl border-2 py-4 text-center font-bold text-lg transition-colors ${
             form.correctAnswer === val
             ? val === "true"
               ? "border-secondary bg-secondary/15 text-secondary"
               : "border-destructive bg-destructive/10 text-destructive"
             : "border-border text-muted-foreground hover:border-muted-foreground/50"
         }`}
        >
         {val === "true" ? "✓ TRUE" : "✗ FALSE"}
        </button>
       ))}
       </div>
 </div>
)}


{/* ── Write-In ── */}
{form.questionType === "write_in" && (
 <div className="space-y-4">
     <div className="space-y-2">
     <Label>Correct Answer</Label>
     <Input
      value={form.correctAnswer}
      onChange={(e) => set("correctAnswer", e.target.value)}
      placeholder="Primary correct answer (case-insensitive)"
     />
     </div>
     <div className="space-y-2">
     <Label>
      Alternate Acceptable Answers
      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
       (optional, comma-separated)
      </span>
     </Label>
     <Input
      value={form.alternateAnswers}
      onChange={(e) => set("alternateAnswers", e.target.value)}
      placeholder='e.g. "New York, NYC, The Big Apple"'
     />
       <p className="text-xs text-muted-foreground">
        Any of these will be accepted as correct.
       </p>
       </div>
   </div>
  )}


  {/* ── Image Recognition ── */}
  {form.questionType === "image_recognition" && (
   <div className="space-y-4">
       <div className="space-y-2">
       <Label>Image URL</Label>
       <Input
        value={form.imageUrl}
        onChange={(e) => set("imageUrl", e.target.value)}
        placeholder="https://upload.wikimedia.org/..."
       />
       {form.imageUrl.trim() && (
      <div className="rounded-lg overflow-hidden border border-border max-h-48 flexitems-center justify-center bg-muted/30">
         <img
            src={form.imageUrl.trim()}
            alt="Preview"
            className="max-h-48 object-contain"
            onError={(e) => {
             (e.target as HTMLImageElement).style.display = "none";
     }}
     />
 </div>
)}
</div>
<div className="space-y-2">
<Label>Correct Answer</Label>
<Input
 value={form.correctAnswer}
 onChange={(e) => set("correctAnswer", e.target.value)}
 placeholder="What the image shows (case-insensitive)"
/>
</div>
<div className="space-y-2">
<Label>
 Alternate Answers
 <span className="ml-1.5 text-xs text-muted-foreground font-normal">
     (optional, comma-separated)
 </span>
</Label>
<Input
 value={form.alternateAnswers}
 onChange={(e) => set("alternateAnswers", e.target.value)}
 placeholder='e.g. "Eiffel Tower, La Tour Eiffel"'
/>
</div>
      </div>
  )}


  {/* ── Matching ── */}
  {form.questionType === "matching" && (
      <div className="space-y-3">
     <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold uppercasetracking-widest text-muted-foreground px-9">
        <span>Left</span>
        <span>Matches with</span>
       </div>
       {form.pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
         <span className="w-7 text-center text-sm font-bold text-muted-foreground shrink-0">
          {i + 1}
         </span>
         <Input
          value={pair.left}
          onChange={(e) => {
           const next = form.pairs.map((p, j) =>
               j === i ? { ...p, left: e.target.value } : p,
           );
           set("pairs", next);
          }}
          placeholder="Left item"
         />
  <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
  <Input
      value={pair.right}
      onChange={(e) => {
       const next = form.pairs.map((p, j) =>
           j === i ? { ...p, right: e.target.value } : p,
       );
       set("pairs", next);
      }}
      placeholder="Right item"
  />
  {form.pairs.length > 2 && (
      <Button
       type="button"
       variant="ghost"
       size="icon"
       className="shrink-0"
       onClick={() => set("pairs", form.pairs.filter((_, j) => j !== i))}
      >
       <X className="h-4 w-4" />
      </Button>
  )}
 </div>
))}
{form.pairs.length < 6 && (
 <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-9"
            onClick={() => set("pairs", [...form.pairs, { left: "", right: "" }])}
        >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add pair
        </Button>
       )}
   </div>
  )}


  {/* Source / Citation */}
  <div className="space-y-1.5 pt-1">
   <Label>
       Source / Citation
    <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
   </Label>
   <Input
       value={form.source}
       onChange={(e) => set("source", e.target.value)}
       placeholder='e.g. "Wikipedia: Eiffel Tower" or "Britannica"'
   />
  </div>
  {/* Fact-check URL */}
  <div className="space-y-1.5">
   <Label>
    Fact-check URL
    <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
   </Label>
   <Input
    type="url"
    value={form.factCheckUrl}
    onChange={(e) => set("factCheckUrl", e.target.value)}
    placeholder="https://en.wikipedia.org/wiki/..."
   />
  </div>


  {/* Points */}
  <div className="flex items-center gap-3 pt-1">
   <div className="space-y-1">
    <Label>Points</Label>
    <Input
     type="number"
     min={1}
     max={100}
     value={form.points}
     onChange={(e) => set("points", e.target.value)}
     className="w-28"
             />
         </div>
         <p className="text-xs text-muted-foreground mt-5 max-w-[200px]">
    Default for {TYPE_META[form.questionType].label}:{DEFAULT_POINTS[form.questionType]} pts
         </p>
         </div>


         <Button
         className="w-full font-bold"
         disabled={pending}
         onClick={() => {
             const err = validateForm(form);
             if (err) {
                 toast({ variant: "destructive", title: err });
                 return;
             }
             onSubmit(form);
         }}
         >
         {pending ? "Saving..." : submitLabel}
         </Button>
     </div>
    );
}
// ─── SortableQuestionItem ─────────────────────────────────────────────────────


function SortableQuestionItem({
 q,
 index,
 onEdit,
 onDelete,
 deleteDisabled,
}: {
 q: Question;
 index: number;
 onEdit: (q: Question) => void;
 onDelete: (id: number) => void;
 deleteDisabled: boolean;
}) {
 const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: q.id });


 const style: React.CSSProperties = {
   transform: CSS.Transform.toString(transform),
   transition,
  opacity: isDragging ? 0.4 : 1,
  zIndex: isDragging ? 10 : undefined,
 };
 const { Icon, label, color } = TYPE_META[q.questionType as QuestionType] ??TYPE_META.write_in;


return (
 <div
  ref={setNodeRef}
  style={style}
  className={`flex items-start gap-3 rounded-lg border bg-card/60 p-3 transition-shadow ${
     isDragging ? "shadow-xl border-primary/40" : "border-card-border"
  }`}
 >
  {/* Drag handle */}
  <button
     {...attributes}
     {...listeners}
   className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40hover:text-muted-foreground transition-colors touch-none"
     aria-label="Drag to reorder"
  >
     <GripVertical className="h-5 w-5" />
  </button>


  {/* Number */}
  <span className="mt-0.5 w-5 text-center font-bold text-muted-foreground tabular-nums text-sm shrink-0">
     {index + 1}
  </span>


  {/* Type icon */}
  <div className={`mt-0.5 shrink-0 ${color}`}>
   <Icon className="h-4 w-4" />
  </div>


  {/* Content */}
  <div className="flex-1 min-w-0 space-y-1">
   <p className="font-medium leading-snug text-sm break-words">{q.questionText}</p>
   <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline" className="uppercase text-[10px]">
     {label}
    </Badge>
    {q.source === "opentdb" && (
     <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400border-blue-500/30">Open Trivia Database</Badge>
    )}
    {q.aiGenerated && (
     <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400border-purple-500/30">AI Generated</Badge>
    )}
    <span className="text-xs text-accent font-semibold flex items-center gap-0.5">
     <Star className="h-3 w-3" /> {q.points} pts
    </span>
    {q.questionType !== "matching" && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
         ans: <span className="text-secondary">{q.correctAnswer}</span>
        </span>
    )}
   </div>
   {/* Source citation — shown for AI-generated questions */}
    {q.aiGenerated && q.source && q.source !== "opentdb" &&!q.source.startsWith("manual") && (
    <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
        <BookOpen className="h-3 w-3 shrink-0" />
        <span className="truncate">{q.source}</span>
    </p>
   )}
  </div>


  {/* Actions */}
  <div className="flex gap-1 shrink-0">
   <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(q)}
          className="h-8 w-8"
         >
          <Pencil className="h-3.5 w-3.5" />
         </Button>
         <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          disabled={deleteDisabled}
          onClick={() => onDelete(q.id)}
         >
          <Trash2 className="h-3.5 w-3.5" />
         </Button>
         </div>
     </div>
    );
}


// ─── QuestionManager──────────────────────────────────────────────────────────


function QuestionManager({ game }: { game: Game }) {
    const { toast } = useToast();
const queryClient = useQueryClient();
const [dialogOpen, setDialogOpen] = useState(false);
const [editing, setEditing] = useState<Question | null>(null);
const [localOrder, setLocalOrder] = useState<Question[]>([]);


const { data: questions } = useListGameQuestions(game.id, {
 query: { queryKey: getListGameQuestionsQueryKey(game.id) },
});
const createQuestion = useCreateQuestion();
const updateQuestion = useUpdateQuestion();
const deleteQuestion = useDeleteQuestion();
const generateQuestions = useGenerateGeminiQuestions();

// AI generate dialog state
const [genOpen, setGenOpen] = useState(false);
const [genCount, setGenCount] = useState(5);
const [genDiff, setGenDiff] = useState<"easy" | "medium" | "hard" | "same">("same");
const [genAvoid, setGenAvoid] = useState(true);
const [genBrief, setGenBrief] = useState(game.brief ?? "");
const [upgradeLimitMsg, setUpgradeLimitMsg] = useState<string | null>(null);

const handleGenerate = async () => {
 const difficulty =
  genDiff === "same"
   ? ((game.difficulty ?? "medium") as "easy" | "medium" | "hard")
   : genDiff;
 const existingQs = genAvoid ? (questions ?? []).map((q) => q.questionText) : undefined;
 try {
  const result = await generateQuestions.mutateAsync({
   gameId: game.id,
   data: { topic: game.topic, difficulty, amount: genCount, existingQuestions: existingQs, brief: genBrief.trim() || undefined },
  });
  invalidate();
  setGenOpen(false);
  toast({ title: `Added ${result.imported} AI-generated questions` });
  if (result.contentFilteredCount && result.contentFilteredCount > 0 && result.contentFilteredMessage) {
   toast({ variant: "destructive", title: result.contentFilteredMessage });
  }
 } catch (err: unknown) {
  const limitMsg = extractFreeTierLimitMsg(err);
  if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
  const errData = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
  const apiMsg = errData && typeof errData === "object" && "error" in errData ? String((errData as { error: unknown }).error) : null;
  const errCode = errData && typeof errData === "object" && "code" in errData ? String((errData as { code: unknown }).code) : null;
  if (errCode === "content_filtered_all" && apiMsg) {
   toast({ variant: "destructive", title: apiMsg });
  } else {
   toast({ variant: "destructive", title: "Generation failed. Please try again." });
  }
 }
};


const sorted = useMemo(
 () => [...(questions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
 [questions],
);


// Sync server order to local when server data changes (and no drag in progress)
useEffect(() => {
 setLocalOrder(sorted);
}, [questions]);


const totalPoints = localOrder.reduce((sum, q) => sum + q.points, 0);


const invalidate = () => {
 queryClient.invalidateQueries({ queryKey: getListGameQuestionsQueryKey(game.id) });
 queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
};


const sensors = useSensors(
 useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
 useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);


const handleDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event;
 if (!over || active.id === over.id) return;


 const oldIndex = localOrder.findIndex((q) => q.id === active.id);
 const newIndex = localOrder.findIndex((q) => q.id === over.id);
 const newOrder = arrayMove(localOrder, oldIndex, newIndex);
 setLocalOrder(newOrder);


 const toUpdate = newOrder
     .map((q, idx) => ({ q, idx }))
     .filter(({ q, idx }) => q.orderIndex !== idx);


 try {
     await Promise.all(
      toUpdate.map(({ q, idx }) =>
       updateQuestion.mutateAsync({
        questionId: q.id,
              data: payloadFromExisting(q, idx),
          }),
         ),
     );
     invalidate();
 } catch {
     toast({ variant: "destructive", title: "Reorder failed" });
     setLocalOrder(sorted);
 }
};


const handleDelete = (id: number) => {
 if (!window.confirm("Delete this question?")) return;
 deleteQuestion.mutate(
     { questionId: id },
     {
         onSuccess: () => { invalidate(); toast({ title: "Question deleted" }); },
         onError: () => toast({ variant: "destructive", title: "Delete failed" }),
     },
 );
};


return (
 <div className="space-y-4">
     <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
     {/* Header */}
     <div className="flex items-center justify-between gap-3 flex-wrap">
   <div>
    <h3 className="font-bold text-lg leading-tight break-words">{game.topic}</h3>
    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
     <span>{localOrder.length} {localOrder.length === 1 ? "question" :"questions"}</span>
       {localOrder.length > 0 && (
         <>
            <span>·</span>
            <span className="text-accent font-semibold flex items-center gap-1">
            <Star className="h-3.5 w-3.5" /> {totalPoints} pts total
            </span>
         </>
       )}
    </div>
   </div>
   <div className="flex items-center gap-2">
    <Button variant="outline" className="font-semibold" onClick={() => setGenOpen(true)}>
     <Sparkles className="mr-1.5 h-4 w-4 text-purple-400" /> Generate with AI
    </Button>
    <Dialog
    open={dialogOpen}
    onOpenChange={(open) => {
       setDialogOpen(open);
       if (!open) setEditing(null);
    }}
   >
    <DialogTrigger asChild>
       <Button className="font-bold">
         <Plus className="mr-1.5 h-4 w-4" /> Add Question
       </Button>
</DialogTrigger>
<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
<DialogHeader>
 <DialogTitle>{editing ? "Edit Question" : "New Question"}</DialogTitle>
</DialogHeader>
<QuestionForm
 key={editing?.id ?? "new"}
 initial={editing ? formFromQuestion(editing) : emptyForm}
 pending={createQuestion.isPending || updateQuestion.isPending}
 submitLabel={editing ? "Save changes" : "Add question"}
 onFillWithAi={editing ? undefined : async (type) => {
  const res = await fetch(`/api/games/${game.id}/questions/generate-preview`, {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   credentials: "include",
   body: JSON.stringify({ questionType: type, difficulty: game.difficulty ?? "medium" }),
  });
  if (!res.ok) throw new Error(await res.text());
  const preview = await res.json() as {
   questionType: string; questionText: string; correctAnswer: string;
   options: string[] | null; points: number; source: string;
  };
  return {
   questionType: preview.questionType as QuestionType,
   questionText: preview.questionText,
   correctAnswer: preview.correctAnswer,
   choices: preview.options && preview.options.length > 0 ? preview.options : ["", "", "", ""],
   pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
   imageUrl: "",
   points: String(preview.points),
   alternateAnswers: "",
   source: preview.source,
   factCheckUrl: "",
  };
 }}
 onSubmit={(form) => {
  if (editing) {
   updateQuestion.mutate(
    { questionId: editing.id, data: buildPayload(form, editing.orderIndex) },
    {
        onSuccess: () => {
         invalidate();
         setDialogOpen(false);
         setEditing(null);
         toast({ title: "Question updated" });
        },
        onError: (err: unknown) => {
            const errData = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
            const apiMsg = errData && typeof errData === "object" && "error" in errData ? String((errData as { error: unknown }).error) : null;
            const errCode = errData && typeof errData === "object" && "code" in errData ? String((errData as { code: unknown }).code) : null;
            if (errCode === "content_filtered" && apiMsg) {
                toast({ variant: "destructive", title: apiMsg });
            } else {
                toast({ variant: "destructive", title: "Update failed" });
            }
        },
    },
   );
  } else {
   const nextIndex =
       localOrder.length > 0
           ? Math.max(...localOrder.map((q) => q.orderIndex)) + 1
           : 0;
      const payload = buildPayload(form, nextIndex);
      createQuestion.mutate(
       {
           gameId: game.id,
           data: {
            ...payload,
            source: payload.source ?? "manual",
           },
       },
       {
           onSuccess: () => {
            invalidate();
            setDialogOpen(false);
            toast({ title: "Question added" });
           },
           onError: (err: unknown) => {
               const errData = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
               const apiMsg = errData && typeof errData === "object" && "error" in errData ? String((errData as { error: unknown }).error) : null;
               const errCode = errData && typeof errData === "object" && "code" in errData ? String((errData as { code: unknown }).code) : null;
               if (errCode === "content_filtered" && apiMsg) {
                   toast({ variant: "destructive", title: apiMsg });
               } else {
                   toast({ variant: "destructive", title: "Create failed" });
               }
           },
       },
      );
  }
 }}
/>
</DialogContent>
 </Dialog>
</div>{/* end flex gap-2 */}
</div>{/* end header flex */}


{/* AI Generate dialog */}
<Dialog open={genOpen} onOpenChange={(open) => { if (!generateQuestions.isPending) setGenOpen(open); }}>
 <DialogContent className="sm:max-w-sm">
  <DialogHeader>
   <DialogTitle className="flex items-center gap-2">
    <Sparkles className="h-4 w-4 text-purple-400" /> Generate Questions with AI
   </DialogTitle>
  </DialogHeader>
  <div className="space-y-4">
   <p className="text-sm text-muted-foreground">
    Gemini AI will generate questions for{" "}
    <span className="font-medium text-foreground">{game.topic}</span>. Review them before going live.
   </p>
   <div className="space-y-1.5">
    <Label>Number of questions (1–20)</Label>
    <Input
     type="number"
     min={1}
     max={20}
     value={genCount}
     onChange={(e) => setGenCount(Math.max(1, Math.min(20, Number(e.target.value))))}
     className="h-9"
    />
   </div>
   <div className="space-y-1.5">
    <Label>Difficulty</Label>
    <Select value={genDiff} onValueChange={(v) => setGenDiff(v as typeof genDiff)}>
     <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
     <SelectContent>
      <SelectItem value="same">Same as game setting</SelectItem>
      <SelectItem value="easy">Easy</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="hard">Hard</SelectItem>
     </SelectContent>
    </Select>
   </div>
   <label className="flex items-center gap-2.5 cursor-pointer">
    <input
     type="checkbox"
     className="accent-primary"
     checked={genAvoid}
     onChange={(e) => setGenAvoid(e.target.checked)}
    />
    <span className="text-sm text-muted-foreground">Avoid duplicating existing questions</span>
   </label>
   <div className="space-y-1.5">
    <Label>Brief <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
    <Textarea
     value={genBrief}
     onChange={(e) => setGenBrief(e.target.value)}
     rows={4}
     maxLength={2000}
     placeholder="Add specific instructions for this generation run…"
     className="resize-none text-sm"
    />
   </div>
   <Button className="w-full" onClick={handleGenerate} disabled={generateQuestions.isPending}>
    {generateQuestions.isPending ? (
     <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
    ) : (
     <><Sparkles className="mr-2 h-4 w-4" />Generate {genCount} Questions</>
    )}
   </Button>
   {generateQuestions.isPending && (
    <p className="text-xs text-center text-muted-foreground">This may take 10–20 seconds…</p>
   )}
  </div>
 </DialogContent>
</Dialog>


{/* Question list */}
{localOrder.length === 0 ? (
 <Card className="border-dashed border-primary/30 bg-card/30">
  <CardContent className="py-12 text-center space-y-3">
   <HelpCircle className="mx-auto h-10 w-10 text-primary/40" />
   <p className="font-semibold">No questions yet</p>
   <p className="text-sm text-muted-foreground max-w-sm mx-auto">
    Write questions one at a time with <span className="font-medium text-foreground">Add Question</span>, or let Gemini AI generate a full set instantly with <span className="font-medium text-foreground">Generate with AI</span>.
   </p>
  </CardContent>
 </Card>
):(
 <>
  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
   <GripVertical className="h-3.5 w-3.5" /> Drag the handle to reorder
  </p>
  <DndContext
   sensors={sensors}
   collisionDetection={closestCenter}
   onDragEnd={handleDragEnd}
  >
   <SortableContext
      items={localOrder.map((q) => q.id)}
      strategy={verticalListSortingStrategy}
     >
      <div className="space-y-2">
         {localOrder.map((q, i) => (
          <SortableQuestionItem
           key={q.id}
           q={q}
           index={i}
           onEdit={(q) => { setEditing(q); setDialogOpen(true); }}
           onDelete={handleDelete}
           deleteDisabled={deleteQuestion.isPending}
          />
         ))}
      </div>
     </SortableContext>
    </DndContext>


    {/* Total points footer */}
    <div className="flex justify-end pt-1">
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-2 text-smfont-semibold text-accent flex items-center gap-2">
      <Star className="h-4 w-4" />
      Total possible: {totalPoints} points
     </div>
    </div>
   </>
         )}
     </div>
    );
}



const createGameSuccessVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

function CreateGameSection({ onCreated, onGoLive }: { onCreated: (game: Game) => void; onGoLive?: (game: Game) => void }) {
    const [categoryId, setCategoryId] = useState<string>("9");
    const [customTopic, setCustomTopic] = useState("");
    const [difficulty, setDifficulty] = useState<Game["difficulty"]>("medium");
const [amount, setAmount] = useState("10");
const [created, setCreated] = useState<Game | null>(null);
const [working, setWorking] = useState(false);
const [workingLabel, setWorkingLabel] = useState("");
const [importedCount, setImportedCount] = useState<number | null>(null);
const [importError, setImportError] = useState<string | null>(null);
 const [importSource, setImportSource] = useState<"opentdb" | "gemini" | "manual" |null>(null);
const [retryCountdown, setRetryCountdown] = useState(0);
const [dailyQuotaExhausted, setDailyQuotaExhausted] = useState(false);
const [brief, setBrief] = useState("");
const [playAlong, setPlayAlong] = useState(false);
const [runMode, setRunMode] = useState<RunMode | null>(null);
const [runModeChosen, setRunModeChosen] = useState(false);
const [joinCodeChosen, setJoinCodeChosen] = useState(false);
const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

const [upgradeLimitMsg, setUpgradeLimitMsg] = useState<string | null>(null);
const { toast } = useToast();
const queryClient = useQueryClient();
const createGame = useCreateGame();
const updateGame = useUpdateGame();
const importQuestions = useImportOpenTdbQuestions();
const generateQuestions = useGenerateGeminiQuestions();


useEffect(() => {
 if (retryCountdown <= 0) return;
 const t = setTimeout(() => setRetryCountdown((n) => Math.max(0, n - 1)), 1000);
 return () => clearTimeout(t);
}, [retryCountdown]);

const parseGeminiRateError = (err: unknown): { isDaily: boolean; isPerMinute: boolean; countdown: number } => {
 const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
 if (status !== 429) return { isDaily: false, isPerMinute: false, countdown: 0 };
 const data = err && typeof err === "object" && "data" in err ? (err as { data: Record<string, unknown> | null }).data : null;
 const kind = data && typeof data.kind === "string" ? data.kind : "";
 const quotaId = data && typeof data.quotaId === "string" ? data.quotaId : "";
 const retryAfterRaw = data && typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 0;
 const isDaily = kind === "rate_limit_daily" || quotaId.toLowerCase().includes("perday") || quotaId.toLowerCase().includes("per_day");
 const isPerMinute = !isDaily && (kind === "rate_limit_minute" || status === 429);
 const countdown = isPerMinute ? (retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : 60) : 0;
 return { isDaily, isPerMinute, countdown };
};
const isCustom = categoryId === "custom";
const selectedCategory = OPENTDB_CATEGORIES.find((c) => String(c.id) === categoryId);
const topicName = isCustom ? customTopic.trim() : (selectedCategory?.name ?? "");
const canSubmit = topicName.length > 0 && !createGame.isPending && !working;
const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!canSubmit) return;


 let game: Game;
  try {
      setWorkingLabel("Creating game…");
      setWorking(true);
      game = await createGame.mutateAsync({
       data: { topic: topicName, difficulty, createdByAdmin: true, brief: brief.trim() || null },
      });
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
  } catch (err: unknown) {
    const limitMsg = extractFreeTierLimitMsg(err);
    if (limitMsg) { setUpgradeLimitMsg(limitMsg); setWorking(false); return; }
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number}).status : 0;
      toast({
       variant: "destructive",
       title: status === 403 ? "Session expired" : "Failed to create game",
   description: status === 403 ? "Please log out and log back in with the admin code." :undefined,
      });
      setWorking(false);
      return;
  }


 if (!isCustom && selectedCategory) {
  // OpenTDB path
  setWorkingLabel("Importing from Open Trivia Database…");
  try {
      const result = await importQuestions.mutateAsync({
       gameId: game.id,
       data: { categoryId: selectedCategory.id, difficulty, amount: Number(amount) },
      });
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
      setImportedCount(result.imported);
      setImportSource("opentdb");
      toast({ title: `${result.imported} questions imported from Open Trivia Database!` });
  } catch (err: unknown) {
      const msg =
    err instanceof Error ? err.message : "Could not fetch questions from Open Trivia Database.";
      setImportError(msg);
      setImportSource("opentdb");
      toast({ variant: "destructive", title: "Import failed — add questions manually" });
  }
 } else {
  // Gemini path for custom topics
  setWorkingLabel("Generating questions with Gemini AI…");
  try {
      const result = await generateQuestions.mutateAsync({
       gameId: game.id,
       data: { topic: topicName, difficulty, amount: Number(amount), brief: brief.trim() || undefined },
          });
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          setImportedCount(result.imported);
          setImportSource("gemini");
          toast({ title: `${result.imported} questions generated` });
          if (result.contentFilteredCount && result.contentFilteredCount > 0 && result.contentFilteredMessage) {
              toast({ variant: "destructive", title: result.contentFilteredMessage });
          }
      } catch (err: unknown) {
          const limitMsg = extractFreeTierLimitMsg(err);
          if (limitMsg) { setUpgradeLimitMsg(limitMsg); setWorking(false); return; }
          const errData = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
          const apiMsg = errData && typeof errData === "object" && "error" in errData ? String((errData as { error: unknown }).error) : null;
          const errCode = errData && typeof errData === "object" && "code" in errData ? String((errData as { code: unknown }).code) : null;
          const msg = apiMsg ?? "Could not generate questions.";
          setImportError(msg);
          setImportSource("gemini");
     const { isDaily: _isDaily1, isPerMinute: _isPM1, countdown: _cd1 } = parseGeminiRateError(err);
          if (_isDaily1) {
              setDailyQuotaExhausted(true);
              toast({ variant: "destructive", title: "Gemini daily quota exhausted — resets at midnight Pacific" });
          } else if (_isPM1) {
              setRetryCountdown(_cd1);
              toast({ variant: "destructive", title: `Rate limited — retry unlocks in ${_cd1} s` });
          } else if (errCode === "content_filtered_all" || errCode === "safety_block") {
              toast({ variant: "destructive", title: msg });
          } else {
              toast({ variant: "destructive", title: "Generation failed — add questions manually" });
          }
      }
  }


 setWorking(false);
 setCreated(game);
};


const handleRetryGeneration = async () => {
 if (!created) return;
 setWorking(true);
 setImportError(null);
 setImportedCount(null);
 setWorkingLabel("Retrying AI question generation… This may take up to 30 seconds");
  try {
   const result = await generateQuestions.mutateAsync({
    gameId: created.id,
    data: {
     topic: created.topic,
     difficulty: (created.difficulty ?? "medium") as "easy" | "medium" | "hard",
     amount: Number(amount),
    },
   });
   queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
   setImportedCount(result.imported);
   setImportSource("gemini");
   toast({ title: `${result.imported} questions generated!` });
  } catch (err: unknown) {
   const limitMsg2 = extractFreeTierLimitMsg(err);
   if (limitMsg2) { setUpgradeLimitMsg(limitMsg2); return; }
   const errData2 = err && typeof err === "object" && "data" in err ? (err as { data: unknown }).data : null;
   const apiMsg2 = errData2 && typeof errData2 === "object" && "error" in errData2 ? String((errData2 as { error: unknown }).error) : null;
   const errCode2 = errData2 && typeof errData2 === "object" && "code" in errData2 ? String((errData2 as { code: unknown }).code) : null;
   const msg = apiMsg2 ?? "Could not generate questions.";
   setImportError(msg);
   setImportSource("gemini");
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number}).status : 0;
   const { isDaily: _isDaily2, isPerMinute: _isPM2, countdown: _cd2 } = parseGeminiRateError(err);
   if (_isDaily2) {
       setDailyQuotaExhausted(true);
       toast({ variant: "destructive", title: "Gemini daily quota exhausted — resets at midnight Pacific" });
   } else if (_isPM2) {
       setRetryCountdown(_cd2);
       toast({ variant: "destructive", title: `Rate limited — retry unlocks in ${_cd2} s` });
   } else if (errCode2 === "safety_block") {
       toast({ variant: "destructive", title: msg });
   } else {
       toast({ variant: "destructive", title: "Generation failed — add questions manually" });
   }
 } finally {
     setWorking(false);
 }
};


const handleReset = () => {
 setCreated(null);
 setImportedCount(null);
 setImportError(null);
 setImportSource(null);
 setCustomTopic("");
 setPlayAlong(false);
 setRunMode(null);
 setRunModeChosen(false);
 setJoinCodeChosen(false);
 setJoinCodeError(null);
};

if (created && importedCount !== null && !working && !runModeChosen) {
 return (
     <RunModeScreen
       value={runMode}
       onSelect={setRunMode}
       onContinue={() => {
         setPlayAlong(runMode === "hostPlay");
         setRunModeChosen(true);
       }}
     />
 );
}

if (created && importedCount !== null && !working && !joinCodeChosen) {
 return (
     <JoinCodeScreen
       initialCode={created.accessCode ?? ""}
       saving={updateGame.isPending}
       error={joinCodeError}
       onSubmit={(code) => {
         setJoinCodeError(null);
         if (code === (created.accessCode ?? "")) {
           setJoinCodeChosen(true);
           return;
         }
         updateGame.mutate(
           { gameId: created.id, data: { accessCode: code } },
           {
             onSuccess: () => {
               setCreated((prev) => prev ? { ...prev, accessCode: code } : prev);
               setJoinCodeChosen(true);
             },
             onError: (err: unknown) => setJoinCodeError(mapJoinCodeError(err)),
           }
         );
       }}
     />
 );
}

if (created && importedCount !== null && !working) {
 // ── "Ready to go live" confirmation ──
 return (
     <motion.div
         variants={createGameSuccessVariants}
         initial="hidden"
         animate="visible"
         className="space-y-4"
     >
      <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
      <div className="mx-auto w-full max-w-[480px] rounded-[24px] border-[1.5px] border-[rgba(25,210,237,0.3)] bg-[#0c1116] px-11 py-10 text-center">
       <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#19d2ed]">
         <Check className="h-8 w-8 text-[#19d2ed]" strokeWidth={3} />
       </span>
       <h3 className="mt-4 text-[30px] font-bold leading-tight text-white">{COPY.readyToGoLive.title}</h3>
       <p className="mt-2 text-[15px] text-[#8b93a4]">
         {COPY.readyToGoLive.subtitle(
           created.topic,
           importedCount,
           importSource === "gemini" ? "Gemini AI" : "Open Trivia Database",
         )}
       </p>
       <div className="mt-6 space-y-3 text-left">
         <div className="flex items-center gap-3 rounded-[14px] border border-[#1e2431] bg-[#0f1420] px-4 py-[14px]">
           <div className="min-w-0 flex-1">
             <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7387]">{COPY.readyToGoLive.joinLabel}</p>
             <p className="text-xl font-bold tracking-[0.12em] text-[#ffde17]">{created.accessCode}</p>
           </div>
           <button
             type="button"
             onClick={() => setJoinCodeChosen(false)}
             className="text-sm font-semibold text-[#19d2ed] hover:brightness-110 transition"
           >
             {COPY.readyToGoLive.editLink}
           </button>
         </div>
         <div className="flex items-center gap-3 rounded-[14px] border border-[rgba(245,19,140,0.45)] bg-[rgba(245,19,140,0.10)] px-4 py-[14px]">
           <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[rgba(245,19,140,0.22)]">
             <CrownMark width={22} color="#f5138c" />
           </span>
           <div className="min-w-0 flex-1">
             <p className="text-[15px] font-bold text-white">
               {playAlong ? COPY.runMode.hostPlayLabel : COPY.runMode.hostOnlyLabel}
             </p>
             <p className="text-[13px] text-[#9aa3b2]">
               {playAlong ? COPY.readyToGoLive.hostPlayDescWeb : COPY.readyToGoLive.hostOnlyDesc}
             </p>
           </div>
           <button
             type="button"
             onClick={() => setRunModeChosen(false)}
             className="text-sm font-semibold text-[#19d2ed] hover:brightness-110 transition"
           >
             {COPY.readyToGoLive.changeLink}
           </button>
         </div>
       </div>
       <div className="mt-7 flex gap-[14px]">
        <button
          type="button"
          className="flex-1 rounded-[14px] border-[1.5px] border-[#2b3446] py-[14px] text-[15px] font-bold text-white transition hover:border-[#445067]"
          onClick={() => onCreated(created)}
        >
          {COPY.readyToGoLive.reviewBtn}
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#f5138c] py-[14px] text-[15px] font-bold text-white transition hover:bg-[#ff2a9c] disabled:opacity-60"
          disabled={updateGame.isPending}
          onClick={() => updateGame.mutate(
            { gameId: created.id, data: { status: "active", hostPlaysAlong: playAlong } },
            {
              onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() }); onGoLive?.(created); },
              onError: () => toast({ variant: "destructive", title: "Couldn't go live — please try again." }),
            }
          )}
        >
          {updateGame.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />Going live…</>
            : <><Play className="h-4 w-4 fill-current" />{COPY.readyToGoLive.goLiveBtn}</>}
        </button>
       </div>
      </div>
     </motion.div>
    );
}

if (created) {
 return (
     <motion.div
         variants={createGameSuccessVariants}
         initial="hidden"
         animate="visible"
         className="space-y-4"
     >
         <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
         <Card className="border-2 border-secondary/50 bg-secondary/5">
    <CardContent className="py-10 text-center space-y-3">
     {working ? (
      <>
       <Loader2 className="mx-auto h-14 w-14 text-primary animate-spin" />
       <h3 className="text-2xl font-bold tracking-tight">{workingLabel}</h3>
      <p className="text-muted-foreground text-sm">This may take a fewseconds…</p>
      </>
     ) : importError ? (
      <>
       <AlertTriangle className="mx-auto h-14 w-14 text-orange-400" />
       <h3 className="text-2xl font-bold tracking-tight">Game Created</h3>
       <p className="text-muted-foreground max-w-sm mx-auto text-sm">
         <span className="font-semibold text-foreground">{created.topic}</span> isready, but
        {importSource === "gemini" ? " Gemini" : " auto-import"} hit a snag:{" "}
        {importError.includes("Too many requests") ? "rate limited by Gemini API" :importError}
       </p>
       <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        {importSource === "gemini" && (
           <Button
            className="font-bold"
        onClick={handleRetryGeneration}
        disabled={working || retryCountdown > 0}
     >
        {working ? (
         <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Retrying…</>
        ) : retryCountdown > 0 ? (
         <><RefreshCw className="mr-2 h-4 w-4" />Retry in {retryCountdown}s</>
        ):(
         <><RefreshCw className="mr-2 h-4 w-4" />Retry Generation</>
        )}
     </Button>
   )}
   <Button
     variant={importSource === "gemini" ? "outline" : "default"}
     className="font-bold"
     onClick={() => onCreated(created)}
   >
     <Pencil className="mr-2 h-4 w-4" /> Add Questions Manually
   </Button>
   <Button variant="ghost" onClick={handleReset}>
     Create Another
   </Button>
  </div>
 </>
) : null}
</CardContent>
         </Card>
     </motion.div>
    );
}


return (
    <div className="space-y-6 max-w-xl">
     <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
     <div>
         <h2 className="text-xl font-bold tracking-tight">Create a new game</h2>
     </div>
     <form onSubmit={handleSubmit} className="space-y-5">


         {/* Category / Topic */}
         <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
           <SelectTrigger className="h-12">
            <SelectValue placeholder="Select a category…" />
           </SelectTrigger>
           <SelectContent>
      <SelectItem value="custom">Custom topic — Gemini AI generates questions</SelectItem>
     <Separator className="my-1" />
     {OPENTDB_CATEGORIES.map((cat) => (
      <SelectItem key={cat.id} value={String(cat.id)}>
          {cat.name}
      </SelectItem>
     ))}
     </SelectContent>
 </Select>
<p className="text-xs text-muted-foreground mt-1">{isCustom ? 'Gemini AI generates questions on the topic you enter below.' : 'Questions are pulled from Open Trivia Database.'}</p>
</div>


{/* Custom topic text input */}
{isCustom && (
 <div className="space-y-2">
     <Label htmlFor="customTopic">Topic</Label>
     <Input
     id="customTopic"
     value={customTopic}
     onChange={(e) => setCustomTopic(e.target.value)}
     placeholder="e.g. Harry Potter, The Office, 80s Music, Local History…"
     className="h-12 text-base"
     autoFocus
     />
 </div>
)}
{isCustom && (
 <div className="space-y-2">
  <Label htmlFor="createBrief">Brief <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <Textarea
   id="createBrief"
   value={brief}
   onChange={(e) => setBrief(e.target.value)}
   rows={6}
   maxLength={2000}
   placeholder="e.g. Focus on the 1990s. Players are experts — skip the obvious. No chart position questions."
   className="resize-none text-sm"
  />
 </div>
)}


<div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
     <Label>Difficulty</Label>
    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Game["difficulty"])}>
      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
      <SelectContent>
       <SelectItem value="easy">Easy (5 pts each)</SelectItem>
       <SelectItem value="medium">Medium (10 pts each)</SelectItem>
       <SelectItem value="hard">Hard (15 pts each)</SelectItem>
      </SelectContent>
     </Select>
    </div>
    <div className="space-y-2">
     <Label>Questions to {isCustom ? "Generate" : "Import"}</Label>
     <Select value={amount} onValueChange={setAmount}>
      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
      <SelectContent>
       <SelectItem value="5">5 questions</SelectItem>
       <SelectItem value="10">10 questions</SelectItem>
       <SelectItem value="15">15 questions</SelectItem>
       {!isCustom && <SelectItem value="20">20 questions</SelectItem>}
      </SelectContent>
     </Select>
    </div>
   </div>
   {/* Info card */}
   {isCustom && (
    <Card className="border-purple-500/30 bg-purple-500/5">
     <CardContent className="p-4 text-sm space-y-1.5 flex gap-3">
      <Lightbulb className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
         <p className="text-muted-foreground">
         Questions are generated by Gemini AI. Review them in the
         Review Questions tab before going live.
         </p>
      </div>
     </CardContent>
    </Card>
   )}

         <Button
          type="submit"
          className="w-full h-12 font-bold text-base"
          disabled={!canSubmit}
         >
          {createGame.isPending || working ? (
     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {workingLabel ||"Working…"}</>
          ) : isCustom ? (
              <><Lightbulb className="mr-2 h-4 w-4" /> Create & Generate with Gemini</>
          ):(
              <><Database className="mr-2 h-4 w-4" /> Save Game</>
          )}
         </Button>
         </form>
     </div>
    );
}

function QuestionsSection({
 games,
 preferGameId,
}: {
 games: Game[];
 preferGameId?: number;
}) {
 // Show waiting AND active (live) games — completed games have locked question sets.
 const editableGames = games.filter((g) => g.status === "waiting" || g.status === "active");
 const [selectedId, setSelectedId] = useState<number | null>(() => {
  if (preferGameId) return preferGameId;
  return editableGames[0]?.id ?? null;
 });


 useEffect(() => {
  if (preferGameId) { setSelectedId(preferGameId); return; }
  if (selectedId === null && editableGames.length > 0) {
       setSelectedId(editableGames[0]!.id);
   }
 }, [games, preferGameId]);


 const selectedGame = games.find((g) => g.id === selectedId) ?? null;


 return (
   <div className="space-y-5">
<div>
 <h2 className="text-xl font-bold tracking-tight">Add Questions</h2>
 <p className="text-muted-foreground text-sm mt-1">
  Select a game and build its question set manually.
 </p>
</div>


{editableGames.length === 0 ? (
 <Card className="border-dashed border-primary/30 bg-card/40">
 <CardContent className="py-12 text-center space-y-2">
  <Gamepad2 className="mx-auto h-10 w-10 text-primary/40" />
  <p className="font-semibold">No active games</p>
  <p className="text-sm text-muted-foreground">
      Create a new game first. Completed games are archived and cannot
      be edited.
  </p>
 </CardContent>
</Card>
):(
<>
 <div className="space-y-2">
  <Label>Select Game</Label>
  <Select
      value={selectedId !== null ? String(selectedId) : ""}
      onValueChange={(v) => setSelectedId(Number(v))}
  >
      <SelectTrigger className="h-11 max-w-sm">
       <SelectValue placeholder="Choose a game..." />
      </SelectTrigger>
      <SelectContent>
       {editableGames.map((g) => (
        <SelectItem key={g.id} value={String(g.id)}>
         <span className="flex items-center gap-2">
          {g.status === "active" && (
           <span className="inline-block w-2 h-2 rounded-full bg-pink-500 shrink-0" />
          )}
          {g.topic}
          <span className="text-muted-foreground text-xs">
           ({g.questionCount} {g.questionCount === 1 ? "question" : "questions"}{g.status === "active" ? " · live" : ""})
          </span>
         </span>
                    </SelectItem>
                   ))}
                   </SelectContent>
               </Select>
              </div>


              {selectedGame ? (
               <QuestionManager game={selectedGame} />
              ):(
               <p className="text-sm text-muted-foreground">Select a game above.</p>
              )}
          </>
         )}
     </div>
    );
}


// ─── Review Questions section ─────────────────────────────────────────────────


function ReviewSection({ games }: { games: Game[] }) {
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const [filter, setFilter] = useState<"all" | "opentdb" | "ai" | "manual">("all");
    const [sortBy, setSortBy] = useState<"order" | "type" | "dateAdded">("order");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const { toast } = useToast();
const queryClient = useQueryClient();
const updateQuestion = useUpdateQuestion();
const deleteQuestion = useDeleteQuestion();


const [upgradeLimitMsg, setUpgradeLimitMsg] = useState<string | null>(null);

// Regenerate modal state
const [regenQ, setRegenQ] = useState<Question | null>(null);
const [regenDiff, setRegenDiff] = useState<"same" | "easy" | "medium" | "hard">("same");
const [regenType, setRegenType] = useState<string>("same");
const [regenLoading, setRegenLoading] = useState(false);
 const [regenPreview, setRegenPreview] = useState<RegenerateQuestionPreview |null>(null);
const [regenError, setRegenError] = useState<string | null>(null);


// Enhance modal state
const [enhQ, setEnhQ] = useState<Question | null>(null);
const [enhLoading, setEnhLoading] = useState(false);
const [enhResult, setEnhResult] = useState<EnhanceQuestionResult | null>(null);
const [enhError, setEnhError] = useState<string | null>(null);
const [enhAcceptText, setEnhAcceptText] = useState(false);
const [enhAcceptOptions, setEnhAcceptOptions] = useState(false);
const [enhAcceptSource, setEnhAcceptSource] = useState(false);


// Generate More modal state
const [genMoreOpen, setGenMoreOpen] = useState(false);
const [genMoreCount, setGenMoreCount] = useState(5);
 const [genMoreDiff, setGenMoreDiff] = useState<"easy" | "medium" | "hard" |"same">("same");
const [genMoreAvoid, setGenMoreAvoid] = useState(true);
const [genMoreBrief, setGenMoreBrief] = useState("");

// Regenerate All modal state
const [regenAllOpen, setRegenAllOpen] = useState(false);
const [regenAllCount, setRegenAllCount] = useState(10);
const [regenAllDiff, setRegenAllDiff] = useState<"easy" | "medium" | "hard" | "same">("same");
const [regenAllBrief, setRegenAllBrief] = useState("");
const [regenAllRunning, setRegenAllRunning] = useState(false);


const regenMutation = useRegenerateQuestion();
const enhanceMutation = useEnhanceQuestion();
const generateMore = useGenerateGeminiQuestions();


useEffect(() => {
 if (selectedGameId === null && games.length > 0) {
     setSelectedGameId(games[0]!.id);
 }
}, [games]);


const { data: rawQuestions = [] } = useListGameQuestions(selectedGameId ?? 0, {
 query: {
     queryKey: getListGameQuestionsQueryKey(selectedGameId ?? 0),
     enabled: selectedGameId !== null,
 },
});


const invalidate = () => {
 if (selectedGameId !== null) {
   queryClient.invalidateQueries({ queryKey:getListGameQuestionsQueryKey(selectedGameId) });
 }
 queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
};


const filtered = rawQuestions.filter((q) => {
 switch (filter) {
     case "opentdb": return q.source === "opentdb";
     case "ai": return !!q.aiGenerated;
     case "manual": return q.source === "manual" || (!q.source && !q.aiGenerated);
     default: return true;
 }
});
const displayList = [...filtered].sort((a, b) => {
 if (sortBy === "type") return a.questionType.localeCompare(b.questionType);
 if (sortBy === "dateAdded") return b.id - a.id;
 return a.orderIndex - b.orderIndex;
});


const toggleSelect = (id: number) => {
 setSelected((prev) => {
     const next = new Set(prev);
     if (next.has(id)) next.delete(id); else next.add(id);
     return next;
 });
};
const allSelected = displayList.length > 0 && displayList.every((q) => selected.has(q.id));
const toggleSelectAll = () => {
 if (allSelected) setSelected(new Set());
 else setSelected(new Set(displayList.map((q) => q.id)));
};


const handleDelete = (id: number) => {
 if (!window.confirm("Delete this question?")) return;
 deleteQuestion.mutate(
     { questionId: id },
     {
         onSuccess: () => {
          invalidate();
          setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
          toast({ title: "Question deleted" });
         },
         onError: () => toast({ variant: "destructive", title: "Delete failed" }),
     },
 );
};


const handleBulkDelete = async () => {
 if (!window.confirm(`Delete ${selected.size} selected questions?`)) return;
 const ids = Array.from(selected);
   await Promise.allSettled(ids.map((id) => deleteQuestion.mutateAsync({ questionId: id})));
 invalidate();
 setSelected(new Set());
 toast({ title: `Deleted ${ids.length} questions` });
};


const handleRunRegen = async () => {
 if (!regenQ || !selectedGameId) return;
 setRegenLoading(true);
 setRegenPreview(null);
 setRegenError(null);
 const game = games.find((g) => g.id === selectedGameId);
 const difficulty =
     regenDiff === "same"
      ? ((game?.difficulty ?? "medium") as "easy" | "medium" | "hard")
      : regenDiff;
 const questionType =
     regenType === "same"
      ? (regenQ.questionType as "multiple_choice" | "true_false" | "write_in")
      : (regenType as "multiple_choice" | "true_false" | "write_in");
 try {
     const preview = await regenMutation.mutateAsync({
      gameId: selectedGameId,
      questionId: regenQ.id,
      data: { difficulty, questionType },
     });
     setRegenPreview(preview);
 } catch (err) {
     const limitMsg = extractFreeTierLimitMsg(err);
     if (limitMsg) { setUpgradeLimitMsg(limitMsg); setRegenLoading(false); return; }
     const msg = err instanceof Error ? err.message : "Generation failed. Please try again.";
  setRegenError(msg.includes("Too many requests") ? "Rate limited — please wait amoment and try again." : msg);
 } finally {
     setRegenLoading(false);
 }
};


const handleAcceptRegen = () => {
 if (!regenQ || !regenPreview) return;
 const opts =
     regenPreview.options && regenPreview.options.length > 0
         ? ({ choices: regenPreview.options } as unknown as Record<string, unknown>)
         : null;
 updateQuestion.mutate(
     {
         questionId: regenQ.id,
         data: {
          questionText: regenPreview.questionText,
     questionType: regenPreview.questionType as "multiple_choice" | "true_false" |"write_in",
          correctAnswer: regenPreview.correctAnswer,
          options: opts,
          points: regenPreview.points,
          source: regenPreview.source,
         },
     },
     {
         onSuccess: () => {
          invalidate();
          setRegenQ(null);
          setRegenPreview(null);
          toast({ title: "Question replaced" });
      },
      onError: () => toast({ variant: "destructive", title: "Update failed" }),
     },
 );
};


const handleRunEnhance = async (q: Question) => {
 if (!selectedGameId) return;
 setEnhQ(q);
 setEnhLoading(true);
 setEnhResult(null);
 setEnhError(null);
 setEnhAcceptText(false);
 setEnhAcceptOptions(false);
 setEnhAcceptSource(false);
 try {
  const result = await enhanceMutation.mutateAsync({ gameId: selectedGameId,questionId: q.id });
     setEnhResult(result);
 } catch (err) {
     const limitMsg = extractFreeTierLimitMsg(err);
     if (limitMsg) { setUpgradeLimitMsg(limitMsg); setEnhLoading(false); return; }
     const msg = err instanceof Error ? err.message : "Enhancement failed. Please try again.";
  setEnhError(msg.includes("Too many requests") ? "Rate limited — please wait amoment and try again." : msg);
 } finally {
     setEnhLoading(false);
 }
};


const handleApplyEnhancements = () => {
 if (!enhQ || !enhResult) return;
 type Patch = {
     questionText?: string;
     options?: Record<string, unknown> | null;
     source?: string | null;
 };
 const patch: Patch = {};
 if (enhAcceptText) patch.questionText = enhResult.improvedQuestionText;
 if (enhAcceptOptions && enhResult.improvedOptions &&enhResult.improvedOptions.length > 0) {
     patch.options = { choices: enhResult.improvedOptions } as Record<string, unknown>;
 }
 if (enhAcceptSource && enhResult.suggestedSource) patch.source =enhResult.suggestedSource;
 if (Object.keys(patch).length === 0) {
     toast({ title: "No improvements selected" });
     return;
 }
 updateQuestion.mutate(
  { questionId: enhQ.id, data: patch as Parameters<typeof updateQuestion.mutate>[0]["data"] },
     {
         onSuccess: () => {
          invalidate();
          setEnhQ(null);
          setEnhResult(null);
          toast({ title: "Enhancements applied" });
      },
      onError: () => toast({ variant: "destructive", title: "Update failed" }),
     },
 );
};


const handleGenerateMore = async () => {
 if (!selectedGameId) return;
 const game = games.find((g) => g.id === selectedGameId);
 if (!game) return;
 const difficulty =
     genMoreDiff === "same"
      ? ((game.difficulty ?? "medium") as "easy" | "medium" | "hard")
      : genMoreDiff;
 const existingQs = genMoreAvoid ? rawQuestions.map((q) => q.questionText) : undefined;
 try {
     const result = await generateMore.mutateAsync({
      gameId: selectedGameId,
    data: { topic: game.topic, difficulty, amount: genMoreCount, existingQuestions: existingQs, brief: genMoreBrief.trim() || undefined },
     });
     invalidate();
      setGenMoreOpen(false);
   toast({ title: `Added ${result.imported} questions — total now ${rawQuestions.length + result.imported}` });
  } catch (err: unknown) {
      const limitMsg = extractFreeTierLimitMsg(err);
      if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
      toast({ variant: "destructive", title: "Generation failed. Please try again." });
  }
 };


 const handleRegenAll = async () => {
  if (!selectedGameId) return;
  const game = games.find((g) => g.id === selectedGameId);
  if (!game) return;
  setRegenAllRunning(true);
  try {
    // Capture old question texts BEFORE deleting so Gemini can avoid rewriting them
    const oldTexts = rawQuestions
      .map((q) => q.questionText)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    // 1. Delete all existing questions — abort if any deletion fails
    const deleteResults = await Promise.allSettled(rawQuestions.map((q) => deleteQuestion.mutateAsync({ questionId: q.id })));
    const failedDeletes = deleteResults.filter((r) => r.status === "rejected").length;
    if (failedDeletes > 0) {
      invalidate();
      toast({
        variant: "destructive",
        title: `Could not delete ${failedDeletes} existing question${failedDeletes === 1 ? "" : "s"}. Regeneration cancelled — please try again.`,
      });
      return;
    }
    // 2. Generate fresh questions via Gemini, avoiding the old ones
    const difficulty =
      regenAllDiff === "same"
        ? ((game.difficulty ?? "medium") as "easy" | "medium" | "hard")
        : regenAllDiff;
    const result = await generateMore.mutateAsync({
      gameId: selectedGameId,
      data: { topic: game.topic, difficulty, amount: regenAllCount, existingQuestions: oldTexts, brief: regenAllBrief.trim() || undefined },
    });
    invalidate();
    setRegenAllOpen(false);
    toast({ title: `Regenerated ${result.imported} questions for "${game.topic}"` });
  } catch (err: unknown) {
    const limitMsg = extractFreeTierLimitMsg(err);
    if (limitMsg) { setUpgradeLimitMsg(limitMsg); return; }
    toast({ variant: "destructive", title: "Regeneration failed. Please try again." });
  } finally {
    setRegenAllRunning(false);
  }
};


 const getSourceBadge = (q: Question) => {
 if (q.aiGenerated) return { label: "AI Generated", cls: "bg-purple-500/15 text-purple-400border-purple-500/30" };
 if (q.source === "opentdb") return { label: "Open Trivia Database", cls: "bg-blue-500/15 text-blue-400border-blue-500/30" };
  return { label: "Manual", cls: "bg-green-500/15 text-green-400 border-green-500/30" };
 };


 const FILTERS: { key: typeof filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "opentdb", label: "Open Trivia Database" },
  { key: "ai", label: "AI Generated" },
  { key: "manual", label: "Manual" },
 ];


 const filterCount = (key: typeof filter) => rawQuestions.filter((q) => {
  switch (key) {
     case "opentdb": return q.source === "opentdb";
     case "ai": return !!q.aiGenerated;
     case "manual": return q.source === "manual" || (!q.source && !q.aiGenerated);
     default: return true;
 }
}).length;


return (
 <div className="space-y-5">
     <FreeTierLimitModal msg={upgradeLimitMsg} onClose={() => setUpgradeLimitMsg(null)} />
     <div>
      <h2 className="text-xl font-bold tracking-tight">Review Questions</h2>
      <p className="text-muted-foreground text-sm mt-1">
       Edit and manage questions across all games.
      </p>
     </div>


     {games.length === 0 ? (
      <Card className="border-dashed border-primary/30 bg-card/40">
       <CardContent className="py-14 text-center space-y-2">
        <Gamepad2 className="mx-auto h-10 w-10 text-primary/40" />
        <p className="font-semibold">No games yet</p>
     <p className="text-sm text-muted-foreground">Create a game first to review itsquestions.</p>
       </CardContent>
      </Card>
     ):(
     <>
     {/* Game + sort selectors */}
     <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label>Game</Label>
          <Select
          value={selectedGameId !== null ? String(selectedGameId) : ""}
          onValueChange={(v) => { setSelectedGameId(Number(v)); setSelected(new Set());}}
          >
          <SelectTrigger className="h-10">
              <SelectValue placeholder="Select a game..." />
          </SelectTrigger>
          <SelectContent>
              {games.map((g) => (
               <SelectItem key={g.id} value={String(g.id)}>
                {g.topic}
           <span className="ml-2 text-muted-foreground text-xscapitalize">({g.status})</span>
               </SelectItem>
              ))}
          </SelectContent>
          </Select>
      </div>
      <div className="space-y-1.5">
          <Label>Sort by</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
       <SelectTrigger className="h-10 w-44">
        <SelectValue />
       </SelectTrigger>
       <SelectContent>
        <SelectItem value="order">Question order</SelectItem>
        <SelectItem value="dateAdded">Date added (newest first)</SelectItem>
        <SelectItem value="type">Question type</SelectItem>
       </SelectContent>
      </Select>
     </div>
    </div>


    {/* Toolbar */}
    {selectedGameId !== null && rawQuestions.length > 0 && (
     <div className="flex items-center justify-between rounded-lg border border-card-border bg-card/50 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{rawQuestions.length} question{rawQuestions.length !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-2 shrink-0">
       <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => { const g = games.find((g) => g.id === selectedGameId); setGenMoreBrief(g?.brief ?? ""); setGenMoreOpen(true); }}
        disabled={regenAllRunning}
       >
        <Sparkles className="h-3 w-3" /> Generate More
       </Button>
       <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
        onClick={() => { const g = games.find((g) => g.id === selectedGameId); setRegenAllBrief(g?.brief ?? ""); setRegenAllOpen(true); }}
        disabled={regenAllRunning || rawQuestions.length === 0}
       >
        <RefreshCw className="h-3 w-3" /> Regenerate All
       </Button>
      </div>
     </div>
    )}


     {/* Filter tabs */}
     <div className="flex gap-2 flex-wrap">
      {FILTERS.map((f) => (
          <button
          key={f.key}
          onClick={() => { setFilter(f.key); setSelected(new Set()); }}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border${
              filter === f.key
               ? "bg-primary text-primary-foreground border-primary"
         : "bg-card/60 text-muted-foreground border-card-border hover:border-muted-foreground/50"
          }`}
          >
          {f.label} ({filterCount(f.key)})
          </button>
      ))}
     </div>
    {/* Bulk action bar */}
    <AnimatePresence>
     {selected.size > 0 && (
      <motion.div
       initial={{ opacity: 0, y: -8 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -8 }}
       className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5"
      >
       <span className="text-sm font-medium flex-1">{selected.size} selected</span>
       <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleBulkDelete}
          disabled={deleteQuestion.isPending}
       >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Selected
       </Button>
       <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
          <X className="h-3.5 w-3.5" />
       </Button>
  </motion.div>
)}
</AnimatePresence>


     {/* Question list */}
     {selectedGameId === null ? (
      <p className="text-sm text-muted-foreground">Select a game above.</p>
    ) : displayList.length === 0 ? (
     <Card className="border-dashed border-card-border bg-card/30">
      <CardContent className="py-10 text-center text-muted-foreground text-sm">
       No questions match this filter.
      </CardContent>
     </Card>
    ):(
     <div className="space-y-2">
      {/* Select-all row */}
      <div className="flex items-center gap-2 px-1">
       <button
          onClick={toggleSelectAll}
          className="text-muted-foreground hover:text-foreground transition-colors"
       >
          {allSelected
           ? <CheckSquare className="h-4 w-4 text-primary" />
           : <Square className="h-4 w-4" />}
       </button>
       <span className="text-xs text-muted-foreground">
          {allSelected ? "Deselect all" : `Select all ${displayList.length}`}
       </span>
      </div>


      {displayList.map((q) => {
       const { Icon, label: typeLabel, color } = TYPE_META[q.questionType as QuestionType] ?? TYPE_META.write_in;
       const src = getSourceBadge(q);
       const isSelected = selected.has(q.id);
       return (
        <motion.div
         key={q.id}
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className={`rounded-lg border bg-card/60 p-3.5 transition-colors ${
            isSelected ? "border-primary/40 bg-primary/5" : "border-card-border"
         }`}
        >
         <div className="flex items-start gap-3">
            {/* Checkbox */}
            <button
             onClick={() => toggleSelect(q.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primarytransition-colors"
            >
             {isSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
            </button>


            {/* Type icon */}
            <div className={`mt-0.5 shrink-0 ${color}`}>
             <Icon className="h-4 w-4" />
            </div>
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
           <p className="font-medium leading-snug text-sm break-words">{q.questionText}</p>
           <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase text-[10px]">{typeLabel}</Badge>
             <Badge variant="outline" className={`text-[10px]${src.cls}`}>{src.label}</Badge>
            <span className="text-xs text-accent font-semibold flex items-center gap-0.5">
            <Star className="h-3 w-3" /> {q.points} pts
            </span>
           </div>
           {q.questionType !== "matching" && (
            <p className="text-xs text-muted-foreground">
           Answer: <span className="text-secondary font-medium">{q.correctAnswer}</span>
           </p>
          )}
          {q.source && q.source !== "manual" && q.source !== "opentdb" && (
           <p className="text-xs text-muted-foreground">Source: {q.source}</p>
          )}
         </div>


         {/* Actions */}
         <div className="flex flex-col sm:flex-row gap-1 shrink-0">
{q.aiGenerated && (
<Button
    variant="ghost"
    size="sm"
    className="h-8 px-2 text-xs text-purple-400 hover:text-purple-300"
    onClick={() => {
     setRegenQ(q);
     setRegenDiff("same");
     setRegenType("same");
     setRegenPreview(null);
     setRegenError(null);
    }}
>
    <RefreshCw className="mr-1 h-3 w-3" />Regen
 </Button>
)}
<Button
 variant="ghost"
 size="sm"
 className="h-8 px-2 text-xs text-blue-400 hover:text-blue-300"
 onClick={() => handleRunEnhance(q)}
 disabled={enhanceMutation.isPending && enhQ?.id === q.id}
>
 <Wand2 className="mr-1 h-3 w-3" />Enhance
</Button>
<Button
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 onClick={() => { setEditingQuestion(q); setEditDialogOpen(true); }}
>
 <Pencil className="h-3.5 w-3.5" />
</Button>
<Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-destructive hover:text-destructive"
 onClick={() => handleDelete(q.id)}
 disabled={deleteQuestion.isPending}
>
                 <Trash2 className="h-3.5 w-3.5" />
                </Button>
               </div>
               </div>
           </motion.div>
          );
         })}
     </div>
    )}


    {/* ── Regenerate dialog ── */}
    <Dialog open={regenQ !== null} onOpenChange={(open) => { if (!open) {setRegenQ(null); setRegenPreview(null); setRegenError(null); } }}>
     <DialogContent className="sm:max-w-md">
         <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
           <RefreshCw className="h-4 w-4 text-purple-400" /> Regenerate Question
          </DialogTitle>
         </DialogHeader>
         {regenQ && (
          <div className="space-y-4">
           <div className="rounded-md border border-card-border bg-card/50 p-3">
               <p className="text-xs text-muted-foreground mb-1">Current question</p>
               <p className="text-sm font-medium leading-snug">{regenQ.questionText}</p>
           </div>
        {/* Difficulty */}
        <div className="space-y-2">
         <p className="text-sm font-medium">Difficulty</p>
         <div className="flex flex-wrap gap-2">
          {(["same", "easy", "medium", "hard"] as const).map((d) => (
           <button
            key={d}
            onClick={() => setRegenDiff(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                regenDiff === d
                ? "bg-primary text-primary-foreground border-primary"
             : "bg-card/60 text-muted-foreground border-card-border hover:border-muted-foreground/50"
            }`}
           >
            {d === "same" ? "Same as current" : d}
           </button>
          ))}
         </div>
        </div>


        {/* Question type */}
        <div className="space-y-2">
         <p className="text-sm font-medium">Question type</p>
         <Select value={regenType} onValueChange={setRegenType}>
          <SelectTrigger className="h-9">
             <SelectValue />
             </SelectTrigger>
             <SelectContent>
             <SelectItem value="same">Same as current</SelectItem>
             <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
             <SelectItem value="true_false">True / False</SelectItem>
             <SelectItem value="write_in">Write-in</SelectItem>
             </SelectContent>
         </Select>
        </div>


        {/* Error */}
        {regenError && (
         <div className="flex items-center gap-2 rounded-md bg-destructive/10 borderborder-destructive/20 px-3 py-2 text-xs text-destructive">
             <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {regenError}
         </div>
        )}


        {/* Preview */}
        {regenPreview && (
         <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
             <p className="text-xs text-primary font-medium">New question preview</p>
          <p className="text-sm font-medium leading-snug">{regenPreview.questionText}</p>
             <p className="text-xs text-muted-foreground">
         Answer: <span className="text-secondary font-medium">{regenPreview.correctAnswer}</span>
            </p>
            {regenPreview.options && regenPreview.options.length > 0 && (
             <p className="text-xs text-muted-foreground">
                 Options: {regenPreview.options.join(" · ")}
             </p>
            )}
          <p className="text-xs text-muted-foreground">Source:{regenPreview.source}</p>
        </div>
       )}


       {/* Action buttons */}
       <div className="flex gap-2 flex-wrap">
        <Button
            className="flex-1"
            onClick={handleRunRegen}
            disabled={regenLoading}
        >
            {regenLoading ? (
             <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
            ) : regenPreview ? (
             <><RefreshCw className="mr-2 h-4 w-4" />Try Again</>
            ):(
             <><Sparkles className="mr-2 h-4 w-4" />Generate</>
            )}
           </Button>
           {regenPreview && (
            <Button
                variant="outline"
                className="flex-1 border-secondary/40 text-secondary"
                onClick={handleAcceptRegen}
                disabled={updateQuestion.isPending}
            >
                <CheckCircle2 className="mr-2 h-4 w-4" />Accept
            </Button>
           )}
           </div>
       </div>
      )}
     </DialogContent>
    </Dialog>


    {/* ── Enhance dialog ── */}
    <Dialog open={enhQ !== null} onOpenChange={(open) => { if (!open) { setEnhQ(null);setEnhResult(null); setEnhError(null); } }}>
     <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
       <DialogTitle className="flex items-center gap-2">
           <Wand2 className="h-4 w-4 text-blue-400" /> Enhance Question
       </DialogTitle>
      </DialogHeader>
      {enhQ && (
       <div className="space-y-4">
       {/* Loading */}
       {enhLoading && (
        <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing with Gemini…</p>
        </div>
       )}


       {/* Error */}
       {enhError && (
         <div className="flex items-center gap-2 rounded-md bg-destructive/10 borderborder-destructive/20 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {enhError}
        </div>
       )}


       {enhResult && (
        <>


{/* Side-by-side comparison */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Original */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercasetracking-wide">Original</p>
           <div className="rounded-md border border-card-border bg-card/50 p-3 text-sm space-y-1.5">
            <p className="font-medium leading-snug">{enhQ.questionText}</p>
            {enhQ.source && <p className="text-xs text-muted-foreground">Source:{enhQ.source}</p>}
           </div>
          </div>
          {/* Suggested */}
          <div className="space-y-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Suggested</p>
           <div className="rounded-md border border-primary/30 bg-primary/5 p-3text-sm space-y-1.5">
           <p className="font-medium leading-snug">{enhResult.improvedQuestionText}</p>
            {enhResult.suggestedSource && (
             <p className="text-xs text-muted-foreground">Source:{enhResult.suggestedSource}</p>
            )}
           </div>
          </div>
         </div>
         {enhResult.suggestions && (
            <div className="rounded-md bg-muted/20 border border-card-border px-3py-2 text-xs text-muted-foreground">
           <span className="font-medium text-foreground">Tips:</span>{enhResult.suggestions}
          </div>
         )}


         {/* Checkboxes */}
         <div className="space-y-2">
          <p className="text-sm font-medium">Apply improvements</p>
          <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={enhAcceptText}
              onChange={(e) => setEnhAcceptText(e.target.checked)}
              />
            <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
              Use improved question text
              </span>
          </label>
          {enhResult.improvedOptions && enhResult.improvedOptions.length > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
               type="checkbox"
               className="mt-0.5 accent-primary"
               checked={enhAcceptOptions}
               onChange={(e) => setEnhAcceptOptions(e.target.checked)}
               />
             <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
               Use improved answer options
               </span>
           </label>
          )}
          {enhResult.suggestedSource && (
           <label className="flex items-start gap-2.5 cursor-pointer group">
               <input
               type="checkbox"
               className="mt-0.5 accent-primary"
               checked={enhAcceptSource}
               onChange={(e) => setEnhAcceptSource(e.target.checked)}
               />
             <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
               Use suggested source
               </span>
           </label>
          )}
         </div>


         {/* Buttons */}
                <div className="flex gap-2">
                <Button
                 onClick={handleApplyEnhancements}
          disabled={updateQuestion.isPending || (!enhAcceptText &&!enhAcceptOptions && !enhAcceptSource)}
                 className="flex-1"
                >
                 Apply Selected Changes
                </Button>
                <Button variant="ghost" onClick={() => { setEnhQ(null); setEnhResult(null); }}>
                 Dismiss
                </Button>
                </div>
            </>
           )}
       </div>
      )}
     </DialogContent>
    </Dialog>


    {/* ── Generate More dialog ── */}
    <Dialog open={genMoreOpen} onOpenChange={setGenMoreOpen}>
     <DialogContent className="sm:max-w-sm">
      <DialogHeader>
       <DialogTitle className="flex items-center gap-2">
           <Sparkles className="h-4 w-4 text-primary" /> Generate More Questions
       </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
       {selectedGameId !== null && (
        <p className="text-sm text-muted-foreground">
            Adding to: <span className="font-medium text-foreground">
            {games.find((g) => g.id === selectedGameId)?.topic}
            </span>
        </p>
       )}
       <div className="space-y-1.5">
        <Label>Number of questions (1–10)</Label>
        <Input
            type="number"
            min={1}
            max={10}
            value={genMoreCount}
       onChange={(e) => setGenMoreCount(Math.max(1, Math.min(10,Number(e.target.value))))}
            className="h-9"
        />
       </div>
       <div className="space-y-1.5">
        <Label>Difficulty</Label>
       <Select value={genMoreDiff} onValueChange={(v) => setGenMoreDiff(v as typeof genMoreDiff)}>
            <SelectTrigger className="h-9">
           <SelectValue />
           </SelectTrigger>
           <SelectContent>
           <SelectItem value="same">Same as game setting</SelectItem>
           <SelectItem value="easy">Easy</SelectItem>
           <SelectItem value="medium">Medium</SelectItem>
           <SelectItem value="hard">Hard</SelectItem>
           </SelectContent>
        </Select>
       </div>
       <label className="flex items-center gap-2.5 cursor-pointer">
        <input
           type="checkbox"
           className="accent-primary"
           checked={genMoreAvoid}
           onChange={(e) => setGenMoreAvoid(e.target.checked)}
        />
        <span className="text-sm text-muted-foreground">Avoid duplicating existingquestions</span>
       </label>
       <div className="space-y-1.5">
        <Label>Brief <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <Textarea
         value={genMoreBrief}
         onChange={(e) => setGenMoreBrief(e.target.value)}
         rows={4}
         maxLength={2000}
         placeholder="Add specific instructions for this generation run…"
         className="resize-none text-sm"
        />
       </div>
       <Button
        className="w-full"
        onClick={handleGenerateMore}
        disabled={generateMore.isPending}
       >
        {generateMore.isPending ? (
             <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
         ):(
        <><Sparkles className="mr-2 h-4 w-4" />Generate {genMoreCount}Questions</>
         )}
        </Button>
        {generateMore.isPending && (
       <p className="text-xs text-center text-muted-foreground">This may take 10–20seconds…</p>
        )}
        </div>
     </DialogContent>
    </Dialog>


    {/* Regenerate All dialog */}
    <Dialog open={regenAllOpen} onOpenChange={(open) => { if (!regenAllRunning) setRegenAllOpen(open); }}>
     <DialogContent className="sm:max-w-sm">
      <DialogHeader>
       <DialogTitle className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-destructive" /> Regenerate All Questions
       </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
       {selectedGameId !== null && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
         This will <span className="font-semibold">permanently delete</span> all {rawQuestions.length} existing question{rawQuestions.length !== 1 ? "s" : ""} for{" "}
         <span className="font-medium text-foreground">
          {games.find((g) => g.id === selectedGameId)?.topic}
         </span>{" "}
         and replace them with new Gemini AI questions.
        </div>
       )}
       <div className="space-y-1.5">
        <Label>Number of new questions</Label>
        <Input
         type="number"
         min={1}
         max={20}
         value={regenAllCount}
         onChange={(e) => setRegenAllCount(Math.max(1, Math.min(20, Number(e.target.value))))}
         className="h-9"
        />
       </div>
       <div className="space-y-1.5">
        <Label>Difficulty</Label>
        <Select value={regenAllDiff} onValueChange={(v) => setRegenAllDiff(v as typeof regenAllDiff)}>
         <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
         <SelectContent>
          <SelectItem value="same">Same as game setting</SelectItem>
          <SelectItem value="easy">Easy</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="hard">Hard</SelectItem>
         </SelectContent>
        </Select>
       </div>
       <div className="space-y-1.5">
        <Label>Brief <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <Textarea
         value={regenAllBrief}
         onChange={(e) => setRegenAllBrief(e.target.value)}
         rows={4}
         maxLength={2000}
         placeholder="Add specific instructions for this regeneration run…"
         className="resize-none text-sm"
        />
       </div>
       <Button
        className="w-full"
        variant="destructive"
        onClick={handleRegenAll}
        disabled={regenAllRunning}
       >
        {regenAllRunning ? (
         <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Regenerating…</>
        ) : (
         <><RefreshCw className="mr-2 h-4 w-4" />Delete &amp; Regenerate {regenAllCount} Questions</>
        )}
       </Button>
       {regenAllRunning && (
        <p className="text-xs text-center text-muted-foreground">Deleting old questions then generating new ones… this may take 15–30 seconds.</p>
       )}
      </div>
     </DialogContent>
    </Dialog>


    {/* Edit dialog */}
    <Dialog
     open={editDialogOpen}
     onOpenChange={(open) => { setEditDialogOpen(open); if (!open)setEditingQuestion(null); }}
    >
     <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
        <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        {editingQuestion && (
        <QuestionForm
         key={editingQuestion.id}
                initial={formFromQuestion(editingQuestion)}
                pending={updateQuestion.isPending}
                submitLabel="Save changes"
                onSubmit={(form) => {
                 updateQuestion.mutate(
         { questionId: editingQuestion.id, data: buildPayload(form,editingQuestion.orderIndex) },
                     {
                         onSuccess: () => {
                          invalidate();
                          setEditDialogOpen(false);
                          setEditingQuestion(null);
                          toast({ title: "Question updated" });
                         },
                         onError: () => toast({ variant: "destructive", title: "Update failed" }),
                     },
                 );
                }}
            />
           )}
          </DialogContent>
          </Dialog>
      </>
     )}
 </div>
);
}


// ─── Results section ───────────────────────────────────────────────────────────


type LeaderboardEntry = {
    rank: number;
    userId: number;
    userName: string;
    totalScore: number;
    correctCount: number;
    totalAnswered: number;
};


type GameResultsData = {
    game: Game;
 participants: LeaderboardEntry[];
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
function AdminGate() {
    const [, setLocation] = useLocation();
    useEffect(() => { setLocation("/admin-login"); }, []);
    return null;
}
// ─── Export───────────────────────────────────────────────────────────────────


// ─── NEW COMPONENT CODE INJECTED HERE ───

// -----------------------------------------------------------------
// NEW DESIGN COMPONENTS
// -----------------------------------------------------------------

/** localStorage key prefix for the one-time "Host & play" live-screen banner (per game). */
const LIVE_BANNER_DISMISSED_KEY = "qt.liveBannerDismissed";

const AVATAR_COLORS: [string, string][] = [
  ["#ff0080", "#ffffff"], ["#00ddff", "#062430"], ["#ffe500", "#3a2f00"],
  ["#35d07f", "#08130c"], ["#a78bfa", "#1a0f3d"], ["#ff8a4c", "#2b1200"],
];

function LiveGameView({
  activeGame,
  endGame,
}: {
  activeGame?: Game;
  endGame: (id: number) => void;
}) {
  const queryClient = useQueryClient();

  // ── First-run reassurance banner (Host & play only, persisted per game) ──
  const liveBannerKey = activeGame ? `${LIVE_BANNER_DISMISSED_KEY}.${activeGame.id}` : null;
  const [liveBannerDismissedKeys, setLiveBannerDismissedKeys] = useState<Record<string, true>>({});
  const liveBannerDismissed =
    !liveBannerKey ||
    liveBannerDismissedKeys[liveBannerKey] === true ||
    (() => { try { return localStorage.getItem(liveBannerKey) === "1"; } catch { return true; } })();
  const dismissLiveBanner = () => {
    if (!liveBannerKey) return;
    setLiveBannerDismissedKeys((prev) => ({ ...prev, [liveBannerKey]: true }));
    try { localStorage.setItem(liveBannerKey, "1"); } catch { /* ignore */ }
  };

  // ── Player removal (kick) state ───────────────────────────────────────────
  const [kickTarget, setKickTarget] = useState<{ userId: number; userName: string } | null>(null);
  const [kicking, setKicking] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);

  const { data: qData } = useListGameQuestions(activeGame?.id ?? 0, {
    query: { enabled: !!activeGame, queryKey: getListGameQuestionsQueryKey(activeGame?.id ?? 0) },
  });
  const questions = qData ?? [];

  // Host monitors a question locally; there is no host-advance endpoint yet
  // (players drive their own pace) — Prev/Next just move the monitored question.
  const [qIndex, setQIndex] = useState(0);

  // Play-along: track answers the host has submitted for the current game.
  const [hostAnswers, setHostAnswers] = useState<Record<number, string>>({});
  const [hostAnswerInput, setHostAnswerInput] = useState('');
  const [submittingHostAnswer, setSubmittingHostAnswer] = useState(false);
  const [skipConfirmForQ, setSkipConfirmForQ] = useState<{ id: number; direction: 'prev' | 'next' } | null>(null);

  const submitHostAnswer = async (questionId: number, answer: string) => {
    if (!activeGame || submittingHostAnswer || hostAnswers[questionId] !== undefined) return;
    if (!answer.trim()) return;
    setSubmittingHostAnswer(true);
    try {
      const res = await fetch(`/api/games/${activeGame.id}/host-answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, userAnswer: answer }),
      });
      if (res.ok) {
        setHostAnswers((prev) => ({ ...prev, [questionId]: answer }));
        setHostAnswerInput('');
      } else if (res.status === 409) {
        // Answer already exists in DB (e.g. from a previous session).
        // Seed local state so the UI shows the answered state immediately.
        const body = await res.json().catch(() => ({}));
        if (body.existingAnswer !== undefined) {
          setHostAnswers((prev) => ({ ...prev, [questionId]: body.existingAnswer }));
          setHostAnswerInput('');
        }
      }
    } catch {
      // non-critical
    } finally {
      setSubmittingHostAnswer(false);
    }
  };

  // Record an explicit skip (empty answer = 0 pts) then navigate.
  const submitSkipAndNavigate = async (questionId: number, direction: 'prev' | 'next') => {
    setSkipConfirmForQ(null);
    if (activeGame) {
      try {
        const res = await fetch(`/api/games/${activeGame.id}/host-answer`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, userAnswer: '' }),
        });
        if (res.ok) setHostAnswers((prev) => ({ ...prev, [questionId]: '' }));
      } catch { /* non-critical */ }
    }
    if (direction === 'next') setQIndex((i) => Math.min(questions.length - 1, i + 1));
    else setQIndex((i) => Math.max(0, i - 1));
  };

  // Reset host answer input when the host moves to a different question.
  useEffect(() => {
    setHostAnswerInput('');
  }, [qIndex]);

  // Reset live telemetry whenever a different game goes live.
  useEffect(() => {
    setQIndex(0);
    resetTallyStore(tallyStore.current);
    setAnsweredBy({});
    setCorrectCount({});
    setHostAnswers({});
    setHostAnswerInput('');
  }, [activeGame?.id]);
  const currentQ = questions[Math.min(qIndex, Math.max(questions.length - 1, 0))];

  // Suppress correct-answer reveals until the host has submitted their own answer (play-along mode).
  // hostPlayingAndUnanswered gates every isCorrect-derived style on the current question.
  const hostAnsweredCurrent = currentQ !== undefined && hostAnswers[currentQ.id] !== undefined;
  const hostPlayingAndUnanswered = !!(activeGame?.hostPlaysAlong && currentQ && !hostAnsweredCurrent);

  const { data: parts = [], refetch: refetchParts } = useListGameParticipants(activeGame?.id ?? 0, {
    query: {
      enabled: !!activeGame,
      queryKey: getListGameParticipantsQueryKey(activeGame?.id ?? 0),
      refetchInterval: 10000,
    },
  });

  // Live answer tracking from the same socket events that power player GamePlay.
  // The synchronous TallyStore (in a ref) is the single source of truth: it
  // buffers pre-seed events, merges the persisted snapshot atomically, and
  // dedupes per player name — so events arriving during the seed→live
  // transition are never lost or double-counted. React state below is only a
  // render mirror of the store's snapshots.
  const tallyStore = useRef<TallyStore>(createTallyStore());
  const [answeredBy, setAnsweredBy] = useState<Record<number, string[]>>({});
  const [correctCount, setCorrectCount] = useState<Record<number, number>>({});
  const syncTallies = () => {
    setAnsweredBy({ ...tallyStore.current.answeredBy });
    setCorrectCount({ ...tallyStore.current.correctCount });
  };

  // Seed tallies from persisted answers so opening the Live view mid-game
  // shows correct totals immediately; socket events increment on top.
  const { data: seedStats } = useQuery<
    { id: number; correctCount: number; answeredBy?: string[] }[]
  >({
    queryKey: ["live-view-seed-stats", activeGame?.id],
    queryFn: async () => {
      const res = await fetch(`/api/games/${activeGame!.id}/questions/stats`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("stats");
      return res.json();
    },
    enabled: !!activeGame,
    staleTime: Infinity, // seed once per game; socket events keep it live
  });

  // Apply the persisted snapshot: applySeed merges baseline + buffered events
  // (name-deduped) and switches the store to live synchronously, so a socket
  // event arriving right after — even before React commits — hits the merged
  // baseline instead of a stale buffer. Idempotent once live.
  useEffect(() => {
    if (!seedStats || !activeGame) return;
    if (applySeed(tallyStore.current, seedStats)) syncTallies();
  }, [seedStats, activeGame]);

  useGameSocket(activeGame?.id ?? null, {
    onAnswerSubmitted: (p) => {
      // Synchronous, name-deduped store update: buffers while awaiting the
      // seed, otherwise applies against the merged baseline. Duplicate events
      // can never double-count, even before a render commits.
      if (recordAnswerEvent(tallyStore.current, p.questionId, p.playerName, p.isCorrect)) {
        syncTallies();
      }
      refetchParts();
    },
    onGameEnded: () => {
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
    },
  });

  // handleKick is declared after refetchParts (declared above via useListGameParticipants).
  const handleKick = async () => {
    if (!kickTarget || !activeGame) return;
    setKicking(true);
    setKickError(null);
    try {
      const r = await fetch(`/api/games/${activeGame.id}/participants/${kickTarget.userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const data: unknown = await r.json().catch(() => null);
        const msg = data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : COPY.kick.removeError;
        setKickError(msg);
        return;
      }
      setKickTarget(null);
      refetchParts();
    } catch {
      setKickError(COPY.kick.removeError);
    } finally {
      setKicking(false);
    }
  };

  const sortedParticipants = [...parts].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)).slice(0, 6);

  if (!activeGame) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Radio className="h-16 w-16 text-[#66728a] mb-4" />
        <h2 className="text-xl font-bold text-[#eef2f8] mb-2">No game is live right now</h2>
        <p className="text-[#9aa6bc] mb-6">Go to Games to launch one</p>
      </div>
    );
  }

  const answeredNames = currentQ ? (answeredBy[currentQ.id] ?? []) : [];
  const answeredCount = answeredNames.length;
  const answeredPct = parts.length > 0 ? Math.round((answeredCount / parts.length) * 100) : 0;
  const qCorrect = currentQ ? (correctCount[currentQ.id] ?? 0) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* ── Kick confirmation overlay ── */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060d17]/90 backdrop-blur-sm">
          <div className="max-w-[300px] w-full mx-4 bg-[#0f1724] border border-[#ff6b6b]/40 rounded-2xl p-6 space-y-4">
            <p className="text-[14px] font-bold text-[#eef2f8]">{COPY.kick.confirmTitle}</p>
            <p className="text-[13px] text-[#9aa6bc] leading-relaxed">
              <span className="font-bold text-[#eef2f8]">{kickTarget.userName}</span>{" "}
              {COPY.kick.confirmBody}
            </p>
            {kickError && <p className="text-[11px] text-[#ff6b6b]">{kickError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setKickTarget(null); setKickError(null); }}
                disabled={kicking}
                className="flex-1 py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:brightness-110 transition disabled:opacity-50"
              >
                {COPY.kick.confirmCancel}
              </button>
              <button
                onClick={handleKick}
                disabled={kicking}
                className="flex-1 py-2.5 rounded-xl bg-[#ff6b6b]/20 border border-[#ff6b6b]/40 text-sm font-bold text-[#ff6b6b] hover:brightness-110 transition disabled:opacity-50"
              >
                {kicking ? "…" : COPY.kick.confirmRemove}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar: LIVE badge · title · room chip · players · end ── */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-[#16223a]">
        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-[#ff0080]/15 border border-[#ff0080]/40">
          <span className="h-[7px] w-[7px] rounded-full bg-[#ff0080] animate-pulse" />
          <span className="text-[9px] font-extrabold tracking-[.16em] text-[#ff5aa8]">LIVE NOW</span>
        </div>
        <h1 className="text-lg font-extrabold text-[#eef2f8] truncate">{activeGame.topic}</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs font-semibold text-[#9aa6bc]">
            <span className="text-[#eef2f8] font-extrabold">{parts.length}</span> players
          </div>
          <button
            onClick={() => endGame(activeGame.id)}
            className="text-xs font-bold text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 rounded-lg px-3.5 py-2 hover:brightness-110 transition"
          >
            End game
          </button>
        </div>
      </div>

      {/* ── First-run reassurance banner (Host & play only) ── */}
      {activeGame.hostPlaysAlong && !liveBannerDismissed && (
        <div
          className="flex items-center gap-3 rounded-[14px] border border-[rgba(245,19,140,0.4)] px-4 py-[15px]"
          style={{ background: "linear-gradient(90deg, rgba(245,19,140,0.16), rgba(25,210,237,0.10))" }}
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[rgba(245,19,140,0.25)]">
            <Info className="h-4 w-4 text-[#f5138c]" />
          </span>
          <p className="flex-1 text-[15px] font-semibold text-white">{COPY.liveBanner.text}</p>
          <button
            type="button"
            onClick={dismissLiveBanner}
            aria-label="Dismiss"
            className="text-[19px] leading-none text-[#8b93a4] hover:text-white transition"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── LEFT: question card + transport ── */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-bold tracking-[.22em] text-[#66728a]">
                QUESTION {questions.length ? qIndex + 1 : 0} / {questions.length || "?"}
              </span>
              {currentQ?.questionType && (
                <span className="px-2 py-[3px] rounded-md bg-[#00ddff]/10 border border-[#00ddff]/25 text-[9px] font-bold tracking-[.1em] text-[#5be9ff] uppercase">
                  {currentQ.questionType}
                </span>
              )}
              {currentQ?.points != null && (
                <span className="px-2 py-[3px] rounded-md bg-[#ffe500]/10 border border-[#ffe500]/25 text-[9px] font-bold tracking-[.1em] text-[#ffe500]">
                  {currentQ.points} PTS
                </span>
              )}
              <div
                className="ml-auto w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0"
                style={{ background: `conic-gradient(#00ddff 0% ${answeredPct}%, rgba(255,255,255,.08) ${answeredPct}% 100%)` }}
                title={`${answeredCount} of ${parts.length} answered`}
              >
                <div className="w-10 h-10 rounded-full bg-[#0f1724] flex items-center justify-center font-mono text-[13px] font-extrabold text-[#eef2f8]">
                  {answeredPct}%
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-[#eef2f8] leading-snug my-5 tracking-tight">
              {currentQ?.questionText || "Waiting for game to start…"}
            </h2>

            {/* YOUR ANSWER label — only when host is playing along and hasn't answered an MC question yet */}
            {hostPlayingAndUnanswered && !!((currentQ?.options as any)?.choices?.length) && (
              <p className="text-[10px] font-bold tracking-[.15em] text-[#66728a] mb-1.5">{COPY.hostPlayAlong.yourAnswerPrompt}</p>
            )}
            <div className="space-y-2.5">
              {(currentQ?.options as any)?.choices?.map((c: string, i: number) => {
                // Suppress correct-answer highlight until host has answered (play-along).
                // When hostPlayingAndUnanswered is true, isCorrect is forced false so no
                // green row, badge, tally bar, count, or ✓ can leak the answer.
                const isCorrect = !hostPlayingAndUnanswered && currentQ.correctAnswer === c;
                // We only know correct-vs-wrong from the socket, not which wrong
                // option was picked — so only the correct row shows a live tally.
                const tallyPct = isCorrect && parts.length > 0 ? Math.round((qCorrect / parts.length) * 100) : 0;
                const hostPicked = activeGame.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === c;
                const hostAnswered = activeGame.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] !== undefined;
                const canPick = activeGame.hostPlaysAlong && currentQ && !hostAnswered && !submittingHostAnswer;
                return (
                  <div
                    key={i}
                    role={canPick ? "button" : undefined}
                    tabIndex={canPick ? 0 : undefined}
                    onClick={canPick ? () => submitHostAnswer(currentQ.id, c) : undefined}
                    onKeyDown={canPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') submitHostAnswer(currentQ.id, c); } : undefined}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      isCorrect ? "border-[#35d07f]/50 bg-[#35d07f]/10" :
                      hostPicked ? "border-[#ff0080]/50 bg-[#ff0080]/10" :
                      "border-[#1b2740] bg-white/[.03]"
                    } ${canPick ? "cursor-pointer hover:brightness-125 hover:border-[#00ddff]/40" : ""}`}
                  >
                    <span
                      className={`w-[27px] h-[27px] shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        isCorrect ? "bg-[#35d07f] text-[#08130c]" :
                        hostPicked ? "bg-[#ff0080] text-white" :
                        "border-[1.5px] border-[#3a4a63] text-[#9aa6bc]"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className={`flex-1 text-[15px] ${isCorrect ? "font-bold text-[#eef2f8]" : hostPicked ? "font-bold text-[#eef2f8]" : "font-semibold text-[#c9d1e0]"}`}>
                      {c}
                    </span>
                    {hostPicked && !isCorrect && (
                      <span className="text-[11px] font-bold text-[#ff5aa8]">Your pick</span>
                    )}
                    {isCorrect && (
                      <>
                        <div className="hidden sm:block w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-[#35d07f]" style={{ width: `${tallyPct}%` }} />
                        </div>
                        <span className="font-mono text-[13px] font-extrabold text-[#35d07f] tabular-nums">{qCorrect}</span>
                        <span className="text-[#35d07f]">✓</span>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Skip button — shown below MC choices when host is playing along and hasn't answered yet */}
              {hostPlayingAndUnanswered && !!((currentQ?.options as any)?.choices?.length) && (
                <button
                  onClick={() => setSkipConfirmForQ({ id: currentQ!.id, direction: 'next' })}
                  className="w-full text-center text-xs font-semibold text-[#66728a] hover:text-[#9aa6bc] pt-1 pb-0.5 transition"
                >
                  {COPY.hostPlayAlong.skipBtn}
                </button>
              )}

              {/* Play-along answer section for non-MC question types */}
              {activeGame.hostPlaysAlong && currentQ && (() => {
                const hasChoices = !!((currentQ.options as any)?.choices?.length);
                if (hasChoices) return null;
                const hostAnswered = hostAnswers[currentQ.id] !== undefined;
                if (hostAnswered) {
                  const ans = hostAnswers[currentQ.id];
                  if (ans === '') {
                    return (
                      <div className="mt-3 pt-3 border-t border-[#1b2740] flex items-center gap-2">
                        <span className="text-[11px] font-bold tracking-wide text-[#66728a]">— Not answered · 0 pts</span>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3 pt-3 border-t border-[#1b2740] flex items-center gap-2">
                      <span className="text-[11px] font-bold tracking-wide text-[#35d07f]">✓ YOUR ANSWER</span>
                      <span className="text-sm text-[#eef2f8]">{ans}</span>
                    </div>
                  );
                }
                // True / False shortcut buttons
                if (currentQ.questionType === 'true_false') {
                  return (
                    <div className="mt-3 pt-3 border-t border-[#1b2740]">
                      <p className="text-[10px] font-bold tracking-[.15em] text-[#66728a] mb-2">YOUR ANSWER</p>
                      <div className="flex gap-2">
                        {['True', 'False'].map((opt) => (
                          <button
                            key={opt}
                            disabled={submittingHostAnswer}
                            onClick={() => submitHostAnswer(currentQ.id, opt.toLowerCase())}
                            className="flex-1 py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:border-[#00ddff]/50 hover:bg-[#00ddff]/10 hover:text-[#eef2f8] disabled:opacity-40 transition"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setSkipConfirmForQ({ id: currentQ.id, direction: 'next' })}
                        className="mt-2 w-full text-center text-xs font-semibold text-[#66728a] hover:text-[#9aa6bc] py-1 transition"
                      >
                        {COPY.hostPlayAlong.skipBtn}
                      </button>
                    </div>
                  );
                }
                // Write-in / short response
                return (
                  <div className="mt-3 pt-3 border-t border-[#1b2740]">
                    <p className="text-[10px] font-bold tracking-[.15em] text-[#66728a] mb-2">YOUR ANSWER</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hostAnswerInput}
                        onChange={(e) => setHostAnswerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitHostAnswer(currentQ.id, hostAnswerInput); }}
                        placeholder="Type your answer…"
                        disabled={submittingHostAnswer}
                        className="flex-1 bg-[#0a1628] border border-[#1b2740] rounded-xl px-3 py-2 text-sm text-[#eef2f8] placeholder:text-[#3a4a63] focus:outline-none focus:border-[#00ddff]/50 disabled:opacity-40"
                      />
                      <button
                        onClick={() => submitHostAnswer(currentQ.id, hostAnswerInput)}
                        disabled={!hostAnswerInput.trim() || submittingHostAnswer}
                        className="px-4 py-2 rounded-xl bg-[#00ddff]/15 border border-[#00ddff]/30 text-[#5be9ff] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition"
                      >
                        Submit
                      </button>
                    </div>
                    <button
                      onClick={() => setSkipConfirmForQ({ id: currentQ.id, direction: 'next' })}
                      className="mt-2 w-full text-center text-xs font-semibold text-[#66728a] hover:text-[#9aa6bc] py-1 transition"
                    >
                      {COPY.hostPlayAlong.skipBtn}
                    </button>
                  </div>
                );
              })()}

              {/* Unanswered reminder — visible when host plays along but hasn't answered yet */}
              {activeGame.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ffe500]/80 pt-1">
                  <span>⚠</span>
                  <span>{COPY.hostPlayAlong.unansweredBadge}</span>
                </div>
              )}
            </div>
          </div>

          {/* transport bar */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0f1724] border border-[#1b2740] rounded-2xl px-3.5 py-3">
            <button
              disabled={qIndex === 0}
              onClick={() => {
                if (activeGame?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined) {
                  setSkipConfirmForQ({ id: currentQ.id, direction: 'prev' });
                } else {
                  setQIndex((i) => Math.max(0, i - 1));
                }
              }}
              className="text-xs font-bold text-[#9aa6bc] bg-white/[.04] border border-[#1b2740] rounded-[10px] px-3.5 py-2.5 disabled:opacity-40 hover:brightness-110 transition"
            >
              ‹ Prev
            </button>
            {/* TODO: pause / reveal / lock need host-control endpoints — not in the API yet */}
            <button disabled title="Coming soon — needs a host-control endpoint" className="text-xs font-bold text-[#ffe500] bg-[#ffe500]/10 border border-[#ffe500]/30 rounded-[10px] px-3.5 py-2.5 opacity-50 cursor-not-allowed">
              ⏸ Pause timer
            </button>
            <button disabled title="Coming soon — needs a host-control endpoint" className="text-xs font-bold text-[#00ddff] bg-[#00ddff]/10 border border-[#00ddff]/30 rounded-[10px] px-3.5 py-2.5 opacity-50 cursor-not-allowed">
              ◎ Reveal answer
            </button>
            <button disabled title="Coming soon — needs a host-control endpoint" className="text-xs font-bold text-[#9aa6bc] bg-white/[.04] border border-[#1b2740] rounded-[10px] px-3.5 py-2.5 opacity-50 cursor-not-allowed">
              🔒 Lock
            </button>
            <button
              disabled={qIndex >= questions.length - 1}
              onClick={() => {
                if (activeGame?.hostPlaysAlong && currentQ && hostAnswers[currentQ.id] === undefined) {
                  setSkipConfirmForQ({ id: currentQ.id, direction: 'next' });
                } else {
                  setQIndex((i) => Math.min(questions.length - 1, i + 1));
                }
              }}
              className="ml-auto text-[13px] font-extrabold text-[#08130c] bg-[#ff0080] rounded-[10px] px-5 py-3 shadow-[0_8px_22px_-6px_rgba(255,0,128,.6)] disabled:opacity-40 hover:brightness-110 transition"
            >
              Next question ›
            </button>
          </div>
        </div>

        {/* Skip-question confirmation overlay */}
        {skipConfirmForQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSkipConfirmForQ(null)} />
            <div className="relative bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#ffe500] text-lg">⚠</span>
                <span className="font-extrabold text-[#eef2f8] text-base">{COPY.hostPlayAlong.skipDialogTitle}</span>
              </div>
              <p className="text-sm text-[#9aa6bc] leading-relaxed mb-5">
                {COPY.hostPlayAlong.skipDialogBody}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSkipConfirmForQ(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:brightness-110 transition"
                >
                  {COPY.hostPlayAlong.skipDialogGoBack}
                </button>
                <button
                  onClick={() => submitSkipAndNavigate(skipConfirmForQ.id, skipConfirmForQ.direction)}
                  className="flex-1 py-2.5 rounded-xl bg-[#ffe500]/20 border border-[#ffe500]/40 text-sm font-bold text-[#ffe500] hover:brightness-110 transition"
                >
                  {COPY.hostPlayAlong.skipDialogSkip}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT: answered + standings ── */}
        <div className="w-full lg:w-[300px] shrink-0 space-y-4">
          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[.16em] text-[#66728a]">ANSWERED</span>
              <span className="font-mono text-[15px] font-extrabold text-[#eef2f8] tabular-nums">
                <span className="text-[#35d07f]">{answeredCount}</span> / {parts.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3.5">
              <div className="h-full rounded-full bg-[#35d07f] transition-all" style={{ width: `${answeredPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parts.length === 0 && <p className="text-sm text-[#66728a] py-2">No players yet</p>}
              {parts.map((p, idx) => {
                const done = answeredNames.includes(p.userName);
                const [av, avtx] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <button
                    key={p.id}
                    onClick={() => setKickTarget({ userId: p.userId, userName: p.userName })}
                    title={`Remove ${p.userName}`}
                    className={`group flex items-center gap-1.5 pl-1.5 pr-2 py-[5px] rounded-full border transition cursor-pointer ${
                      done ? "bg-[#35d07f]/10 border-[#35d07f]/30 hover:border-[#ff6b6b]/50 hover:bg-[#ff6b6b]/10" : "bg-white/[.02] border-[#1b2740] opacity-50 hover:opacity-80 hover:border-[#ff6b6b]/40"
                    }`}
                  >
                    <span
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-extrabold"
                      style={done ? { background: av, color: avtx } : { background: "#2a3a52", color: "#8a97ad" }}
                    >
                      {p.userName.substring(0, 1).toUpperCase()}
                    </span>
                    <span className={`text-[11px] font-semibold ${done ? "text-[#dfe5f0]" : "text-[#8a97ad]"}`}>
                      {p.userName}
                    </span>
                    <span className="text-[10px] text-[#ff6b6b]/0 group-hover:text-[#ff6b6b]/70 transition font-bold leading-none">×</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-[10px] font-bold tracking-[.16em] text-[#66728a]">STANDINGS</span>
              <span className="text-[10px] font-semibold text-[#66728a]">top 6</span>
            </div>
            <div className="space-y-0.5">
              {sortedParticipants.length === 0 && (
                <p className="text-sm text-[#66728a] text-center py-4">No players yet</p>
              )}
              {sortedParticipants.map((p, i) => {
                const [av, avtx] = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const win = i === 0;
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-1.5 py-2 rounded-lg ${win ? "bg-[#ff0080]/[.08]" : ""}`}>
                    <span className={`w-4 text-center font-mono text-xs font-extrabold ${win ? "text-[#ff5aa8]" : "text-[#66728a]"}`}>
                      {i + 1}
                    </span>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                      style={{ background: av, color: avtx }}
                    >
                      {p.userName.substring(0, 1).toUpperCase()}
                    </span>
                    <span className={`flex-1 truncate text-[13px] font-bold ${win ? "text-[#eef2f8]" : "text-[#dfe5f0]"}`}>
                      {p.userName}
                    </span>
                    <span className={`font-mono text-[13px] tabular-nums ${win ? "font-extrabold text-[#eef2f8]" : "font-bold text-[#9aa6bc]"}`}>
                      {p.totalScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GamesView({
  games,
  onNavigate,
}: {
  games: Game[];
  onNavigate: (section: Section, gameId?: number) => void;
}) {
  const [filter, setFilter] = useState<"all"|"live"|"drafts">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateGame = useUpdateGame();
  const deleteGame = useDeleteGame();
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirmStartGame, setConfirmStartGame] = useState<Game | null>(null);
  const [playAlong, setPlayAlong] = useState(false);

  const startEditCode = (game: Game) => {
    setEditingCodeId(game.id);
    setCodeDraft(game.accessCode ?? "");
  };

  const startEditName = (game: Game) => {
    setEditingNameId(game.id);
    setNameDraft(game.topic);
    setNameError("");
  };

  const saveName = (game: Game) => {
    const name = nameDraft.trim();
    if (!name) {
      setNameError("Name cannot be empty");
      return;
    }
    if (name === game.topic) { setEditingNameId(null); return; }
    updateGame.mutate(
      { gameId: game.id, data: { topic: name } },
      {
        onSuccess: () => {
          setEditingNameId(null);
          invalidate();
          toast({ title: `Quiz renamed to "${name}"` });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to rename quiz";
          toast({ variant: "destructive", title: msg });
        },
      }
    );
  };

  const saveCode = (game: Game) => {
    const code = codeDraft.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) {
      toast({ variant: "destructive", title: "Room codes must be 4–12 letters or numbers" });
      return;
    }
    if (code === (game.accessCode ?? "")) { setEditingCodeId(null); return; }
    updateGame.mutate(
      { gameId: game.id, data: { accessCode: code } },
      {
        onSuccess: () => {
          setEditingCodeId(null);
          invalidate();
          toast({ title: `Room code updated to ${code}` });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to update room code";
          toast({ variant: "destructive", title: msg });
        },
      }
    );
  };

  const copyCode = async (game: Game) => {
    if (!game.accessCode) return;
    try {
      await navigator.clipboard.writeText(game.accessCode);
      setCopiedCodeId(game.id);
      setTimeout(() => setCopiedCodeId((id) => (id === game.id ? null : id)), 1500);
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy code" });
    }
  };

  const handleDelete = (game: Game) => {
    if (!window.confirm(`Delete "${game.topic}" and all its questions? This can't be undone.`)) return;
    deleteGame.mutate(
      { gameId: game.id },
      {
        onSuccess: () => { invalidate(); toast({ title: `Deleted "${game.topic}"` }); },
        onError: () => toast({ variant: "destructive", title: "Failed to delete game" }),
      }
    );
  };
  
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
  };

  const handleGoLive = (game: Game) => {
    setConfirmStartGame(game);
    setPlayAlong(false);
  };

  const doGoLive = () => {
    if (!confirmStartGame) return;
    const game = confirmStartGame;
    updateGame.mutate(
      { gameId: game.id, data: { status: "active", hostPlaysAlong: playAlong } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `"${game.topic}" is now live!` });
          setConfirmStartGame(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to start" }),
      }
    );
  };

  const filteredGames = games.filter(g => {
    if (filter === "live") return g.status === "active";
    if (filter === "drafts") return g.status === "waiting";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-white">Your games</h1>
          <span className="bg-[#1b2740] text-[#9aa6bc] px-3 py-1 rounded-full text-sm font-bold">{games.length}</span>
        </div>
        <Button className="bg-[#ff0080] hover:bg-[#ff0080]/90 text-white rounded-xl" onClick={() => onNavigate("build")}>
          <Plus className="w-4 h-4 mr-2" /> New game
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#1b2740] pb-px">
        {([{ id: "all", label: COPY.admin.filterAll }, { id: "live", label: "Live" }, { id: "drafts", label: "Drafts" }] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
              filter === f.id
                ? 'border-[#ff0080] text-white' 
                : 'border-transparent text-[#66728a] hover:text-[#9aa6bc]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* New Quiz Tile */}
        <button
          onClick={() => onNavigate("build")}
          className="border-2 border-dashed border-[#1b2740] rounded-2xl flex flex-col items-center justify-center p-8 text-[#66728a] hover:text-white hover:border-[#66728a] transition-all bg-[#0a1019]/50 hover:bg-[#0f1724]"
        >
          <div className="w-12 h-12 rounded-full bg-[#1b2740] flex items-center justify-center mb-4">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-bold">Create new game</span>
        </button>

        {filteredGames.map(game => {
          const isLive = game.status === "active";
          const isDraft = game.status === "waiting";
          const isCompleted = game.status === "completed";

          return (
            <div 
              key={game.id} 
              className={`rounded-2xl p-5 flex flex-col ${
                isLive 
                  ? 'bg-[#0f1724] border border-[#ff0080]/50 ring-1 ring-[#ff0080]/20' 
                  : isCompleted
                  ? 'bg-[#0a1019] border border-[#1b2740] opacity-75'
                  : 'bg-[#0f1724] border border-[#1b2740]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                {isLive && (
                  <div className="flex items-center gap-1.5 bg-[#ff0080]/10 text-[#ff0080] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff0080] animate-pulse" /> LIVE
                  </div>
                )}
                {isDraft && <div className="bg-[#1b2740] text-[#9aa6bc] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">DRAFT</div>}
                {isCompleted && <div className="bg-[#1b2740]/50 text-[#66728a] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">COMPLETED</div>}
                

              </div>
              
              {editingNameId === game.id ? (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={nameDraft}
                      onChange={(e) => { setNameDraft(e.target.value); setNameError(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName(game);
                        if (e.key === "Escape") setEditingNameId(null);
                      }}
                      autoFocus
                      disabled={updateGame.isPending}
                      className="h-8 flex-1 text-sm font-bold bg-[#0a1019] border-[#1b2740] text-white"
                      aria-label="Quiz name"
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0 bg-[#35d07f] hover:bg-[#35d07f]/90 text-black"
                      aria-label="Save quiz name"
                      disabled={updateGame.isPending}
                      onClick={() => saveName(game)}
                    >
                      {updateGame.isPending ? <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0 border-[#1b2740] bg-[#0a1019] text-[#9aa6bc] hover:bg-[#1b2740]"
                      aria-label="Cancel renaming"
                      disabled={updateGame.isPending}
                      onClick={() => setEditingNameId(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {nameError && <p className="text-xs text-[#ff6b6b] mt-1">{nameError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-1 group">
                  <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight">{game.topic}</h3>
                  {!isLive && (
                    <button
                      onClick={() => startEditName(game)}
                      className="text-[#66728a] hover:text-white transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
                      aria-label="Rename quiz"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-[#9aa6bc] text-sm mb-1">
                {game.questionCount} {game.questionCount === 1 ? 'question' : 'questions'}
              </p>
              <div className="flex items-center gap-3 mb-3" style={{ color: "#66728a", fontSize: 12, fontWeight: 600 }}>
                <span>{(game as any).participantCount ?? 0} players</span>
                <span>·</span>
                <span>{game.difficulty ? game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1) : '—'}</span>
              </div>

              <div className="mb-6 flex-1">
                  {editingCodeId === game.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={codeDraft}
                        onChange={(e) => setCodeDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCode(game);
                          if (e.key === "Escape") setEditingCodeId(null);
                        }}
                        autoFocus
                        className="h-8 flex-1 font-mono text-sm tracking-widest bg-[#0a1019] border-[#1b2740] text-white"
                        aria-label="Room code"
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8 shrink-0 bg-[#35d07f] hover:bg-[#35d07f]/90 text-black"
                        aria-label="Save room code"
                        disabled={updateGame.isPending}
                        onClick={() => saveCode(game)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0 border-[#1b2740] bg-[#0a1019] text-[#9aa6bc] hover:bg-[#1b2740]"
                        aria-label="Cancel editing room code"
                        onClick={() => setEditingCodeId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : game.accessCode != null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-wider text-[#66728a]">CODE</span>
                      <button
                        onClick={() => copyCode(game)}
                        className="font-mono text-sm tracking-widest text-[#eef2f8] bg-[#0a1019] border border-[#1b2740] rounded-md px-2 py-0.5 hover:border-[#66728a] transition-colors inline-flex items-center gap-1.5"
                        aria-label="Copy room code"
                      >
                        {game.accessCode}
                        {copiedCodeId === game.id
                          ? <Check className="w-3 h-3 text-[#35d07f]" />
                          : <Copy className="w-3 h-3 text-[#66728a]" />}
                      </button>
                      <button
                        onClick={() => startEditCode(game)}
                        className="text-[#66728a] hover:text-white transition-colors p-1"
                        aria-label="Edit room code"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditCode(game)}
                      className="text-xs font-bold text-[#9aa6bc] hover:text-white transition-colors inline-flex items-center gap-1.5 border border-dashed border-[#1b2740] rounded-md px-2 py-1"
                    >
                      <Pencil className="w-3 h-3" /> Set room code
                    </button>
                  )}
                </div>

              <div className="mt-auto">
                {isLive && (
                  <Button className="w-full bg-[#ff0080] hover:bg-[#ff0080]/90 text-white" onClick={() => onNavigate("live", game.id)}>
                    Open live control <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                {isDraft && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-[#1b2740] bg-[#0a1019] text-[#eef2f8] hover:bg-[#1b2740]" onClick={() => onNavigate("build", game.id)}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button className="flex-1 bg-[#35d07f] hover:bg-[#35d07f]/90 text-black font-bold" onClick={() => handleGoLive(game)} disabled={game.questionCount === 0}>
                      <Play className="w-4 h-4 mr-2" /> Go Live
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Delete game" className="shrink-0 border-[#1b2740] bg-[#0a1019] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]" onClick={() => handleDelete(game)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {isCompleted && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-[#1b2740] bg-[#0a1019] text-[#eef2f8] hover:bg-[#1b2740]" onClick={() => onNavigate("results", game.id)}>
                      <BarChart3 className="w-4 h-4 mr-2" /> Results
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Delete game" className="shrink-0 border-[#1b2740] bg-[#0a1019] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]" onClick={() => handleDelete(game)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Ready to go live? dialog ── */}
      {confirmStartGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmStartGame(null)} />
          <div className="relative bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Play className="h-5 w-5 text-[#ff0080]" />
              <span className="font-extrabold text-[#eef2f8] text-base">Ready to go live?</span>
            </div>
            <p className="text-sm text-[#9aa6bc] mb-4">
              <span className="font-semibold text-[#eef2f8]">"{confirmStartGame.topic}"</span> will be visible to players immediately.
            </p>

            {/* Play along toggle */}
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1b2740] bg-white/[.02] px-4 py-3 hover:bg-white/[.04] transition mb-5">
              <input
                type="checkbox"
                checked={playAlong}
                onChange={(e) => setPlayAlong(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#ff0080] cursor-pointer"
              />
              <span>
                <span className="block text-sm font-semibold text-[#eef2f8]">{COPY.hostPlayAlong.playAlongLabel}</span>
                <span className="block text-xs text-[#9aa6bc] mt-0.5">
                  {COPY.hostPlayAlong.playAlongDesc}
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStartGame(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#1b2740] text-sm font-semibold text-[#9aa6bc] hover:brightness-110 transition"
              >
                Cancel
              </button>
              <button
                onClick={doGoLive}
                disabled={updateGame.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#35d07f] text-black text-sm font-extrabold disabled:opacity-50 hover:brightness-110 transition"
              >
                <Play className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                Go live now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BuildQuizView({
  games,
  preferGameId,
  onNavigate
}: {
  games: Game[];
  preferGameId?: number;
  onNavigate: (section: Section, gameId?: number) => void;
}) {
  const [subTab, setSubTab] = useState<"setup"|"questions"|"review">("setup");

  useEffect(() => {
    if (preferGameId) setSubTab("questions");
  }, [preferGameId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-[#0a1019] p-1.5 rounded-xl border border-[#1b2740]">
        {["setup", "questions", "review"].map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t as any)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold capitalize transition-all ${
              subTab === t
                ? 'bg-[#1b2740] text-white shadow-sm'
                : 'text-[#66728a] hover:text-[#9aa6bc]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6">
        {subTab === "setup" && (
          <CreateGameSection
            onCreated={(g) => { setSubTab("questions"); onNavigate("build", g.id); }}
            onGoLive={() => onNavigate("live")}
          />
        )}
        {subTab === "questions" && (
          <QuestionsSection games={games} preferGameId={preferGameId} />
        )}
        {subTab === "review" && (
          <ReviewSection games={games} />
        )}
      </div>
    </div>
  );
}

function NewResultsSection({ games, preferredGameId }: { games: Game[]; preferredGameId?: number }) {
  const completedGames = [...games.filter((g) => g.status === "completed")]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const [resultsView, setResultsView] = useState<"list" | "detail">(
    preferredGameId !== undefined ? "detail" : "list"
  );
  const [selectedGameId, setSelectedGameId] = useState<number | null>(
    preferredGameId ?? null
  );

  // React when the parent changes preferredGameId (e.g. Games tab "Results" shortcut)
  useEffect(() => {
    if (preferredGameId !== undefined) {
      setSelectedGameId(preferredGameId);
      setResultsView("detail");
    }
  }, [preferredGameId]);

  const { data: resultsData, isLoading: loadingResults } = useQuery<GameResultsData>({
    queryKey: ["admin-results", selectedGameId],
    queryFn: async () => {
      const res = await fetch(`/api/games/${selectedGameId}/results`);
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: selectedGameId !== null,
  });

  const { data: questionStats = [] } = useQuery<QuestionStat[]>({
    queryKey: ["admin-question-stats", selectedGameId],
    queryFn: async () => {
      const res = await fetch(`/api/games/${selectedGameId}/questions/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: selectedGameId !== null,
  });

  if (completedGames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <BarChart3 className="h-16 w-16 text-[#66728a] mb-4" />
        <h2 className="text-xl font-bold text-[#eef2f8] mb-2">No completed games yet</h2>
        <p className="text-[#9aa6bc]">Finish a game to see final results here.</p>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (resultsView === "list") {
    const totalPlayerSessions = completedGames.reduce((s, g) => s + ((g as any).participantCount ?? 0), 0);
    const totalQuestions = completedGames.reduce((s, g) => s + ((g as any).questionCount ?? 0), 0);

    const formatDate = (iso?: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    };

    return (
      <div className="space-y-5">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: completedGames.length, l: "GAMES", c: "#ff5aa8" },
            { v: totalPlayerSessions, l: "PLAYER SESSIONS", c: "#00ddff" },
            { v: totalQuestions, l: "QUESTIONS ASKED", c: "#35d07f" },
          ].map((t) => (
            <div key={t.l} className="bg-[#0f1724] border border-[#1b2740] rounded-[14px] p-4">
              <div className="font-mono text-[26px] font-extrabold tabular-nums" style={{ color: t.c }}>{t.v}</div>
              <div className="text-[10px] font-semibold tracking-[.12em] text-[#66728a] mt-0.5">{t.l}</div>
            </div>
          ))}
        </div>

        {/* Game cards */}
        <div className="space-y-2">
          {completedGames.map((game) => {
            const date = formatDate((game as any).createdAt);
            const players = (game as any).participantCount ?? 0;
            const qCount = (game as any).questionCount ?? 0;
            return (
              <button
                key={game.id}
                onClick={() => { setSelectedGameId(game.id); setResultsView("detail"); }}
                className="w-full flex items-center gap-4 bg-[#0f1724] border border-[#1b2740] rounded-2xl px-5 py-4 hover:border-[#2d4060] hover:bg-[#111d2e] transition text-left"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#ff5aa8" + "20" }}>
                  <Trophy className="h-5 w-5 text-[#ff5aa8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-[#eef2f8] truncate">{game.topic}</div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {date && (
                      <span className="flex items-center gap-1 text-[12px] text-[#66728a]">
                        <Calendar className="h-3 w-3" />{date}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[12px] text-[#66728a]">
                      <Users className="h-3 w-3" />{players} {players === 1 ? "player" : "players"}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-[#66728a]">
                      <HelpCircle className="h-3 w-3" />{qCount} {qCount === 1 ? "question" : "questions"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#66728a] shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  const participants = resultsData?.participants ?? [];
  const totalQ = resultsData?.totalQuestions ?? 0;
  const avgScore = participants.length
    ? Math.round(participants.reduce((s, p) => s + p.totalScore, 0) / participants.length)
    : 0;
  const avgCorrect = (() => {
    const answered = participants.filter((p) => p.totalAnswered > 0);
    if (!answered.length) return null;
    const pct = answered.reduce((s, p) => s + p.correctCount / p.totalAnswered, 0) / answered.length;
    return Math.round(pct * 100);
  })();
  const hardest = [...questionStats]
    .filter((q) => q.percentCorrect !== null)
    .sort((a, b) => (a.percentCorrect ?? 0) - (b.percentCorrect ?? 0))
    .slice(0, 5);
  const pctColor = (pct: number) => (pct < 45 ? "#ff5aa8" : pct < 65 ? "#ffe500" : "#35d07f");

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-[#16223a]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setResultsView("list")}
            className="flex items-center gap-1.5 text-xs font-bold text-[#66728a] hover:text-[#c9d1e0] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            All results
          </button>
          <div className="w-px h-4 bg-[#1b2740]" />
          <div>
            <div className="text-[10px] font-bold tracking-[.24em] text-[#66728a] mb-1">FINAL RESULTS</div>
            <div className="text-[22px] font-extrabold text-[#eef2f8]">{resultsData?.game.topic ?? "…"}</div>
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => selectedGameId && window.open(`/api/games/${selectedGameId}/results/export.csv`, "_blank")}
            className="text-xs font-bold text-[#c9d1e0] bg-white/[.05] border border-[#1b2740] rounded-[10px] px-4 py-2.5 hover:brightness-110 transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loadingResults ? (
        <p className="text-sm text-[#66728a] text-center py-16">Loading results…</p>
      ) : (
        <div className="flex flex-col xl:flex-row gap-5 items-start">
          <div className="flex-1 w-full min-w-0 space-y-4">
            {/* stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { v: participants.length, l: "PLAYERS", c: "#ff5aa8" },
                { v: totalQ, l: "QUESTIONS", c: "#00ddff" },
                { v: avgScore, l: "AVG SCORE", c: "#ffe500" },
                { v: avgCorrect !== null ? `${avgCorrect}%` : "—", l: "AVG CORRECT", c: "#35d07f" },
              ].map((t) => (
                <div key={t.l} className="bg-[#0f1724] border border-[#1b2740] rounded-[14px] p-4">
                  <div className="font-mono text-[26px] font-extrabold tabular-nums" style={{ color: t.c }}>{t.v}</div>
                  <div className="text-[10px] font-semibold tracking-[.12em] text-[#66728a] mt-0.5">{t.l}</div>
                </div>
              ))}
            </div>

            {/* leaderboard */}
            <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl overflow-hidden">
              <div className="px-4.5 py-3.5 border-b border-[#1b2740] text-[13px] font-extrabold text-[#eef2f8] px-5">
                Final leaderboard
              </div>
              <div className="p-2">
                {participants.length === 0 && (
                  <p className="text-sm text-[#66728a] text-center py-6">No participants recorded.</p>
                )}
                {participants.map((p, idx) => {
                  const win = p.rank === 1;
                  const [av, avtx] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  return (
                    <div key={p.userId} className={`flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] ${win ? "bg-[#ff0080]/[.08]" : ""}`}>
                      <span className={`w-5 text-center font-mono text-[13px] font-extrabold ${win ? "text-[#ff5aa8]" : "text-[#66728a]"}`}>{p.rank}</span>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: av, color: avtx }}>
                        {p.userName.substring(0, 1).toUpperCase()}
                      </span>
                      <span className={`flex-1 truncate text-sm ${win ? "font-extrabold text-[#eef2f8]" : "font-bold text-[#dfe5f0]"}`}>{p.userName}</span>
                      <span className="text-xs font-semibold text-[#66728a]">
                        {p.correctCount}/{totalQ}
                        {resultsData?.game?.hostUserId && p.userId === resultsData.game.hostUserId && totalQ - p.totalAnswered > 0
                          ? ` · ${totalQ - p.totalAnswered} unanswered`
                          : ''}
                      </span>
                      <span className={`w-[70px] text-right font-mono text-[15px] font-extrabold tabular-nums ${win ? "text-[#eef2f8]" : "text-[#9aa6bc]"}`}>{p.totalScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* hardest questions */}
          <div className="w-full xl:w-[280px] shrink-0 bg-[#0f1724] border border-[#1b2740] rounded-2xl p-4.5 p-5">
            <div className="text-[13px] font-extrabold text-[#eef2f8] mb-4">Hardest questions</div>
            {hardest.length === 0 && <p className="text-sm text-[#66728a]">No question data yet.</p>}
            {hardest.map((h) => {
              const pct = h.percentCorrect ?? 0;
              const c = pctColor(pct);
              return (
                <div key={h.id} className="mb-4 last:mb-0">
                  <div className="flex justify-between gap-2 mb-1.5">
                    <span className="flex-1 text-xs font-semibold text-[#c9d1e0] leading-snug line-clamp-2">{h.questionText}</span>
                    <span className="font-mono text-xs font-extrabold tabular-nums" style={{ color: c }}>{pct}%</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



function NewAdminDashboard() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<any>("games");
  const [preferredGameId, setPreferredGameId] = useState<number | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Incremented each time the admin enters Build fresh (no game pre-selected) from
  // another section. Passed as `key` to BuildQuizView so it remounts at the Setup
  // step rather than staying on whatever tab it was last on.
  const [buildResetKey, setBuildResetKey] = useState(0);

  const { data: games = [] } = useListGames(undefined, {
    query: { queryKey: getListGamesQueryKey(), refetchInterval: 10000 },
  });

  const activeGame = games.find((g) => g.status === "active");

  const navigate = (s: Section, gameId?: number) => {
    setSection(s);
    if (gameId !== undefined) {
      setPreferredGameId(gameId);
    } else if (s === "build" && section !== "build") {
      // Entering Build fresh from another section — clear any previously preferred
      // game and force BuildQuizView to remount at the Setup step.
      setPreferredGameId(undefined);
      setBuildResetKey(k => k + 1);
    }
    setSidebarOpen(false);
  };

  const updateGame = useUpdateGame();
  const queryClient = useQueryClient();

  const endGame = (id: number) => {
    updateGame.mutate(
      { gameId: id, data: { status: "completed" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          navigate("results");
        },
      }
    );
  };

  const navItems = [
    { id: "build", label: "Build a game", icon: Wand2 },
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "results", label: "Results", icon: BarChart3 },
    { id: "rooms", label: COPY.nav.rooms, icon: Settings },
  ] as const;

  const renderSection = () => {
    switch (section) {
      case "games": return <GamesView games={games} onNavigate={navigate} />;
      case "live": return <LiveGameView activeGame={activeGame} endGame={endGame} />;
      case "build": return <BuildQuizView key={buildResetKey} games={games} preferGameId={preferredGameId} onNavigate={navigate} />;
      case "results": return <NewResultsSection games={games} preferredGameId={preferredGameId} />;
      case "rooms": return <AdminSettings />;
      default: return null;
    }
  };

  // Short labels for the bottom tab bar (≤6 chars fits comfortably)
  const mobileNavLabels: Record<string, string> = {
    games: "Games",
    live: "Live",
    build: "Build",
    results: "Results",
    rooms: COPY.nav.rooms,
  };

  return (
    <div className="min-h-[100dvh] flex bg-[#0a0c12] text-[#eef2f8] font-sans">

      {/* ── Desktop: Persistent Left Rail ── */}
      <aside className="hidden lg:flex w-[216px] shrink-0 bg-[#0a1019] border-r border-[#1b2740] flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
          <CrownMark width={30} />
          <div>
            <div className="text-[13px] font-extrabold tracking-wide text-[#eef2f8]">Queen Trivia</div>
            <div className="font-mono text-[8px] font-bold tracking-[.22em] text-[#66728a] mt-px">HOST CONSOLE</div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map(item => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`
                  w-full flex items-center gap-3 h-[44px] px-4 rounded-lg text-sm font-medium transition-all relative overflow-hidden group
                  ${isActive ? 'bg-[#ff0080]/10 text-[#eef2f8] font-bold' : 'text-[#9aa6bc] hover:bg-white/5'}
                `}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff0080]" />}
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#ff0080]' : 'text-[#66728a] group-hover:text-[#9aa6bc]'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1b2740]">
          <div className="bg-[#0f1724] rounded-xl p-3 flex items-center gap-3 border border-[#1b2740]">
            <div className="w-8 h-8 rounded-full bg-[#ff0080] text-white flex items-center justify-center text-xs font-bold shrink-0">
              HO
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">Host</div>
              <button
                onClick={async () => { await logout(); setLocation("/"); }}
                className="text-xs text-[#9aa6bc] hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile: thin sticky top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 h-12 bg-[#0a1019] border-b border-[#1b2740]">
        <div className="flex items-center gap-2">
          <CrownMark width={20} />
          <span className="font-bold text-white text-sm tracking-widest">
            {mobileNavLabels[section] ?? "HOST"}
          </span>
          {activeGame && section !== "live" && (
            <button
              onClick={() => navigate("live")}
              className="ml-2 flex items-center gap-1 bg-[#ff0080]/10 border border-[#ff0080]/30 rounded-full px-2 py-0.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff0080] animate-pulse" />
              <span className="text-[10px] font-bold text-[#ff0080] tracking-wider">LIVE</span>
            </button>
          )}
        </div>
        <button
          onClick={async () => { await logout(); setLocation("/"); }}
          className="text-[#9aa6bc] p-1.5 -mr-1"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* top padding clears the 48px fixed header on mobile; bottom clears the tab bar */}
        <div className="pt-14 pb-24 px-4 md:p-8 lg:p-10 max-w-[1200px] w-full mx-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Mobile: sticky bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 flex items-stretch bg-[#0a1019] border-t border-[#1b2740]"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {navItems.map(item => {
          const isActive = section === item.id;
          const isLiveTab = item.id === "live";
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors relative"
              style={{ minWidth: 0 }}
            >
              {/* Live tab gets a pink glow dot when game is active */}
              {isLiveTab && activeGame && !isActive && (
                <span className="absolute top-2 right-[calc(50%-10px)] w-1.5 h-1.5 rounded-full bg-[#ff0080] animate-pulse" />
              )}
              <item.icon
                className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-[#ff0080]' : 'text-[#66728a]'}`}
              />
              <span className={`text-[10px] font-bold transition-colors truncate ${isActive ? 'text-[#ff0080]' : 'text-[#66728a]'}`}>
                {mobileNavLabels[item.id]}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-[#ff0080]" />
              )}
            </button>
          );
        })}
      </nav>

    </div>
  );
}


export default function Admin() {
    const { isAdmin } = useAuth();
    return isAdmin ? <NewAdminDashboard /> : <AdminGate />;
}
