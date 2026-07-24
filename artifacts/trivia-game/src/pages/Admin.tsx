
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
 useGetStatsSummary,
 getGetStatsSummaryQueryKey,
 useListGameParticipants,
 getListGameParticipantsQueryKey,
 useImportOpenTdbQuestions,
 useGenerateGeminiQuestions,
 useRegenerateQuestion,
 useEnhanceQuestion,
 useFactCheckQuestion,
} from "@workspace/api-client-react";
import type {
 Game,
 Question,
 RegenerateQuestionPreview,
 EnhanceQuestionResult,
 FactCheckSingleResult,
} from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
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
Eye,
EyeOff,
Crown,
AlertTriangle,
 KeyRound,
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
FlaskConical,
Loader2,
Database,
RefreshCw,
ShieldCheck,
Link,
Square,
SlidersHorizontal,
Wand2,
Sparkles,
} from "lucide-react";


// ─── Types ───────────────────────────────────────────────────────────────────
type Section = "dashboard" | "create" | "manage" | "questions" | "review" | "settings" |"results" | "help";
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
 const { toast } = useToast();
 const set = <K extends keyof QuestionFormState>(k: K, v: QuestionFormState[K]) =>
  setForm((f) => ({ ...f, [k]: v }));

 const handleFillWithAi = async () => {
  if (!onFillWithAi) return;
  setAiLoading(true);
  try {
   const filled = await onFillWithAi(form.questionType);
   if (filled) setForm(filled);
  } catch {
   toast({ variant: "destructive", title: "AI generation failed. Please try again." });
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
   <p className="font-medium leading-snug text-sm">{q.questionText}</p>
   <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline" className="uppercase text-[10px]">
     {label}
    </Badge>
    {q.source === "opentdb" && (
     <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400border-blue-500/30">OpenTDB</Badge>
    )}
    {q.aiGenerated && (
     <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400border-purple-500/30">AI Generated</Badge>
    )}
    <span className="text-xs text-accent font-semibold flex items-center gap-0.5">
     <Star className="h-3 w-3" /> {q.points} pts
    </span>
    {q.verifiedByAdmin ? (
     <span className="flex items-center gap-0.5 text-xs text-secondary">
         <ShieldCheck className="h-3 w-3" /> Verified
        </span>
    ):(
        <span className="flex items-center gap-0.5 text-xs text-yellow-400">
         <AlertTriangle className="h-3 w-3" /> Unverified
        </span>
    )}
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

const handleGenerate = async () => {
 const difficulty =
  genDiff === "same"
   ? ((game.difficulty ?? "medium") as "easy" | "medium" | "hard")
   : genDiff;
 const existingQs = genAvoid ? (questions ?? []).map((q) => q.questionText) : undefined;
 try {
  const result = await generateQuestions.mutateAsync({
   gameId: game.id,
   data: { topic: game.topic, difficulty, amount: genCount, existingQuestions: existingQs },
  });
  invalidate();
  setGenOpen(false);
  toast({ title: `Added ${result.imported} AI-generated questions` });
 } catch {
  toast({ variant: "destructive", title: "Generation failed. Please try again." });
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
     {/* Header */}
     <div className="flex items-center justify-between gap-3 flex-wrap">
   <div>
    <h3 className="font-bold text-lg leading-tight">{game.topic}</h3>
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
 submitLabel={editing ? "Save Changes" : "Add Question"}
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
        onError: () => toast({ variant: "destructive", title: "Update failed" }),
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
            verifiedByAdmin: true,
           },
       },
       {
           onSuccess: () => {
            invalidate();
            setDialogOpen(false);
            toast({ title: "Question added" });
           },
           onError: () => toast({ variant: "destructive", title: "Create failed" }),
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


// ─── ResultsPanel ─────────────────────────────────────────────────────────────


function ResultsPanel({ game, onClose }: { game: Game; onClose: () => void }) {
    const { data: participants } = useListGameParticipants(game.id, {
     query: { queryKey: getListGameParticipantsQueryKey(game.id) },
    });
    const sorted = useMemo(
     () => [...(participants ?? [])].sort((a, b) => b.totalScore - a.totalScore),
     [participants],
    );


    return (
     <div className="space-y-4">
         <div className="flex items-center justify-between gap-3">
          <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" /> Results — {game.topic}
              </h3>
              <p className="text-sm text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "player" : "players"} competed
              </p>
 </div>
 <Button variant="ghost" size="sm" onClick={onClose}>
  <X className="mr-1 h-4 w-4" /> Close
 </Button>
</div>
{sorted.length === 0 ? (
 <Card className="border-dashed border-card-border bg-card/40">
  <CardContent className="py-10 text-center text-muted-foreground">
  No players joined this game.
  </CardContent>
 </Card>
):(
 <Card className="border-card-border bg-card/60">
  <CardContent className="p-0 divide-y divide-border">
  {sorted.map((p, i) => (
      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
      <span className="w-8 text-center font-bold text-muted-foreground">
       {i === 0 ? (
         <Crown className="h-5 w-5 text-accent mx-auto" />
       ):(
         `#${i + 1}`
       )}
      </span>
      <span className="flex-1 font-medium">{p.userName}</span>
      <span className="font-bold tabular-nums text-accent text-lg">
       {p.totalScore}
                </span>
                <span className="text-xs text-muted-foreground">pts</span>
               </div>
              ))}
              </CardContent>
          </Card>
         )}
     </div>
    );
}


// ─── Dashboard section ────────────────────────────────────────────────────────


function DashboardSection({
    games,
    onNavigate,
}: {
    games: Game[];
    onNavigate: (s: Section, game?: Game) => void;
}) {
    const { data: stats } = useGetStatsSummary({
     query: { queryKey: getGetStatsSummaryQueryKey(), refetchInterval: 10000 },
    });
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const createGame = useCreateGame();
const createQuestion = useCreateQuestion();
const [buildingSample, setBuildingSample] = useState(false);


const handleCreateSampleStructure = async () => {
 setBuildingSample(true);
 try {
  const game = await createGame.mutateAsync({
   data: {
       topic: "Sample Game — Replace This Topic",
       difficulty: "medium",
       createdByAdmin: true,
   },
  });
  type Opts = { [key: string]: unknown } | null;
  const placeholders = [
   {
       questionType: "multiple_choice" as const,
       questionText: "[Q1: Replace with your verified multiple choice question]",
    options: ["Option A — replace", "Option B — replace", "Option C — replace", "Option D— replace"] as unknown as Opts,
       correctAnswer: "Option A — replace",
       points: 100,
       orderIndex: 0,
   },
   {
       questionType: "true_false" as const,
       questionText: "[Q2: Replace with your verified true/false statement]",
       options: ["True", "False"] as unknown as Opts,
       correctAnswer: "True",
       points: 100,
       orderIndex: 1,
   },
   {
       questionType: "write_in" as const,
       questionText: "[Q3: Replace with your verified write-in question]",
       options: null,
       correctAnswer: "[replace with correct answer]",
       points: 100,
       orderIndex: 2,
   },
   {
       questionType: "image_recognition" as const,
    questionText: "[Q4: Replace with your image recognition question — add animageUrl]",
       options: null,
       correctAnswer: "[replace with correct answer]",
       points: 100,
       orderIndex: 3,
       imageUrl: null,
   },
   {
       questionType: "matching" as const,
          questionText: "[Q5: Replace with your matching question]",
          options: {
              leftOptions: ["Term A — replace", "Term B — replace", "Term C — replace"],
              rightOptions: ["Match 1 — replace", "Match 2 — replace", "Match 3 — replace"],
          } as Opts,
     correctAnswer: "Term A — replace:Match 1 — replace|Term B — replace:Match 2 —replace|Term C — replace:Match 3 — replace",
          points: 100,
          orderIndex: 4,
         },
     ];
     for (const q of placeholders) {
         await createQuestion.mutateAsync({ gameId: game.id, data: q });
     }
     queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
     toast({
         title: "Sample structure created",
    description: `Game #${game.id} created with 5 placeholder questions. Replace all[bracketed] text with real, verified facts.`,
     });
     onNavigate("questions");
 } catch {
     toast({ title: "Failed to create sample", variant: "destructive" });
 } finally {
     setBuildingSample(false);
 }
};
const activeGame = games.find((g) => g.status === "active");
const waitingGames = games.filter((g) => g.status === "waiting");
const completedGames = games.filter((g) => g.status === "completed");
const statCards = [
  { label: "Total Games", value: stats?.totalGames ?? 0, icon: Gamepad2, color: "text-primary" },
 { label: "Live Now", value: stats?.activeGames ?? 0, icon: Radio, color: "text-secondary" },
 { label: "Total Players", value: stats?.totalPlayers ?? 0, icon: Users, color: "text-accent" },
 { label: "Answers", value: stats?.totalAnswers ?? 0, icon: Zap, color: "text-primary" },
];


return (
 <div className="space-y-6">
     {activeGame && (
     <Card className="border-primary/60 bg-primary/5">
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
       <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        <div>
         <p className="text-xs font-semibold uppercase tracking-widest text-primary">
           Game In Progress
         </p>
         <p className="font-bold text-lg">{activeGame.topic}</p>
        </div>
       </div>
       <div className="flex items-center gap-2">
         <Badge variant="outline" className="uppercase">{activeGame.difficulty}</Badge>
         <span className="text-sm text-muted-foreground">
         {activeGame.questionCount} questions
         </span>
         <Button size="sm" onClick={() => onNavigate("manage")}>
         Manage <ChevronRight className="ml-1 h-3.5 w-3.5" />
         </Button>
     </div>
     </CardContent>
 </Card>
)}


<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {statCards.map((s, i) => (
     <motion.div
     key={s.label}
     initial={{ opacity: 0, y: 8 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ delay: i * 0.06 }}
     >
     <Card className="border-card-border bg-card/60">
         <CardContent className="p-4 flex items-center gap-3">
         <s.icon className={`h-6 w-6 shrink-0 ${s.color}`} />
         <div>
          <div className="text-2xl font-bold tabular-nums">{s.value}</div>
         <div className="text-xs uppercase tracking-widest text-muted-foregroundleading-tight">
           {s.label}
          </div>
         </div>
         </CardContent>
        </Card>
    </motion.div>
   ))}
  </div>


  <div className="grid gap-4 md:grid-cols-3">
   {[
    { id: "create" as Section, icon: PlusCircle, title: "New Game", sub: "Set up a freshround", color: "bg-primary/10 text-primary", border: "hover:border-primary/50" },
    { id: "manage" as Section, icon: Gamepad2, title: "Manage Games", sub:`${waitingGames.length} waiting · ${completedGames.length} done`, color: "bg-secondary/10 text-secondary", border: "hover:border-secondary/50" },
   ].map((item) => (
    <Card
        key={item.id}
      className={`border-card-border bg-card/60 cursor-pointer transition-colors${item.border}`}
        onClick={() => onNavigate(item.id)}
    >
        <CardContent className="p-5 flex items-center gap-4">
         <div className={`rounded-lg p-3 ${item.color}`}>
         <item.icon className="h-6 w-6" />
         </div>
         <div>
         <p className="font-bold">{item.title}</p>
         <p className="text-sm text-muted-foreground">{item.sub}</p>
         </div>
         <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
     </CardContent>
    </Card>
   ))}
  </div>


  {import.meta.env.DEV && (
   <Card className="border-dashed border-yellow-500/40 bg-yellow-500/5">
    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
     <div className="flex items-center gap-3">
         <div className="rounded-lg p-2 bg-yellow-500/10 text-yellow-400">
         <FlaskConical className="h-5 w-5" />
         </div>
         <div>
         <p className="font-semibold text-sm">Dev: Create Sample Structure</p>
         <p className="text-xs text-muted-foreground">
          Creates one game with 5 typed placeholder questions. Replace all{" "}
         <span className="font-mono text-yellow-400">[bracketed]</span> text with realverified facts before going live.
                  </p>
               </div>
              </div>
              <Button
               size="sm"
               variant="outline"
               className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 shrink-0"
               disabled={buildingSample}
               onClick={handleCreateSampleStructure}
              >
               {buildingSample ? "Creating…" : "Create Sample"}
              </Button>
              </CardContent>
          </Card>
         )}
     </div>
    );
}


// ─── Create Game section ──────────────────────────────────────────────────────


function CreateGameSection({ onCreated }: { onCreated: (game: Game) => void }) {
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
const { toast } = useToast();
const queryClient = useQueryClient();
const createGame = useCreateGame();
const importQuestions = useImportOpenTdbQuestions();
const generateQuestions = useGenerateGeminiQuestions();


useEffect(() => {
 if (retryCountdown <= 0) return;
 const t = setTimeout(() => setRetryCountdown((n) => Math.max(0, n - 1)), 1000);
 return () => clearTimeout(t);
}, [retryCountdown]);


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
       data: { topic: topicName, difficulty, createdByAdmin: true },
      });
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
  } catch (err: unknown) {
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
      toast({ title: `${result.imported} questions imported from Open Trivia DB!` });
  } catch (err: unknown) {
      const msg =
    err instanceof Error ? err.message : "Could not fetch questions from Open TriviaDatabase.";
      setImportError(msg);
      setImportSource("opentdb");
      toast({ variant: "destructive", title: "Import failed — add questions manually" });
  }
 } else {
  // Gemini path for custom topics
  setWorkingLabel("Generating fact-based questions with AI… This may take 10–15seconds");
  try {
      const result = await generateQuestions.mutateAsync({
       gameId: game.id,
       data: { topic: topicName, difficulty, amount: Number(amount) },
          });
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          setImportedCount(result.imported);
          setImportSource("gemini");
          toast({ title: `${result.imported} questions generated with Gemini AI!` });
      } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Could not generate questions.";
          setImportError(msg);
          setImportSource("gemini");
     const status = err && typeof err === "object" && "status" in err ? (err as { status: number}).status : 0;
   const isRateLimit = status === 429 || msg.includes("Too many requests") ||msg.includes("429") || msg.includes("rate limit");
          if (isRateLimit) {
              setRetryCountdown(60);
              toast({ variant: "destructive", title: "Gemini rate limited — retry unlocks in 60 s" });
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
   const msg = err instanceof Error ? err.message : "Could not generate questions.";
   setImportError(msg);
   setImportSource("gemini");
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number}).status : 0;
  const isRateLimit = status === 429 || msg.includes("Too many requests") ||msg.includes("429") || msg.includes("rate limit");
   if (isRateLimit) {
         setRetryCountdown(60);
         toast({ variant: "destructive", title: "Still rate limited — retry unlocks in 60 s" });
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
};


if (created) {
 return (
     <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         className="space-y-4"
     >
         <Card className="border-2 border-secondary/50 bg-secondary/5">
    <CardContent className="py-10 text-center space-y-3">
     {working ? (
      <>
       <Loader2 className="mx-auto h-14 w-14 text-primary animate-spin" />
       <h3 className="text-2xl font-bold tracking-tight">{workingLabel}</h3>
      <p className="text-muted-foreground text-sm">This may take a fewseconds…</p>
      </>
     ) : importedCount !== null ? (
      <>
       <CheckCircle2 className="mx-auto h-14 w-14 text-secondary" />
       <h3 className="text-2xl font-bold tracking-tight">Ready to Go!</h3>
       <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{created.topic}</span>{" "}
        — <span className="font-semibold text-secondary">{importedCount}questions</span>{" "}
         {importSource === "gemini" ? "generated by Gemini AI" : "imported from OpenTrivia Database"}.
       </p>
       {importSource === "gemini" && (
        <div className="flex items-center justify-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2 max-w-sm mx-auto">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            AI-generated — please verify all questions in the Review tab before going live.
        </div>
       )}
       <p className="text-xs text-muted-foreground">
        Game ID: <span className="font-mono text-secondary">#{created.id}</span>
        {" · "}Review or edit questions before going live.
       </p>
       <div className="flex justify-center gap-3 pt-2">
        <Button className="font-bold" onClick={() => onCreated(created)}>
           <ListChecks className="mr-2 h-4 w-4" /> Review Questions
        </Button>
        <Button variant="outline" onClick={handleReset}>
           Create Another
        </Button>
       </div>
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
     <div>
         <h2 className="text-xl font-bold tracking-tight">Create a New Game</h2>
         <p className="text-muted-foreground text-sm mt-1">
   Standard categories auto-import from Open Trivia Database. Custom topics useGemini AI.
         </p>
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
      <SelectItem value="custom">� Custom Topic — Gemini AI generatesquestions</SelectItem>
     <Separator className="my-1" />
     {OPENTDB_CATEGORIES.map((cat) => (
      <SelectItem key={cat.id} value={String(cat.id)}>
          {cat.name}
      </SelectItem>
     ))}
     </SelectContent>
 </Select>
</div>


{/* Custom topic text input */}
{isCustom && (
 <div className="space-y-2">
     <Label htmlFor="customTopic">Custom Topic</Label>
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
   {isCustom ? (
    <Card className="border-purple-500/30 bg-purple-500/5">
     <CardContent className="p-4 text-sm space-y-1.5 flex gap-3">
      <Lightbulb className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
       <p className="font-semibold text-purple-400">Gemini AI will generate {amount}questions</p>
         <p className="text-muted-foreground">
         Questions will be marked as AI-generated and unverified. Review them in the
         Review Questions tab before going live.
         </p>
      </div>
     </CardContent>
    </Card>
   ):(
    <Card className="border-primary/20 bg-primary/5">
     <CardContent className="p-4 text-sm space-y-1 flex gap-3">
      <Database className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div>
      <p className="font-semibold text-primary">Auto-import from Open TriviaDatabase</p>
         <p className="text-muted-foreground">
         {amount} {difficulty} questions about{" "}
        <span className="font-medium text-foreground">{selectedCategory?.name}</span>{" "}
         will be fetched from the free, community-verified database.
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
              <><Database className="mr-2 h-4 w-4" /> Create & Import from OpenTDB</>
          )}
         </Button>
         </form>
     </div>
    );
}


// ─── Manage Games section─────────────────────────────────────────────────────
function ManageGamesSection({
 games,
 onManageQuestions,
}: {
 games: Game[];
 onManageQuestions: (game: Game) => void;
}) {
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const [viewingResults, setViewingResults] = useState<Game | null>(null);
 const [confirmStart, setConfirmStart] = useState<{ game: Game; unverifiedCount:number } | null>(null);
 const [checking, setChecking] = useState<number | null>(null);
 const updateGame = useUpdateGame();
 const deleteGame = useDeleteGame();

 const invalidate = () => {
  queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
 };


 const doGoLive = (game: Game) => {
  updateGame.mutate(
       { gameId: game.id, data: { status: "active" } },
     {
         onSuccess: () => { invalidate(); toast({ title: `"${game.topic}" is now live!` }); },
         onError: () => toast({ variant: "destructive", title: "Failed to start" }),
     },
 );
 setConfirmStart(null);
};


const handleGoLive = async (game: Game) => {
 // Check the "require all verified" setting from localStorage
 let requireVerify = true;
  try { requireVerify = localStorage.getItem(REQUIRE_VERIFY_KEY) !== "false"; } catch { /*ignore */ }


 if (!requireVerify) {
     doGoLive(game);
     return;
 }


 setChecking(game.id);
 try {
     const resp = await fetch(`/api/games/${game.id}/questions`, { credentials: "include" });
     if (resp.ok) {
         const qs = (await resp.json()) as Question[];
         const unverified = qs.filter((q) => !q.verifiedByAdmin).length;
         if (unverified > 0) {
                setConfirmStart({ game, unverifiedCount: unverified });
                setChecking(null);
                return;
            }
        }
    } catch {
        // fail open — proceed without verification check
    }
    setChecking(null);
    doGoLive(game);
};


if (viewingResults) {
    return <ResultsPanel game={viewingResults} onClose={() => setViewingResults(null)} />;
}


const ordered = [...games].sort((a, b) => {
    const rank: Record<string, number> = { active: 0, waiting: 1, completed: 2 };
    return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
});


return (
    <div className="space-y-4">
        <div>
            <h2 className="text-xl font-bold tracking-tight">Manage Games</h2>
            <p className="text-muted-foreground text-sm mt-1">
 Start, end, or delete games. Only one game can be live at a time.
</p>
</div>
{ordered.length === 0 ? (
<Card className="border-dashed border-primary/30 bg-card/40">
 <CardContent className="py-14 text-center space-y-2">
  <Gamepad2 className="mx-auto h-10 w-10 text-primary/40" />
  <p className="font-semibold text-lg">No games yet</p>
  <p className="text-sm text-muted-foreground">
      Head to "Create Game" to set up your first round.
  </p>
 </CardContent>
</Card>
):(
<div className="space-y-3">
 {ordered.map((game, i) => {
  const isWaiting = game.status === "waiting";
  const isActive = game.status === "active";
  const isDone = game.status === "completed";
  const noQuestions = game.questionCount === 0;
  return (
      <motion.div
      key={game.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
>
<Card
    className={`border-card-border bg-card/60 ${
     isActive ? "border-primary/40 ring-1 ring-primary/20" : ""
    }`}
>
    <CardContent className="p-4 space-y-3">
     <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-base">{game.topic}</h3>
          <Badge
           className={`uppercase text-[10px] ${
              isActive
              ? "bg-primary text-primary-foreground"
              : isWaiting
                 ? "bg-secondary/20 text-secondary border border-secondary/40"
                 : "bg-muted text-muted-foreground"
           }`}
          >
           {isActive ? "LIVE" : game.status}
          </Badge>
          <Badge variant="outline" className="uppercase text-[10px]">
           {game.difficulty}
          </Badge>
          </div>
             <p className="text-sm text-muted-foreground">
             Game #{game.id} · {game.questionCount}{" "}
             {game.questionCount === 1 ? "question" : "questions"}
             </p>
             {game.accessCode && (
              <button
               type="button"
               onClick={() => {
                navigator.clipboard?.writeText(game.accessCode!);
                toast({ title: `Code ${game.accessCode} copied` });
               }}
               className="inline-flex items-center gap-1.5 rounded-md border border-secondary/40 bg-secondary/10 px-2 py-1 text-xs font-bold tracking-widest text-secondary hover:bg-secondary/20 transition-colors"
               title="Click to copy access code"
              >
               <KeyRound className="h-3 w-3" />
               {game.accessCode}
              </button>
             )}
         </div>
        </div>
        {isWaiting && noQuestions && (
         <div className="flex items-center gap-2 rounded-md bg-destructive/10 borderborder-destructive/20 px-3 py-2 text-sm text-destructive">
             <AlertTriangle className="h-4 w-4 shrink-0" />
             No questions added — add questions before going live
         </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
         <Button variant="outline" size="sm" onClick={() => onManageQuestions(game)}>
             <ListChecks className="mr-1 h-4 w-4" /> Questions
         </Button>
         {isDone && (
             <Button variant="outline" size="sm" onClick={() => setViewingResults(game)}>
             <Trophy className="mr-1 h-4 w-4" /> View Results
             </Button>
         )}
         {isWaiting && (
             <Button
              size="sm"
              className="font-bold"
              disabled={updateGame.isPending || checking === game.id || noQuestions}
              onClick={() => handleGoLive(game)}
             >
              {checking === game.id ? (
                 <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ):(
                 <Play className="mr-1 h-4 w-4" />
              )}
              Go Live
             </Button>
         )}
         {isActive && (
             <Button
              size="sm"
              variant="secondary"
              className="font-bold"
              disabled={updateGame.isPending}
              onClick={() =>
                 updateGame.mutate(
                       { gameId: game.id, data: { status: "completed" } },
                       { onSuccess: () => { invalidate(); toast({ title: "Game ended" }); } },
                   )
               }
           >
               <Flag className="mr-1 h-4 w-4" /> End Game
           </Button>
          )}
          <Button
           variant="ghost"
           size="sm"
           className="text-destructive hover:text-destructive ml-auto"
           disabled={deleteGame.isPending}
           onClick={() => {
            if (window.confirm(`Delete "${game.topic}"? This removes all questions,participants, and answers.`)) {
                   deleteGame.mutate(
                       { gameId: game.id },
                       {
                           onSuccess: () => { invalidate(); toast({ title: "Game deleted" }); },
                           onError: () => toast({ variant: "destructive", title: "Delete failed" }),
                       },
                   );
               }
           }}
          >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
               </Button>
              </div>
             </CardContent>
             </Card>
         </motion.div>
        );
       })}
   </div>
  )}


  {/* Go Live confirmation dialog */}
  {confirmStart && (
   <Dialog open onOpenChange={() => setConfirmStart(null)}>
       <DialogContent className="sm:max-w-md">
        <DialogHeader>
         <DialogTitle className="flex items-center gap-2">
             <AlertTriangle className="h-5 w-5 text-yellow-400" />
             Unverified questions
         </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
         <p className="text-sm text-muted-foreground">
       <span className="font-semibold text-yellow-400">{confirmStart.unverifiedCount}</span>{" "}
       {confirmStart.unverifiedCount === 1 ? "question has" : "questions have"} not beenverified yet in{" "}
       <span className="font-semibold text-foreground">"{confirmStart.game.topic}"</span>.
               </p>
               <p className="text-xs text-muted-foreground">
                Use "Review Questions" to verify them before going live, or start anyway.
               </p>
              </div>
              <div className="flex gap-2 justify-end pt-1">
               <Button variant="outline" onClick={() => setConfirmStart(null)}>
                Cancel
               </Button>
               <Button
                variant="destructive"
                onClick={() => doGoLive(confirmStart.game)}
                disabled={updateGame.isPending}
               >
                <Play className="mr-1 h-4 w-4" /> Start Anyway
               </Button>
              </div>
              </DialogContent>
          </Dialog>
         )}
     </div>
    );
}
// ─── Questions section ────────────────────────────────────────────────────────


function QuestionsSection({
 games,
 preferGameId,
}: {
 games: Game[];
 preferGameId?: number;
}) {
 const waitingGames = games.filter((g) => g.status === "waiting");
 const [selectedId, setSelectedId] = useState<number | null>(() => {
  if (preferGameId) return preferGameId;
  return waitingGames[0]?.id ?? null;
 });


 useEffect(() => {
  if (preferGameId) { setSelectedId(preferGameId); return; }
  if (selectedId === null && waitingGames.length > 0) {
       setSelectedId(waitingGames[0]!.id);
   }
 }, [games, preferGameId]);


 const selectedGame = games.find((g) => g.id === selectedId) ?? null;


 return (
   <div className="space-y-5">
<div>
 <h2 className="text-xl font-bold tracking-tight">Add Questions</h2>
 <p className="text-muted-foreground text-sm mt-1">
  Select a waiting game and build its question set manually.
 </p>
</div>


{/* Verified facts notice */}
<Card className="border-destructive/30 bg-destructive/5">
 <CardContent className="p-4 flex gap-3">
  <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
  <div className="space-y-1">
   <p className="font-semibold text-sm text-destructive">
    All questions must be based on verified real-world facts
   </p>
   <p className="text-xs text-muted-foreground">
    Do not use AI-generated or unverified content. Every answer must be
    factually correct and confirmable from a reliable source. Players
    trust the host to get it right.
   </p>
  </div>
 </CardContent>
</Card>


{waitingGames.length === 0 ? (
 <Card className="border-dashed border-primary/30 bg-card/40">
 <CardContent className="py-12 text-center space-y-2">
  <Gamepad2 className="mx-auto h-10 w-10 text-primary/40" />
  <p className="font-semibold">No games in waiting status</p>
  <p className="text-sm text-muted-foreground">
      Create a new game first, or games that are already live won't
      appear here — end them to add more questions.
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
       {waitingGames.map((g) => (
        <SelectItem key={g.id} value={String(g.id)}>
         {g.topic}
         <span className="ml-2 text-muted-foreground text-xs">
          ({g.questionCount} questions)
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
    const [filter, setFilter] = useState<"all" | "unverified" | "opentdb" | "ai" | "manual">("all");
    const [sortBy, setSortBy] = useState<"order" | "verified" | "type" | "dateAdded">("order");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const { toast } = useToast();
const queryClient = useQueryClient();
const updateQuestion = useUpdateQuestion();
const deleteQuestion = useDeleteQuestion();


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

// Regenerate All modal state
const [regenAllOpen, setRegenAllOpen] = useState(false);
const [regenAllCount, setRegenAllCount] = useState(10);
const [regenAllDiff, setRegenAllDiff] = useState<"easy" | "medium" | "hard" | "same">("same");
const [regenAllRunning, setRegenAllRunning] = useState(false);


// Fact check state
 type FcResult = { question: Question; verdict: string; confidence: string; explanation:string; correctAnswerIfWrong: string | null };
type FcFailed = { question: Question; error: string };
const [fcState, setFcState] = useState<{
 running: boolean;
 current: number;
 total: number;
 results: FcResult[];
 failed: FcFailed[];
 rateLimited: boolean;
} | null>(null);


const regenMutation = useRegenerateQuestion();
const enhanceMutation = useEnhanceQuestion();
const factCheckMutation = useFactCheckQuestion();
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
     case "unverified": return !q.verifiedByAdmin;
     case "opentdb": return q.source === "opentdb";
     case "ai": return !!q.aiGenerated;
     case "manual": return q.source === "manual" || (!q.source && !q.aiGenerated);
     default: return true;
 }
});
const displayList = [...filtered].sort((a, b) => {
 if (sortBy === "verified") return Number(b.verifiedByAdmin) - Number(a.verifiedByAdmin);
 if (sortBy === "type") return a.questionType.localeCompare(b.questionType);
 if (sortBy === "dateAdded") return b.id - a.id;
 return a.orderIndex - b.orderIndex;
});


const verifiedCount = rawQuestions.filter((q) => q.verifiedByAdmin).length;
const unverifiedCount = rawQuestions.length - verifiedCount;


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


const handleVerify = (q: Question, verified: boolean) => {
 updateQuestion.mutate(
     { questionId: q.id, data: { verifiedByAdmin: verified } },
     {
   onSuccess: () => { invalidate(); toast({ title: verified ? "Marked verified" : "Markedunverified" }); },
         onError: () => toast({ variant: "destructive", title: "Update failed" }),
     },
 );
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


const handleBulkVerify = async () => {
 const ids = Array.from(selected);
 await Promise.allSettled(
     ids.map((id) => {
      const q = rawQuestions.find((q) => q.id === id);
      if (!q?.verifiedByAdmin) {
          return updateQuestion.mutateAsync({ questionId: id, data: { verifiedByAdmin: true } });
      }
      return Promise.resolve();
     }),
 );
 invalidate();
 setSelected(new Set());
 toast({ title: `Verified ${ids.length} questions` });
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
          verifiedByAdmin: false,
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
    data: { topic: game.topic, difficulty, amount: genMoreCount, existingQuestions:existingQs },
     });
     invalidate();
      setGenMoreOpen(false);
   toast({ title: `Added ${result.imported} questions — total now ${rawQuestions.length +result.imported}` });
  } catch {
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
      data: { topic: game.topic, difficulty, amount: regenAllCount, existingQuestions: oldTexts },
    });
    invalidate();
    setRegenAllOpen(false);
    toast({ title: `Regenerated ${result.imported} questions for "${game.topic}"` });
  } catch {
    toast({ variant: "destructive", title: "Regeneration failed. Please try again." });
  } finally {
    setRegenAllRunning(false);
  }
};

 const handleFactCheckAll = async () => {
  if (!selectedGameId) return;
  const toCheck = rawQuestions.filter((q) => !q.verifiedByAdmin);
  if (toCheck.length === 0) {
      toast({ title: "All questions are already verified." });
      return;
  }
  setFcState({ running: true, current: 0, total: toCheck.length, results: [], failed: [],rateLimited: false });
  const results: FcResult[] = [];
  const failed: FcFailed[] = [];
  for (let i = 0; i < toCheck.length; i++) {
      const q = toCheck[i]!;
      setFcState((prev) => (prev ? { ...prev, current: i + 1, rateLimited: false } : null));
      let done = false;
      for (let attempt = 0; attempt < 2; attempt++) {
       try {
    const r = await factCheckMutation.mutateAsync({ gameId: selectedGameId,questionId: q.id });
            results.push({
                question: q,
                verdict: r.verdict,
                confidence: r.confidence,
                explanation: r.explanation,
                correctAnswerIfWrong: r.correctAnswerIfWrong ?? null,
            });
            done = true;
            break;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if ((msg.includes("Too many requests") || msg.includes("429")) && attempt === 0) {
                setFcState((prev) => (prev ? { ...prev, rateLimited: true } : null));
                await new Promise((res) => setTimeout(res, 15000));
            } else {
                failed.push({ question: q, error: "Check failed" });
                break;
            }
        }
    }
    if (!done && !failed.some((f) => f.question.id === q.id)) {
        failed.push({ question: q, error: "Check failed" });
    }
    setFcState((prev) => (prev ? { ...prev, results: [...results], failed: [...failed] } : null));
    if (i < toCheck.length - 1) await new Promise((res) => setTimeout(res, 2000));
}
  setFcState((prev) => (prev ? { ...prev, running: false, rateLimited: false } : null));
 };


 const handleRetryFailed = async () => {
  if (!selectedGameId || !fcState || fcState.failed.length === 0) return;
  const toRetry = [...fcState.failed];
  setFcState((prev) =>
    prev ? { ...prev, running: true, failed: [], current: 0, total: toRetry.length, rateLimited: false} : null,
  );
  const newFailed: FcFailed[] = [];
  const newResults = [...fcState.results];
  for (let i = 0; i < toRetry.length; i++) {
      const entry = toRetry[i]!;
      setFcState((prev) => (prev ? { ...prev, current: i + 1 } : null));
      try {
   const r = await factCheckMutation.mutateAsync({ gameId: selectedGameId,questionId: entry.question.id });
       newResults.push({
        question: entry.question,
        verdict: r.verdict,
        confidence: r.confidence,
        explanation: r.explanation,
        correctAnswerIfWrong: r.correctAnswerIfWrong ?? null,
       });
      } catch {
       newFailed.push(entry);
      }
  setFcState((prev) => (prev ? { ...prev, results: [...newResults], failed: [...newFailed] } :null));
      if (i < toRetry.length - 1) await new Promise((res) => setTimeout(res, 2000));
  }
  setFcState((prev) => (prev ? { ...prev, running: false } : null));
 };


 const getSourceBadge = (q: Question) => {
 if (q.aiGenerated) return { label: "AI Generated", cls: "bg-purple-500/15 text-purple-400border-purple-500/30" };
 if (q.source === "opentdb") return { label: "OpenTDB", cls: "bg-blue-500/15 text-blue-400border-blue-500/30" };
  return { label: "Manual", cls: "bg-green-500/15 text-green-400 border-green-500/30" };
 };


 const FILTERS: { key: typeof filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unverified", label: "Unverified" },
  { key: "opentdb", label: "OpenTDB" },
  { key: "ai", label: "AI Generated" },
  { key: "manual", label: "Manual" },
 ];


 const filterCount = (key: typeof filter) => rawQuestions.filter((q) => {
  switch (key) {
      case "unverified": return !q.verifiedByAdmin;
     case "opentdb": return q.source === "opentdb";
     case "ai": return !!q.aiGenerated;
     case "manual": return q.source === "manual" || (!q.source && !q.aiGenerated);
     default: return true;
 }
}).length;


return (
 <div className="space-y-5">
     <div>
      <h2 className="text-xl font-bold tracking-tight">Review Questions</h2>
      <p className="text-muted-foreground text-sm mt-1">
       Verify, edit, and manage questions across all games.
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
        <SelectItem value="verified">Verification status</SelectItem>
       </SelectContent>
      </Select>
     </div>
    </div>


    {/* Verification stats */}
    {selectedGameId !== null && rawQuestions.length > 0 && (
     <div className="flex items-center justify-between rounded-lg border border-card-border bg-card/50 px-4 py-2.5">
      <div className="flex items-center gap-4 text-sm flex-wrap">
       <span className="text-muted-foreground">{rawQuestions.length} total</span>
       <span className="flex items-center gap-1.5 text-secondary font-medium">
        <ShieldCheck className="h-4 w-4" />
        {verifiedCount} verified
       </span>
       {unverifiedCount > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-400 font-medium">
         <AlertTriangle className="h-3.5 w-3.5" />
            {unverifiedCount} unverified
        </span>
       )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
      <div className="h-2 w-20 bg-muted/30 rounded-full overflow-hidden hiddensm:block">
        <div
            className="h-full bg-secondary rounded-full transition-all"
         style={{ width: `${rawQuestions.length ? (verifiedCount / rawQuestions.length) *100 : 0}%` }}
        />
       </div>
       <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setGenMoreOpen(true)}
        disabled={fcState?.running || regenAllRunning}
       >
        <Sparkles className="h-3 w-3" /> Generate More
       </Button>
       <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
        onClick={() => setRegenAllOpen(true)}
        disabled={fcState?.running || regenAllRunning || rawQuestions.length === 0}
       >
        <RefreshCw className="h-3 w-3" /> Regenerate All
       </Button>
       <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1"
        onClick={handleFactCheckAll}
              disabled={fcState?.running || regenAllRunning || rawQuestions.length === 0}
          >
              <FlaskConical className="h-3 w-3" /> Fact Check All
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
       <Button size="sm" variant="outline" onClick={handleBulkVerify}disabled={updateQuestion.isPending}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify All
       </Button>
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


{/* Fact check progress / results */}
{fcState && (
<div className="rounded-lg border border-card-border bg-card/60 p-4 space-y-3">
  {fcState.running ? (
     <div className="flex items-center gap-3">
     <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
     <div className="flex-1">
      <p className="text-sm font-medium">
        {fcState.rateLimited
        ? "Rate limited — waiting 15 seconds…"
        : `Checking question ${fcState.current} of ${fcState.total}…`}
      </p>
      <div className="mt-1.5 h-1.5 w-40 bg-muted/30 rounded-full overflow-hidden">
        <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${fcState.total ? (fcState.current / fcState.total) * 100 : 0}%` }}
        />
      </div>
     </div>
     </div>
  ):(
     <div className="space-y-3">
        <div className="flex items-center justify-between">
         <p className="text-sm font-semibold">Fact Check Complete</p>
         <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setFcState(null)}>
          <X className="h-3.5 w-3.5" />
         </Button>
        </div>
        <div className="flex gap-4 text-xs flex-wrap">
         <span className="flex items-center gap-1 text-secondary font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {fcState.results.filter((r) => r.verdict === "CORRECT").length} correct
         </span>
         <span className="flex items-center gap-1 text-yellow-400 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {fcState.results.filter((r) => r.verdict === "UNCERTAIN").length} uncertain
         </span>
         <span className="flex items-center gap-1 text-destructive font-medium">
          <X className="h-3.5 w-3.5" />
          {fcState.results.filter((r) => r.verdict === "INCORRECT").length} incorrect
         </span>
         {fcState.failed.length > 0 && (
          <span className="text-muted-foreground">{fcState.failed.length}failed</span>
         )}
        </div>
        {fcState.results.filter((r) => r.verdict !== "CORRECT").length > 0 && (
         <div className="space-y-2 max-h-64 overflow-y-auto">
         {fcState.results
          .filter((r) => r.verdict !== "CORRECT")
          .map(({ question, verdict, confidence, explanation, correctAnswerIfWrong }) => (
           <div
           key={question.id}
           className={`rounded-md border px-3 py-2 text-xs space-y-1 ${
               verdict === "INCORRECT"
                ? "border-destructive/30 bg-destructive/5"
                : "border-yellow-400/20 bg-yellow-400/5"
           }`}
           >
           <div className="flex items-start gap-2">
               {verdict === "INCORRECT" ? (
                <X className="h-3.5 w-3.5 shrink-0 text-destructive mt-0.5" />
               ):(
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400 mt-0.5" />
               )}
               <div className="flex-1 min-w-0">
              <p className="font-medium leading-snugtruncate">{question.questionText}</p>
                <p className="text-muted-foreground mt-0.5">{explanation}</p>
                {correctAnswerIfWrong && (
                    <p className="mt-1">
                    Suggested answer:{" "}
               <span className="text-secondary font-medium">{correctAnswerIfWrong}</span>
                    </p>
                         )}
              <span className="inline-block mt-0.5 text-[10px] text-muted-foregrounduppercase tracking-wide">
                          Confidence: {confidence}
                         </span>
                         </div>
                     </div>
                    </div>
                   ))}
               </div>
              )}
              {fcState.failed.length > 0 && (
               <Button size="sm" variant="outline" onClick={handleRetryFailed}>
                   <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Retry {fcState.failed.length} failed {fcState.failed.length === 1 ? "question" :"questions"}
               </Button>
              )}
          </div>
         )}
      </div>
    )}


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
           <p className="font-medium leading-snug text-sm">{q.questionText}</p>
           <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase text-[10px]">{typeLabel}</Badge>
             <Badge variant="outline" className={`text-[10px]${src.cls}`}>{src.label}</Badge>
            <span className="text-xs text-accent font-semibold flex items-center gap-0.5">
            <Star className="h-3 w-3" /> {q.points} pts
            </span>
            {q.verifiedByAdmin ? (
            <span className="flex items-center gap-1 text-xs text-secondary font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
           ):(
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Unverified
            </span>
           )}
           </div>
           {q.questionType !== "matching" && (
            <p className="text-xs text-muted-foreground">
           Answer: <span className="text-secondary font-medium">{q.correctAnswer}</span>
           </p>
          )}
          {q.source && q.source !== "manual" && q.source !== "opentdb" && (
           <p className="text-xs text-muted-foreground">Source: {q.source}</p>
          )}
          {q.factCheckUrl && (
           <a
               href={q.factCheckUrl}
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center gap-1 text-xs text-primary hover:underline w-fit"
           >
               <Link className="h-3 w-3" /> Fact-check link
           </a>
          )}
         </div>


         {/* Actions */}
         <div className="flex flex-col sm:flex-row gap-1 shrink-0">
          <Button
           size="sm"
           variant={q.verifiedByAdmin ? "ghost" : "outline"}
           className={
               q.verifiedByAdmin
     ? "h-8 px-2 text-yellow-400 hover:text-yellow-400"
     : "h-8 px-2 text-secondary border-secondary/40"
}
onClick={() => handleVerify(q, !q.verifiedByAdmin)}
disabled={updateQuestion.isPending}
>
{q.verifiedByAdmin ? (
    <><AlertTriangle className="h-3 w-3 mr-1" />Unverify</>
):(
    <><ShieldCheck className="h-3 w-3 mr-1" />Verify</>
)}
</Button>
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
            {/* Fact check banner */}
            <div
            className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${
             enhResult.factCheckResult === "VERIFIED"
              ? "bg-secondary/10 border-secondary/30 text-secondary"
              : enhResult.factCheckResult === "LIKELY_INCORRECT"
         ? "bg-destructive/10 border-destructive/30 text-destructive"
         : "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
}`}
>
{enhResult.factCheckResult === "VERIFIED" ? (
    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
) : enhResult.factCheckResult === "LIKELY_INCORRECT" ? (
    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
):(
    <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
)}
<div>
    <p className="text-sm font-semibold">
     {enhResult.factCheckResult === "VERIFIED"
         ? "Fact Verified"
         : enhResult.factCheckResult === "LIKELY_INCORRECT"
         ? "Likely Incorrect"
         : "Uncertain"}
    </p>
    {enhResult.factCheckNotes && (
     <p className="text-xs mt-0.5 opacity-85">{enhResult.factCheckNotes}</p>
    )}
</div>
</div>


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
                submitLabel="Save Changes"
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


// ─── Settings section ─────────────────────────────────────────────────────────


const REQUIRE_VERIFY_KEY = "trivia-require-verify";


function SettingsSection() {
    const { toast } = useToast();
    const [triviaCode, setTriviaCode] = useState("");
    const [adminCode, setAdminCode] = useState("");
    const [showTrivia, setShowTrivia] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [currentTrivia, setCurrentTrivia] = useState("");
    const [currentAdmin, setCurrentAdmin] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [requireVerify, setRequireVerify] = useState<boolean>(() => {
     try { return localStorage.getItem(REQUIRE_VERIFY_KEY) !== "false"; } catch { return true; }
    });


    useEffect(() => {
     fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
          setCurrentTrivia(data.triviaAccessCode ?? "");
          setCurrentAdmin(data.adminAccessCode ?? "");
     setTriviaCode(data.triviaAccessCode ?? "");
     setAdminCode(data.adminAccessCode ?? "");
     setLoading(false);
   })
   .catch(() => {
     toast({ variant: "destructive", title: "Could not load settings" });
     setLoading(false);
   });
 }, []);


 const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  const t = triviaCode.trim();
  const a = adminCode.trim();
  if (t.length < 8) { toast({ variant: "destructive", title: "Trivia code must be at least 8 characters" }); return; }
  if (a.length < 8) { toast({ variant: "destructive", title: "Admin code must be at least 8 characters" }); return; }
   if (t === a) { toast({ variant: "destructive", title: "Trivia and admin codes must be different"}); return; }
  setSaving(true);
  try {
   const res = await fetch("/api/settings", {
     method: "PATCH",
     headers: { "Content-Type": "application/json" },
     credentials: "include",
     body: JSON.stringify({ triviaAccessCode: t, adminAccessCode: a }),
        });
        if (!res.ok) {
            const data = await res.json();
            toast({ variant: "destructive", title: data.error ?? "Save failed" });
            return;
        }
        const updated = await res.json();
        setCurrentTrivia(updated.triviaAccessCode);
        setCurrentAdmin(updated.adminAccessCode);
        toast({ title: "Settings saved" });
    } catch {
        toast({ variant: "destructive", title: "Network error" });
    } finally {
        setSaving(false);
    }
};


if (loading) {
    return (
        <div className="space-y-4 max-w-lg">
            <div className="h-8 w-48 bg-muted/50 animate-pulse rounded" />
            <div className="h-32 bg-muted/30 animate-pulse rounded-lg" />
        </div>
    );
}
 const unchanged = triviaCode.trim() === currentTrivia && adminCode.trim() ===currentAdmin;


return (
 <div className="space-y-6 max-w-lg">
  <div>
   <h2 className="text-xl font-bold tracking-tight">Settings</h2>
   <p className="text-muted-foreground text-sm mt-1">
    Change the access codes players and admins use to enter the app.
   </p>
  </div>
  <form onSubmit={handleSave} className="space-y-5">
   <Card className="border-card-border bg-card/60">
    <CardContent className="p-5 space-y-4">
     <div className="space-y-2">
      <Label htmlFor="trivia-code">
       Player Access Code
       <span className="ml-2 text-xs text-muted-foreground font-normal">
           (shared with players)
       </span>
      </Label>
      <div className="relative">
       <Input
           id="trivia-code"
           type={showTrivia ? "text" : "password"}
           value={triviaCode}
        onChange={(e) => setTriviaCode(e.target.value.toUpperCase())}
        className="pr-10 uppercase tracking-widest font-mono"
       />
       <button
        type="button"
        onClick={() => setShowTrivia((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foregroundhover:text-foreground transition-colors"
       >
        {showTrivia ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
       </button>
      </div>
     </div>
     <Separator />
     <div className="space-y-2">
      <Label htmlFor="admin-code">
       Admin Code
       <span className="ml-2 text-xs text-muted-foreground font-normal">
        (hosts only — keep private)
       </span>
      </Label>
      <div className="relative">
       <Input
        id="admin-code"
        type={showAdmin ? "text" : "password"}
        value={adminCode}
          onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
          className="pr-10 uppercase tracking-widest font-mono"
         />
         <button
          type="button"
          onClick={() => setShowAdmin((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foregroundhover:text-foreground transition-colors"
         >
          {showAdmin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
         </button>
        </div>
        </div>
    </CardContent>
   </Card>
   <Button type="submit" className="font-bold" disabled={unchanged || saving}>
    {saving ? "Saving..." : "Save Changes"}
   </Button>
   {unchanged && (
    <p className="text-xs text-muted-foreground">No changes to save.</p>
   )}
  </form>


  {/* ── Game Start Rules ── */}
  <div className="space-y-3">
   <div>
<h3 className="font-semibold text-base">Game Start Rules</h3>
<p className="text-muted-foreground text-sm mt-0.5">
 Controls what happens when you click Go Live on a game.
</p>
</div>
<Card className="border-card-border bg-card/60">
<CardContent className="p-5">
 <div className="flex items-start justify-between gap-4">
  <div className="space-y-1">
   <p className="font-medium text-sm">Require all questions verified</p>
   <p className="text-xs text-muted-foreground max-w-sm">
    When enabled, going live with unverified questions shows a warning and requires
    confirmation. Disable only if you trust all questions are accurate.
   </p>
  </div>
  <Switch
   checked={requireVerify}
   onCheckedChange={(v) => {
    setRequireVerify(v);
    try { localStorage.setItem(REQUIRE_VERIFY_KEY, String(v)); } catch { /* ignore */ }
    toast({ title: v ? "Verification check enabled" : "Verification check disabled" });
   }}
  />
 </div>
 {!requireVerify && (
      <div className="mt-3 flex items-center gap-2 rounded-md bg-yellow-400/10border border-yellow-400/20 px-3 py-2 text-xs text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Verification check is off — games can go live with unverified questions.
            </div>
           )}
          </CardContent>
         </Card>
         </div>
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


function ResultsSection({ games }: { games: Game[] }) {
 const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
 const [showQuestions, setShowQuestions] = useState(false);


 const completedGames = games.filter((g) => g.status === "completed");


 const { data: resultsData, isLoading: loadingResults } = useQuery<GameResultsData>({
     queryKey: ["admin-results", selectedGameId],
     queryFn: async () => {
     const res = await fetch(`/api/games/${selectedGameId}/results`);
     if (!res.ok) throw new Error("Failed to fetch results");
     return res.json();
 },
 enabled: selectedGameId !== null,
});


const { data: questionStats = [], isLoading: loadingStats } = useQuery<QuestionStat[]>({
 queryKey: ["admin-question-stats", selectedGameId],
 queryFn: async () => {
     const res = await fetch(`/api/games/${selectedGameId}/questions/stats`);
     if (!res.ok) throw new Error("Failed to fetch stats");
     return res.json();
 },
 enabled: selectedGameId !== null && showQuestions,
});


const handleExport = () => {
 if (!selectedGameId) return;
 window.open(`/api/games/${selectedGameId}/results/export.csv`, "_blank");
};


const medals = ["�", "�", "�"];


return (
 <div className="space-y-6">
     <div>
      <h2 className="text-2xl font-bold tracking-tight">Game Results</h2>
<p className="text-muted-foreground text-sm mt-1">
 View leaderboards and question analytics for completed games.
</p>
</div>


{/* Game picker */}
<Card>
<CardContent className="pt-5">
 {completedGames.length === 0 ? (
  <p className="text-muted-foreground text-sm text-center py-4">
   No completed games yet. Finish a game to see results here.
  </p>
 ):(
  <div className="space-y-3">
   <label className="text-sm font-medium">Select a completed game</label>
   <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {completedGames.map((g) => (
       <button
         key={g.id}
         onClick={() => {
          setSelectedGameId(g.id);
          setShowQuestions(false);
         }}
         className={cn(
          "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
          selectedGameId === g.id
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
         )}
        >
         <Trophy className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
         <div className="min-w-0">
             <p className="font-medium text-sm truncate">{g.topic}</p>
             <p className="text-xs text-muted-foreground">
              {g.questionCount} question{g.questionCount !== 1 ? "s" : ""}
             </p>
         </div>
        </button>
       ))}
       </div>
   </div>
  )}
 </CardContent>
</Card>


{/* Results display */}
{selectedGameId && (
 <>
  {loadingResults ? (
   <Card>
       <CardContent className="py-12 text-center text-muted-foreground text-sm">
       Loading results…
       </CardContent>
     </Card>
    ) : resultsData ? (
     <>
       {/* Header */}
       <div className="flex items-center justify-between gap-3 flex-wrap">
       <div>
          <h3 className="text-lg font-bold">{resultsData.game.topic}</h3>
          <p className="text-sm text-muted-foreground">
             {resultsData.participants.length} player{resultsData.participants.length !== 1 ?"s" : ""} ·{" "}
          {resultsData.totalQuestions} question{resultsData.totalQuestions !== 1 ? "s" : ""}
          </p>
       </div>
       <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
       </Button>
       </div>


       {/* Leaderboard */}
       <Card>
       <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Final Leaderboard
</CardTitle>
</CardHeader>
<CardContent className="p-0">
{resultsData.participants.length === 0 ? (
 <p className="text-muted-foreground text-sm text-center py-6">
  No participants recorded.
 </p>
):(
 <div className="divide-y divide-border">
  {resultsData.participants.map((p: LeaderboardEntry) => (
   <div key={p.userId} className="flex items-center gap-3 px-4 py-3">
      <span className="w-8 text-center text-lg font-bold shrink-0">
        {p.rank <= 3 ? medals[p.rank - 1] : `#${p.rank}`}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{p.userName}</p>
        <p className="text-xs text-muted-foreground">
        {p.correctCount}/{resultsData.totalQuestions} correct
        </p>
      </div>
      <span className="font-bold text-primary tabular-nums shrink-0">
        {p.totalScore} pts
      </span>
   </div>
  ))}
 </div>
 )}
</CardContent>
</Card>


{/* Question stats accordion */}
<Card>
<button
 className="w-full flex items-center justify-between px-5 py-4 text-left"
 onClick={() => setShowQuestions((v) => !v)}
>
 <div className="flex items-center gap-2 font-semibold text-sm">
    <BarChart3 className="h-4 w-4 text-primary" />
    Question Analytics
 </div>
 {showQuestions ? (
    <ChevronUp className="h-4 w-4 text-muted-foreground" />
 ):(
    <ChevronDown className="h-4 w-4 text-muted-foreground" />
 )}
</button>
{showQuestions && (
 <CardContent className="pt-0 pb-4">
    {loadingStats ? (
      <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
    ) : questionStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No questiondata.</p>
           ):(
            <div className="space-y-3">
              {questionStats.map((q: QuestionStat, idx: number) => (
               <div key={q.id} className="space-y-1">
                 <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">
                    <span className="text-muted-foreground mr-1">Q{idx + 1}.</span>
                    {q.questionText}
                    </p>
            <span className="text-xs font-bold text-muted-foreground tabular-numswhitespace-nowrap shrink-0">
                    {q.percentCorrect !== null ? `${q.percentCorrect}%` : "—"}
                    </span>
                 </div>
                 <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${q.percentCorrect ?? 0}%` }}
                    />
                 </div>
                 <p className="text-xs text-muted-foreground">
                    {q.correctCount}/{q.totalAnswered} players correct · {q.points} pt{q.points!== 1 ? "s" : ""}
                 </p>
               </div>
                           ))}
                       </div>
                      )}
                   </CardContent>
                 )}
                </Card>
               </>
              ) : null}
          </>
         )}
     </div>
    );
}


// ─── Sidebar nav ──────────────────────────────────────────────────────────────


// ─── Help section ─────────────────────────────────────────────────────────────


function HelpSection() {
    const sources = [
     { name: "Wikipedia", url: "https://en.wikipedia.org", note: "Well-sourced factual articles" },
  { name: "Britannica", url: "https://www.britannica.com", note: "Encyclopedia witheditorial oversight" },
  { name: "Guinness World Records", url: "https://www.guinnessworldrecords.com", note:"Verified record holders" },
  { name: "World Bank Open Data", url: "https://data.worldbank.org", note: "Countrystatistics and indicators" },
  { name: "Statista", url: "https://www.statista.com", note: "Statistics with cited sources" },
 { name: "Official government sites", url: "", note: "e.g. census.gov, ons.gov.uk, cia.gov/the-world-factbook" },
];


const questionTips = [
  { type: "Multiple Choice", icon: CheckSquare, color: "text-primary", tips: ["Write 4 options— one correct, three plausible wrong.", "Make all options the same length/format so theanswer doesn't stand out.", "Avoid 'all of the above' or 'none of the above' — they muddyscoring."] },
  { type: "True / False", icon: ToggleLeft, color: "text-secondary", tips: ["State the claimclearly and unambiguously — no trick wording.", "Mix True and False answers across yourround.", "Avoid statements that are 'mostly true' or need context to be correct."] },
  { type: "Write-In", icon: PenLine, color: "text-accent", tips: ["The grader is case- andwhitespace-insensitive.", "Pick answers that have one clearly correct form (e.g. a name, ayear, a number).", "Avoid answers that are commonly spelled multiple ways unless youaccept all forms."] },
 { type: "Image Recognition", icon: ImageIcon, color: "text-yellow-400", tips: ["Use a stable,publicly accessible image URL (e.g. Wikimedia Commons).", "Test that the image loadsbefore saving the question.", "Keep the expected answer simple and unambiguous."] },
  { type: "Matching", icon: ArrowLeftRight, color: "text-pink-400", tips: ["Aim for 3–5 pairs —more becomes difficult to read on mobile.", "Left side should be the 'question' (term,country, symbol), right side the 'answer'.", "Pairs are sorted alphabetically by left side beforegrading — keep terms distinct."] },
];


return (
  <div className="space-y-8">
     <div>
     <h2 className="text-xl font-bold tracking-tight">Host Guide</h2>
   <p className="text-muted-foreground text-sm mt-1">
    How to build a great Trivia Night — from game setup to question writing.
   </p>
  </div>


  {/* Quick start */}
  <Card className="border-primary/20 bg-primary/5">
   <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
     <BookOpen className="h-4 w-4 text-primary" />
     Quick-start workflow
    </CardTitle>
   </CardHeader>
   <CardContent className="space-y-0 text-sm">
    {[
      ["Create a game", 'Go to Create Game, enter a topic (e.g. World Geography), pickdifficulty, and set the question count. The game starts in Waiting status.'],
       ["Add questions", 'Go to Add Questions, select your new game, and add one questionat a time. Use real, verified facts — no guessing.'],
     ["Go live", 'When all questions are ready, go to Manage Games and click Go Live.Players in the lobby will be notified instantly.'],
      ["End the game", 'When players have finished answering, click End Game. Everyone isredirected to the results page.'],
    ].map(([step, desc], i) => (
     <div key={i} className="flex gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-fullbg-primary/20 text-xs font-bold text-primary mt-0.5">
          {i + 1}
      </span>
      <div>
          <p className="font-semibold">{step}</p>
          <p className="text-muted-foreground">{desc}</p>
      </div>
     </div>
    ))}
   </CardContent>
  </Card>


  {/* Factual integrity notice */}
  <Card className="border-yellow-500/30 bg-yellow-500/5">
   <CardContent className="p-4 flex gap-3">
    <ShieldAlert className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
    <div className="text-sm space-y-1">
      <p className="font-semibold text-yellow-300">All questions must be factuallyverified</p>
     <p className="text-muted-foreground">
      Before adding any question, confirm the answer from a primary or authoritativesource.
      Do not use AI-generated content, personal memory, or unverified trivia apps as yoursource.
      Incorrect questions damage player trust and undermine the event.
     </p>
    </div>
   </CardContent>
  </Card>


  {/* Difficulty guide */}
  <div>
   <h3 className="font-semibold mb-3 flex items-center gap-2">
    <Lightbulb className="h-4 w-4 text-accent" />
    Difficulty guide
   </h3>
   <div className="grid gap-3 md:grid-cols-3">
    {[
      { level: "Easy", color: "border-green-500/30 bg-green-500/5", badge: "bg-green-500/20text-green-400", desc: "General knowledge most adults know. Good for first rounds ormixed-age crowds. Example: What is the capital of France?" },
      { level: "Medium", color: "border-yellow-500/30 bg-yellow-500/5", badge: "bg-yellow-500/20 text-yellow-400", desc: "Requires some background knowledge. Appropriate for atypical pub quiz. Example: In what year did the Berlin Wall fall?" },
     { level: "Hard", color: "border-red-500/30 bg-red-500/5", badge: "bg-red-500/20 text-red-400", desc: "Specialist or obscure knowledge. Use sparingly — one or two per round.Example: What is the chemical symbol for tungsten?" },
    ].map(({ level, color, badge, desc }) => (
     <Card key={level} className={`border ${color}`}>
         <CardContent className="p-4 space-y-2">
      <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5rounded-full ${badge}`}>
          {level}
         </span>
         <p className="text-sm text-muted-foreground">{desc}</p>
         </CardContent>
   </Card>
  ))}
 </div>
</div>


{/* Question type tips */}
<div>
 <h3 className="font-semibold mb-3 flex items-center gap-2">
  <Star className="h-4 w-4 text-accent" />
  Tips by question type
 </h3>
 <div className="space-y-3">
  {questionTips.map(({ type, icon: Icon, color, tips }) => (
   <Card key={type} className="border-border/40 bg-card/50">
    <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="font-semibold text-sm">{type}</p>
        </div>
        <ul className="space-y-1">
        {tips.map((tip, i) => (
         <li key={i} className="text-sm text-muted-foreground flex gap-2">
          <span className="text-muted-foreground/40 shrink-0">•</span>
          {tip}
         </li>
        ))}
          </ul>
      </CardContent>
     </Card>
    ))}
   </div>
  </div>


  {/* Suggested sources */}
  <div>
   <h3 className="font-semibold mb-3 flex items-center gap-2">
    <ExternalLink className="h-4 w-4 text-secondary" />
    Suggested sources
   </h3>
   <Card className="border-border/40 bg-card/50">
    <CardContent className="p-0">
     {sources.map(({ name, url, note }, i) => (
      <div
          key={name}
       className={`flex items-start gap-3 px-4 py-3 ${i < sources.length - 1 ? "border-bborder-border/30" : ""}`}
      >
          <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
          <div className="min-w-0">
          {url ? (
           <a
            href={url}
                      target="_blank"
                      rel="noopener noreferrer"
         className="text-sm font-semibold text-secondary hover:underline inline-flexitems-center gap-1"
                  >
                      {name}
                      <ExternalLink className="h-3 w-3" />
                  </a>
                 ):(
                  <p className="text-sm font-semibold">{name}</p>
                 )}
                 <p className="text-xs text-muted-foreground">{note}</p>
             </div>
            </div>
           ))}
          </CardContent>
         </Card>
         </div>
     </div>
    );
}


// ─── Nav items────────────────────────────────────────────────────────────────


const NAV_ITEMS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
 { id: "create", label: "Create Game", icon: PlusCircle },
 { id: "manage", label: "Manage Games", icon: Gamepad2 },
 { id: "review", label: "Review Questions", icon: ShieldCheck },
 { id: "settings", label: "Settings", icon: Settings },
 { id: "results", label: "Results", icon: BarChart3 },
 { id: "help", label: "Help & Guide", icon: BookOpen },
];


// ─── AdminDashboard───────────────────────────────────────────────────────────


function AdminDashboard() {
 const { logout } = useAuth();
 const [, setLocation] = useLocation();
 const [section, setSection] = useState<Section>("dashboard");
 const [preferredGameId, setPreferredGameId] = useState<number |undefined>(undefined);
 const [sidebarOpen, setSidebarOpen] = useState(false);


 const { data: games = [] } = useListGames(undefined, {
     query: { queryKey: getListGamesQueryKey(), refetchInterval: 10000 },
 });


 const activeGame = games.find((g) => g.status === "active");


 const navigate = (s: Section, gameId?: number) => {
 setSection(s);
 if (gameId !== undefined) setPreferredGameId(gameId);
 setSidebarOpen(false);
};


const handleCreated = (game: Game) => {
 setPreferredGameId(game.id);
 setSection("questions");
};


const renderSection = () => {
 switch (section) {
     case "dashboard":
     return <DashboardSection games={games} onNavigate={(s) => navigate(s)} />;
     case "create":
     return <CreateGameSection onCreated={handleCreated} />;
     case "manage":
     return (
      <ManageGamesSection
          games={games}
          onManageQuestions={(g) => navigate("questions", g.id)}
      />
     );
     case "questions":
     return <QuestionsSection games={games} preferGameId={preferredGameId} />;
     case "review":
      return <ReviewSection games={games} />;
     case "settings":
      return <SettingsSection />;
     case "results":
      return <ResultsSection games={games} />;
     case "help":
      return <HelpSection />;
 }
};


return (
 <div className="min-h-[100dvh] flex flex-col">
     {/* Top bar */}
  <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center justify-between px-4 h-14 gap-3">
       <div className="flex items-center gap-3">
        <button
         className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
         onClick={() => setSidebarOpen((v) => !v)}
         aria-label="Toggle sidebar"
        >
         <div className="space-y-1">
            <div className="w-5 h-0.5 bg-foreground" />
            <div className="w-5 h-0.5 bg-foreground" />
            <div className="w-5 h-0.5 bg-foreground" />
         </div>
     </button>
     <div className="flex items-center gap-2">
         <Shield className="h-5 w-5 text-primary shrink-0" />
         <span className="font-bold tracking-tight text-lg hidden sm:block">
         HOST CONTROL
         </span>
     </div>
    </div>
    {activeGame && (
     <button
         onClick={() => navigate("manage")}
       className="hidden md:flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/20transition-colors"
     >
         <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
         {activeGame.topic} is live
     </button>
    )}
   </div>
  </header>


  <div className="flex flex-1 relative">
   {/* Sidebar */}
   <aside
    className={`
    fixed inset-y-0 left-0 z-30 w-56 bg-card border-r border-border flex flex-col pt-14
    transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto lg:pt-0
    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
`}
>
<nav className="flex-1 p-3 space-y-1 overflow-y-auto">
    {NAV_ITEMS.map((item) => (
     <button
      key={item.id}
      onClick={() => navigate(item.id)}
      className={`
          w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
          transition-colors text-left
          ${
              section === item.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }
      `}
     >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
     </button>
    ))}
</nav>
<div className="p-3 border-t border-border space-y-2">
        <p className="text-[11px] text-muted-foreground px-3">
        {games.length} game{games.length !== 1 ? "s" : ""} ·{" "}
        {activeGame ? "1 live" : "none live"}
        </p>
        <button
        onClick={async () => { await logout(); setLocation("/"); }}
       className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left text-muted-foreground hover:bg-muted hover:text-foreground"
        >
        <LogOut className="h-4 w-4 shrink-0" />
        Sign out
        </button>
    </div>
   </aside>


   {/* Sidebar overlay on mobile */}
   {sidebarOpen && (
    <div
        className="fixed inset-0 z-20 bg-background/60 backdrop-blur-sm lg:hidden"
        onClick={() => setSidebarOpen(false)}
    />
   )}


   {/* Main content */}
   <main className="flex-1 overflow-y-auto">
    <AnimatePresence mode="wait">
           <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="p-6 max-w-4xl"
           >
            {renderSection()}
           </motion.div>
          </AnimatePresence>
         </main>
         </div>
     </div>
    );
}


// ─── AdminGate────────────────────────────────────────────────────────────────


function AdminGate() {
    const [, setLocation] = useLocation();
    useEffect(() => { setLocation("/admin-login"); }, []);
    return null;
}
// ─── Export───────────────────────────────────────────────────────────────────


export default function Admin() {
    const { isAdmin } = useAuth();
    return isAdmin ? <AdminDashboard /> : <AdminGate />;
}


