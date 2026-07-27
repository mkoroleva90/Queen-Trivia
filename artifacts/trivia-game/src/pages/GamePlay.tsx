
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Trophy,
  Crown,
  Sparkles,
  Loader2,
  Star,
  Check,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Slider } from "@/components/ui/slider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Feedback = {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  timeTaken: string;
  questionId: number;
  questionType: string;
  factCheckUrl?: string | null;
  correctAnswer?: string; // slider only — included in submit response
};

type QuestionStats = {
  totalAnswered: number;
  correctCount: number;
};

// Inline answer-reveal result passed to question components
type FeedbackResult = {
  isCorrect: boolean;
  lockedAnswer: string;
  correctAnswer?: string; // slider only
};

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCorrectAnswer(type: string, answer: string, opts?: Record<string, unknown> | null): string {
  if (type === "image_hotspot") {
    const [x, y] = answer.split(",").map((v) => parseFloat(v).toFixed(1));
    return `Location (${x}%, ${y}%)`;
  }
  if (type === "slider") {
    const unit = typeof opts?.unit === "string" ? ` ${opts.unit}` : "";
    return `${answer}${unit}`;
  }
  if (type === "ordering") {
    return answer.split("|").map((s, i) => `${i + 1}. ${s}`).join("  ");
  }
  if (type === "matching") {
    return answer
      .split("|")
      .map((pair) => {
        const idx = pair.indexOf(":");
        return idx === -1 ? pair : `${pair.slice(0, idx)} → ${pair.slice(idx + 1)}`;
      })
      .join(", ");
  }
  if (type === "multi_select") {
    return answer.split("|").join(", ");
  }
  if (type === "true_false") {
    return answer.charAt(0).toUpperCase() + answer.slice(1);
  }
  return answer;
}

// ─── Shared styled button ─────────────────────────────────────────────────────
function ActionBtn({
  onClick, disabled = false, pending = false, pendingLabel, bg, color, children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || pending}
      className="w-full font-extrabold uppercase text-[15px] disabled:opacity-60"
      style={{
        height: 58, borderRadius: 14,
        background: bg, color,
        letterSpacing: ".08em",
        boxShadow: `0 10px 30px ${bg}55`,
        border: "none",
        cursor: disabled || pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {pendingLabel ?? "…"}
        </span>
      ) : children}
    </button>
  );
}

// ─── Multiple-choice question ─────────────────────────────────────────────────
function MultipleChoiceQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const opts = question.options as { choices?: string[] } | null;
  const choices = opts?.choices ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setSelected(null); }, [question.id]);

  const answered = !!feedbackResult;

  return (
    <div className="flex flex-col gap-[10px]">
      {choices.map((choice, i) => {
        const isLocked        = feedbackResult?.lockedAnswer === choice;
        const isCorrectChoice = isLocked &&  feedbackResult?.isCorrect;
        const isWrongChoice   = isLocked && !feedbackResult?.isCorrect;
        const isDimmed        = answered && !isLocked;
        const isSel           = !answered && selected === choice;

        let border   = "1px solid rgba(255,255,255,.12)";
        let bg       = "rgba(255,255,255,.04)";
        let badgeBg  = "transparent";
        let badgeBorder = "rgba(255,255,255,.3)";
        let badgeColor  = "#a3aec2";
        let glow     = "none";
        let trailing: React.ReactNode = null;

        if (isCorrectChoice) {
          border = "1px solid #00ddff"; bg = "rgba(0,221,255,.15)";
          badgeBg = "#00ddff"; badgeBorder = "#00ddff"; badgeColor = "#0a0510";
          glow = "0 0 22px rgba(0,221,255,.2)";
          trailing = <Check className="h-4 w-4 shrink-0" style={{ color: "#00ddff" }} />;
        } else if (isWrongChoice) {
          border = "1px solid #ff0080"; bg = "rgba(255,0,128,.15)";
          badgeBg = "#ff0080"; badgeBorder = "#ff0080"; badgeColor = "#ffffff";
          trailing = <X className="h-4 w-4 shrink-0" style={{ color: "#ff0080" }} />;
        } else if (isSel) {
          border = "1px solid #ff0080"; bg = "rgba(255,0,128,.12)";
          badgeBg = "#ff0080"; badgeBorder = "#ff0080"; badgeColor = "#ffffff";
        }

        return (
          <motion.button
            key={choice}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isDimmed ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            disabled={disabled || answered}
            onClick={() => !disabled && !answered && setSelected(choice)}
            className="flex items-center gap-3 w-full text-left transition-colors duration-150 focus:outline-none"
            style={{
              borderRadius: 14, padding: "15px 16px",
              background: bg, border, boxShadow: glow,
              cursor: disabled || answered ? "default" : "pointer",
            }}
          >
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: badgeBg, border: `1.5px solid ${badgeBorder}`, color: badgeColor }}
            >
              {CHOICE_LABELS[i]}
            </span>
            <span className="flex-1 font-semibold text-[15px] leading-snug">{choice}</span>
            {trailing}
          </motion.button>
        );
      })}

      {/* Confirm button (pre-answer only) */}
      {!answered && (
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ActionBtn
                onClick={() => onSubmit(selected)}
                disabled={disabled}
                pending={disabled}
                pendingLabel="Submitting…"
                bg="#ff0080"
                color="#ffffff"
              >
                Confirm: {selected}
              </ActionBtn>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Multi-select question ────────────────────────────────────────────────────
function MultiSelectQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const opts = question.options as { choices?: string[] } | null;
  const choices = opts?.choices ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected([]); }, [question.id]);

  const answered = !!feedbackResult;
  const lockedSet = answered
    ? new Set(feedbackResult!.lockedAnswer.split("|").map((s) => s.trim()).filter(Boolean))
    : new Set<string>();

  return (
    <div className="flex flex-col gap-[10px]">
      {!answered && (
        <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: ".15em", color: "#a3aec2" }}>
          Select all that apply
        </p>
      )}

      {choices.map((choice, i) => {
        const isLocked        = lockedSet.has(choice);
        const isCorrectChoice = answered && isLocked &&  feedbackResult!.isCorrect;
        const isWrongChoice   = answered && isLocked && !feedbackResult!.isCorrect;
        const isDimmed        = answered && !isLocked;
        const isSel           = !answered && selected.includes(choice);

        let border      = "1px solid rgba(255,255,255,.12)";
        let bg          = "rgba(255,255,255,.04)";
        let badgeBg     = "transparent";
        let badgeBorder = "rgba(255,255,255,.3)";
        let badgeColor  = "#a3aec2";
        let glow        = "none";
        let trailing: React.ReactNode = null;

        if (isCorrectChoice) {
          border = "1px solid #00ddff"; bg = "rgba(0,221,255,.15)";
          badgeBg = "#00ddff"; badgeBorder = "#00ddff"; badgeColor = "#0a0510";
          glow = "0 0 22px rgba(0,221,255,.2)";
          trailing = <Check className="h-4 w-4 shrink-0" style={{ color: "#00ddff" }} />;
        } else if (isWrongChoice) {
          border = "1px solid #ff0080"; bg = "rgba(255,0,128,.15)";
          badgeBg = "#ff0080"; badgeBorder = "#ff0080"; badgeColor = "#ffffff";
          trailing = <X className="h-4 w-4 shrink-0" style={{ color: "#ff0080" }} />;
        } else if (isSel) {
          border = "1px solid #00ddff"; bg = "rgba(0,221,255,.12)";
          badgeBg = "#00ddff"; badgeBorder = "#00ddff"; badgeColor = "#0a0510";
        }

        const toggle = () => {
          if (disabled || answered) return;
          setSelected((prev) =>
            prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice],
          );
        };

        return (
          <motion.button
            key={choice}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isDimmed ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            disabled={disabled || answered}
            onClick={toggle}
            className="flex items-center gap-3 w-full text-left transition-colors duration-150 focus:outline-none"
            style={{
              borderRadius: 14, padding: "15px 16px",
              background: bg, border, boxShadow: glow,
              cursor: disabled || answered ? "default" : "pointer",
            }}
          >
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: badgeBg, border: `1.5px solid ${badgeBorder}`, color: badgeColor }}
            >
              {CHOICE_LABELS[i]}
            </span>
            <span className="flex-1 font-semibold text-[15px] leading-snug">{choice}</span>
            {trailing}
          </motion.button>
        );
      })}

      {/* Confirm button */}
      {!answered && (
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ActionBtn
                onClick={() => onSubmit([...selected].sort().join("|"))}
                disabled={disabled}
                pending={disabled}
                pendingLabel="Submitting…"
                bg="#ff0080"
                color="#ffffff"
              >
                Confirm {selected.length} selection{selected.length !== 1 ? "s" : ""}
              </ActionBtn>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Ordering question (drag-to-reorder) ─────────────────────────────────────
function SortableItem({
  id, label, index, answered, isCorrect,
}: {
  id: string;
  label: string;
  index: number;
  answered: boolean;
  isCorrect: boolean | null; // null = not answered yet
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  let border   = "1px solid rgba(255,255,255,.12)";
  let bg       = "rgba(255,255,255,.04)";
  let numColor = "#a3aec2";

  if (answered && isCorrect === true) {
    border = "1px solid #00ddff"; bg = "rgba(0,221,255,.15)"; numColor = "#00ddff";
  } else if (answered && isCorrect === false) {
    border = "1px solid #ff0080"; bg = "rgba(255,0,128,.15)"; numColor = "#ff0080";
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderRadius: 14,
        padding: "13px 16px",
        background: bg,
        border,
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: answered ? "default" : isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.7 : 1,
        userSelect: "none",
      }}
      {...attributes}
      {...(!answered ? listeners : {})}
    >
      {/* Position number */}
      <span
        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{ background: "rgba(255,255,255,.06)", color: numColor }}
      >
        {index + 1}
      </span>
      <span className="flex-1 font-semibold text-[15px] leading-snug">{label}</span>
      {!answered && (
        <GripVertical className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,.3)" }} />
      )}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function OrderingQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const opts    = question.options as { items?: string[] } | null;
  const correct = (opts?.items ?? []);

  const [items, setItems] = useState<string[]>(() => shuffle(correct));
  useEffect(() => { setItems(shuffle(correct)); }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const answered = !!feedbackResult;
  const lockedItems = answered
    ? feedbackResult!.lockedAnswer.split("|").map((s) => s.trim()).filter(Boolean)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const displayItems = lockedItems ?? items;

  return (
    <div className="flex flex-col gap-[10px]">
      {!answered && (
        <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: ".15em", color: "#a3aec2" }}>
          Drag to put in the correct order
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayItems} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-[8px]">
            {displayItems.map((item, i) => {
              const posCorrect = answered ? normalize_item(item) === normalize_item(correct[i] ?? "") : null;
              return (
                <SortableItem
                  key={item}
                  id={item}
                  label={item}
                  index={i}
                  answered={answered}
                  isCorrect={posCorrect}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!answered && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <ActionBtn
            onClick={() => onSubmit(items.join("|"))}
            disabled={disabled}
            pending={disabled}
            pendingLabel="Submitting…"
            bg="#ff0080"
            color="#ffffff"
          >
            Lock in order →
          </ActionBtn>
        </motion.div>
      )}
    </div>
  );
}

// Simple normalize for positional comparison (no need for the full normalize() from grading)
function normalize_item(s: string) {
  return s.trim().toLowerCase();
}

// ─── True/false question ──────────────────────────────────────────────────────
function TrueFalseQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const [selected, setSelected] = useState<"true" | "false" | null>(null);
  useEffect(() => { setSelected(null); }, [question.id]);

  const answered = !!feedbackResult;

  return (
    <div className="flex flex-col gap-[10px]">
      {(["true", "false"] as const).map((val, i) => {
        const isLocked        = feedbackResult?.lockedAnswer === val;
        const isCorrectChoice = isLocked &&  feedbackResult?.isCorrect;
        const isWrongChoice   = isLocked && !feedbackResult?.isCorrect;
        const isDimmed        = answered && !isLocked;
        const isSel           = !answered && selected === val;

        let border  = "1px solid rgba(255,255,255,.12)";
        let bg      = "rgba(255,255,255,.04)";
        let badgeBg = "transparent";
        let badgeBorder = "rgba(255,255,255,.3)";
        let badgeColor  = "#a3aec2";
        let trailing: React.ReactNode = null;

        if (isCorrectChoice) {
          border = "1px solid #00ddff"; bg = "rgba(0,221,255,.15)";
          badgeBg = "#00ddff"; badgeBorder = "#00ddff"; badgeColor = "#0a0510";
          trailing = <Check className="h-4 w-4 shrink-0" style={{ color: "#00ddff" }} />;
        } else if (isWrongChoice) {
          border = "1px solid #ff0080"; bg = "rgba(255,0,128,.15)";
          badgeBg = "#ff0080"; badgeBorder = "#ff0080"; badgeColor = "#ffffff";
          trailing = <X className="h-4 w-4 shrink-0" style={{ color: "#ff0080" }} />;
        } else if (isSel) {
          border = "1px solid #ff0080"; bg = "rgba(255,0,128,.12)";
          badgeBg = "#ff0080"; badgeBorder = "#ff0080"; badgeColor = "#ffffff";
        }

        return (
          <motion.button
            key={val}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: isDimmed ? 0.45 : 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            disabled={disabled || answered}
            onClick={() => !disabled && !answered && setSelected(val)}
            className="flex items-center gap-3 w-full text-left transition-colors duration-150 focus:outline-none"
            style={{
              borderRadius: 14, padding: "15px 16px",
              background: bg, border,
              cursor: disabled || answered ? "default" : "pointer",
            }}
          >
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: badgeBg, border: `1.5px solid ${badgeBorder}`, color: badgeColor }}
            >
              {val === "true" ? "T" : "F"}
            </span>
            <span className="flex-1 font-semibold text-[15px]">
              {val === "true" ? "True" : "False"}
            </span>
            {trailing}
          </motion.button>
        );
      })}

      {!answered && (
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ActionBtn
                onClick={() => onSubmit(selected)}
                disabled={disabled}
                pending={disabled}
                pendingLabel="Submitting…"
                bg="#ff0080"
                color="#ffffff"
              >
                Confirm: {selected === "true" ? "True" : "False"}
              </ActionBtn>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Write-in question (unchanged logic, refreshed style) ─────────────────────
function WriteInQuestion({
  question, onSubmit, disabled,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
}) {
  const [val, setVal] = useState("");
  useEffect(() => { setVal(""); }, [question.id]);
  return (
    <form className="flex flex-col gap-3"
      onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSubmit(val.trim()); }}>
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Type your answer…"
        className="h-14 text-lg"
        disabled={disabled}
        autoFocus
        style={{
          background: "rgba(0,0,0,.35)",
          border: "2px solid rgba(255,255,255,.2)",
          borderRadius: 14,
          color: "#ffffff",
        }}
      />
      <ActionBtn
        onClick={() => { if (val.trim()) onSubmit(val.trim()); }}
        disabled={!val.trim() || disabled}
        pending={disabled}
        pendingLabel="Submitting…"
        bg="#ff0080"
        color="#ffffff"
      >
        Lock It In
      </ActionBtn>
    </form>
  );
}

// ─── Image question (unchanged logic, refreshed style) ────────────────────────
function ImageQuestion({
  question, onSubmit, disabled,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
}) {
  const [val, setVal] = useState("");
  useEffect(() => { setVal(""); }, [question.id]);
  return (
    <div className="flex flex-col gap-4">
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-xl border border-border/50 bg-background/60"
        >
          <img src={question.imageUrl} alt="Identify this"
            className="w-full max-h-80 object-contain" />
        </motion.div>
      )}
      <form className="flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSubmit(val.trim()); }}>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Your answer…"
          className="h-14 text-lg"
          disabled={disabled}
          autoFocus
          style={{
            background: "rgba(0,0,0,.35)",
            border: "2px solid rgba(255,255,255,.2)",
            borderRadius: 14,
            color: "#ffffff",
          }}
        />
        <ActionBtn
          onClick={() => { if (val.trim()) onSubmit(val.trim()); }}
          disabled={!val.trim() || disabled}
          pending={disabled}
          pendingLabel="Submitting…"
          bg="#ff0080"
          color="#ffffff"
        >
          Lock It In
        </ActionBtn>
      </form>
    </div>
  );
}

// ─── Image hotspot question (tap the correct spot) ────────────────────────────
function ImageHotspotQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => { setTap(null); }, [question.id]);

  const answered   = !!feedbackResult;
  const playerTap  = answered
    ? (() => { const [x, y] = feedbackResult!.lockedAnswer.split(",").map(Number); return { x: x!, y: y! }; })()
    : tap;
  const correctTap = answered && feedbackResult!.correctAnswer
    ? (() => { const [x, y] = feedbackResult!.correctAnswer.split(",").map(Number); return { x: x!, y: y! }; })()
    : null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || answered) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = ((e.clientX - rect.left) / rect.width)  * 100;
    const y    = ((e.clientY - rect.top)  / rect.height) * 100;
    setTap({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) });
  };

  if (!question.imageUrl) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Tappable image container */}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          border: "1px solid rgba(255,255,255,.12)",
          cursor: answered ? "default" : "crosshair",
          userSelect: "none",
        }}
        onClick={handleClick}
      >
        <img
          src={question.imageUrl}
          alt="Tap the correct location"
          className="w-full block"
          style={{ maxHeight: 320, objectFit: "contain", display: "block" }}
          draggable={false}
        />

        {/* Player's tap marker (pink) */}
        {playerTap && (
          <div
            style={{
              position: "absolute",
              left: `${playerTap.x}%`,
              top:  `${playerTap.y}%`,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
            }}
          >
            {/* Pin shape */}
            <svg width="28" height="36" viewBox="0 0 28 36">
              <circle cx="14" cy="14" r="12" fill="#ff0080" stroke="white" strokeWidth="2" />
              <polygon points="14,36 7,22 21,22" fill="#ff0080" />
            </svg>
          </div>
        )}

        {/* Correct location marker (cyan) — shown after reveal if wrong */}
        {answered && correctTap && !feedbackResult!.isCorrect && (
          <div
            style={{
              position: "absolute",
              left: `${correctTap.x}%`,
              top:  `${correctTap.y}%`,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
            }}
          >
            <svg width="28" height="36" viewBox="0 0 28 36">
              <circle cx="14" cy="14" r="12" fill="#00ddff" stroke="white" strokeWidth="2" />
              <polygon points="14,36 7,22 21,22" fill="#00ddff" />
              <text x="14" y="19" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0a0510">✓</text>
            </svg>
          </div>
        )}

        {/* Single cyan pin when correct */}
        {answered && feedbackResult!.isCorrect && playerTap && (
          <div
            style={{
              position: "absolute",
              left: `${playerTap.x}%`,
              top:  `${playerTap.y}%`,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
            }}
          >
            <svg width="28" height="36" viewBox="0 0 28 36">
              <circle cx="14" cy="14" r="12" fill="#00ddff" stroke="white" strokeWidth="2" />
              <polygon points="14,36 7,22 21,22" fill="#00ddff" />
              <text x="14" y="19" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0a0510">✓</text>
            </svg>
          </div>
        )}

        {/* Tap prompt overlay when no tap yet */}
        {!answered && !tap && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,.3)", pointerEvents: "none" }}
          >
            <p className="text-white font-bold text-[15px]" style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>
              Tap to mark your answer
            </p>
          </div>
        )}
      </div>

      {/* Legend after answer */}
      {answered && !feedbackResult!.isCorrect && correctTap && (
        <div className="flex justify-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff0080" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#ff0080" }}>Your guess</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#00ddff" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#00ddff" }}>Correct location</span>
          </div>
        </div>
      )}

      {/* Confirm button */}
      {!answered && tap && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <ActionBtn
            onClick={() => onSubmit(`${tap.x},${tap.y}`)}
            disabled={disabled}
            pending={disabled}
            pendingLabel="Submitting…"
            bg="#ff0080"
            color="#ffffff"
          >
            Confirm location →
          </ActionBtn>
        </motion.div>
      )}
    </div>
  );
}

// ─── Slider question (numeric estimation) ─────────────────────────────────────
function SliderQuestion({
  question, onSubmit, disabled, feedbackResult,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
  feedbackResult: FeedbackResult | null;
}) {
  const opts       = question.options as { min?: number; max?: number; step?: number; unit?: string } | null;
  const min        = opts?.min  ?? 0;
  const max        = opts?.max  ?? 100;
  const step       = opts?.step ?? 1;
  const unit       = opts?.unit ?? "";
  const initialVal = Math.round(((min + max) / 2) / step) * step;

  const [value, setValue] = useState(initialVal);
  useEffect(() => { setValue(Math.round(((min + max) / 2) / step) * step); }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const answered   = !!feedbackResult;
  const playerVal  = answered ? parseFloat(feedbackResult!.lockedAnswer) : value;
  const correctVal = answered && feedbackResult!.correctAnswer !== undefined
    ? parseFloat(feedbackResult!.correctAnswer)
    : null;

  const toPct      = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const playerPct  = toPct(playerVal);
  const correctPct = correctVal !== null ? toPct(correctVal) : null;

  const fmtVal = (v: number) => `${v.toLocaleString()}${unit ? ` ${unit}` : ""}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Live value display */}
      {!answered && (
        <div className="text-center py-2">
          <span
            className="font-extrabold tabular-nums"
            style={{ fontSize: 52, color: "#ffe500", letterSpacing: "-.02em" }}
          >
            {value.toLocaleString()}
          </span>
          {unit && (
            <span className="ml-2 font-semibold text-[20px]" style={{ color: "#a3aec2" }}>
              {unit}
            </span>
          )}
        </div>
      )}

      {/* Active slider */}
      {!answered && (
        <div className="px-1">
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value]}
            onValueChange={([v]) => v !== undefined && setValue(v)}
            className="w-full [&_[data-slot=range]]:bg-yellow-400 [&_[data-slot=thumb]]:border-yellow-400 [&_[data-slot=thumb]]:bg-yellow-400"
          />
          <div className="flex justify-between mt-2">
            <span className="text-[12px]" style={{ color: "#a3aec2" }}>{fmtVal(min)}</span>
            <span className="text-[12px]" style={{ color: "#a3aec2" }}>{fmtVal(max)}</span>
          </div>
        </div>
      )}

      {/* Reveal: dual-marker track */}
      {answered && correctPct !== null && (
        <div className="px-1 py-2">
          {/* Track + markers */}
          <div className="relative" style={{ height: 52 }}>
            {/* Base track */}
            <div
              className="absolute"
              style={{ top: 22, left: 0, right: 0, height: 4, borderRadius: 2, background: "rgba(255,255,255,.15)" }}
            >
              {/* Bridge between the two thumbs */}
              <div style={{
                position: "absolute",
                left: `${Math.min(playerPct, correctPct) * 100}%`,
                width: `${Math.abs(playerPct - correctPct) * 100}%`,
                height: "100%",
                background: "rgba(255,255,255,.2)",
              }} />
            </div>
            {/* Player thumb (pink) */}
            <div style={{ position: "absolute", top: 12, left: `calc(${playerPct * 100}% - 10px)` }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "#ff0080",
                boxShadow: "0 0 14px rgba(255,0,128,.55)",
                border: "2px solid rgba(255,255,255,.25)",
              }} />
            </div>
            {/* Correct thumb (cyan) */}
            <div style={{ position: "absolute", top: 12, left: `calc(${correctPct * 100}% - 10px)` }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "#00ddff",
                boxShadow: "0 0 14px rgba(0,221,255,.55)",
                border: "2px solid rgba(255,255,255,.25)",
              }} />
            </div>
          </div>
          {/* Labels */}
          <div className="flex justify-between text-[12px] mt-1" style={{ color: "#a3aec2" }}>
            <span>{fmtVal(min)}</span>
            <span>{fmtVal(max)}</span>
          </div>
          <div className="flex justify-center gap-6 mt-3">
            <div className="text-center">
              <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: "#ff0080" }} />
              <p className="text-[13px] font-bold" style={{ color: "#ff0080" }}>You</p>
              <p className="text-[13px] font-semibold text-white">{fmtVal(playerVal)}</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: "#00ddff" }} />
              <p className="text-[13px] font-bold" style={{ color: "#00ddff" }}>Answer</p>
              <p className="text-[13px] font-semibold text-white">{fmtVal(correctVal!)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm button */}
      {!answered && (
        <ActionBtn
          onClick={() => onSubmit(String(value))}
          disabled={disabled}
          pending={disabled}
          pendingLabel="Submitting…"
          bg="#ffe500"
          color="#0a0510"
        >
          Lock in {fmtVal(value)} →
        </ActionBtn>
      )}
    </div>
  );
}

// ─── Matching board (unchanged logic, refreshed style) ────────────────────────
function MatchingBoard({
  question, onSubmit, disabled,
}: {
  question: Question;
  onSubmit: (a: string) => void;
  disabled: boolean;
}) {
  const pairs = useMemo(() => {
    const opts = question.options as { pairs?: { left: string; right: string }[] } | null;
    return opts?.pairs ?? [];
  }, [question.options]);

  const shuffledRights = useMemo(
    () => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5),
    [pairs],
  );
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
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Match each item on the left with its answer on the right.
      </p>
      {pairs.map((p) => (
        <div key={p.left} className="flex items-center gap-3">
          <div
            className="flex-1 rounded-md px-4 py-3 font-medium text-sm"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}
          >
            {p.left}
          </div>
          <span className="text-muted-foreground shrink-0">→</span>
          <Select
            value={choices[p.left] ?? ""}
            onValueChange={(v) => setChoices((c) => ({ ...c, [p.left]: v }))}
            disabled={disabled}
          >
            <SelectTrigger
              className={`flex-1 ${choices[p.left] ? "border-secondary/50 bg-secondary/5" : ""}`}
            >
              <SelectValue placeholder="Match with…" />
            </SelectTrigger>
            <SelectContent>
              {shuffledRights.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <ActionBtn
        onClick={submit}
        disabled={!allChosen || disabled}
        pending={disabled}
        pendingLabel="Submitting…"
        bg="#ff0080"
        color="#ffffff"
      >
        Lock In Matches
      </ActionBtn>
    </div>
  );
}

// ─── Main GamePlay ────────────────────────────────────────────────────────────

export default function GamePlay() {
  const params = useParams<{ id: string }>();
  const gameId = Number(params.id);
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Existing state ──
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const questionStartRef = useRef<number>(Date.now());

  // ── New display state (UI only) ──
  const [lockedAnswer, setLockedAnswer] = useState<string | null>(null);

  useGameSocket(gameId || null, {
    onAnswerSubmitted: ({ playerName, isCorrect }) => {
      queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId) });
      toast({
        title: isCorrect ? `🎉 ${playerName} got it right!` : `⚡ ${playerName} just answered`,
        duration: 2500,
      });
    },
    onGameEnded: () => {
      toast({ title: "🏆 Game over! Redirecting to results…" });
      setTimeout(() => setLocation(`/results/${gameId}`), 1500);
    },
  });

  const { data: game } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
  });
  const { data: questions } = useListGameQuestions(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameQuestionsQueryKey(gameId), refetchInterval: 10000 },
  });
  const { data: myAnswers } = useListUserAnswers(gameId, userId, {
    query: { enabled: !!gameId && !!userId, queryKey: getListUserAnswersQueryKey(gameId, userId) },
  });
  const { data: participants } = useListGameParticipants(gameId, {
    query: { enabled: !!gameId, queryKey: getListGameParticipantsQueryKey(gameId), refetchInterval: 5000 },
  });

  // Stats query for answered question (moved from FeedbackOverlay, same logic)
  const { data: questionStats } = useQuery<QuestionStats>({
    queryKey: ["question-stats", gameId, feedback?.questionId],
    queryFn: () =>
      fetch(`/api/games/${gameId}/questions/${feedback!.questionId}/answers`).then((r) => r.json()),
    enabled: !!feedback,
    refetchInterval: 3000,
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

  const current          = sorted.find((q) => !answeredIds.has(q.id));
  const answeredCount    = sorted.filter((q) => answeredIds.has(q.id)).length;
  const total            = sorted.length;
  const isLastQuestion   = !!current && sorted.indexOf(current) === total - 1;

  const sortedParticipants = useMemo(
    () => [...(participants ?? [])].sort((a, b) => b.totalScore - a.totalScore),
    [participants],
  );
  const myScore = participants?.find((p) => p.userId === userId)?.totalScore ?? 0;
  const myRank  = sortedParticipants.findIndex((p) => p.userId === userId) + 1;

  // Reset timer when question changes
  useEffect(() => {
    if (current?.id) questionStartRef.current = Date.now();
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
            correctAnswer: (res as typeof res & { correctAnswer?: string }).correctAnswer,
          });
          setLockedAnswer(userAnswer); // store for inline reveal
          queryClient.invalidateQueries({ queryKey: getListGameParticipantsQueryKey(gameId) });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("409") || msg.toLowerCase().includes("already answered")) {
            nextQuestion();
            return;
          }
          toast({ variant: "destructive", title: "Could not submit answer", description: "Please try again." });
        },
      },
    );
  };

  const nextQuestion = () => {
    setFeedback(null);
    setLockedAnswer(null);
    queryClient.invalidateQueries({ queryKey: getListUserAnswersQueryKey(gameId, userId) });
  };

  const renderQuestion = (q: Question) => {
    const fr: FeedbackResult | null = feedback?.questionId === q.id
      ? { isCorrect: feedback.isCorrect, lockedAnswer: lockedAnswer ?? "", correctAnswer: feedback.correctAnswer }
      : null;
    const sub = { question: q, disabled: submitAnswer.isPending };
    switch (q.questionType) {
      case "multiple_choice":
        return <MultipleChoiceQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "multi_select":
        return <MultiSelectQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "slider":
        return <SliderQuestion key={q.id} {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "ordering":
        return <OrderingQuestion key={q.id} {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "true_false":
        return <TrueFalseQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "matching":
        return <MatchingBoard key={q.id} {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
      case "image_recognition":
        return <ImageQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
      case "image_hotspot":
        return <ImageHotspotQuestion key={q.id} {...sub} onSubmit={(a) => handleSubmit(q, a)} feedbackResult={fr} />;
      case "write_in":
        return <WriteInQuestion {...sub} onSubmit={(a) => handleSubmit(q, a)} />;
      default:
        return null;
    }
  };

  if (!user) return null;

  // ── Question category label ──
  const categoryLabel = current
    ? current.questionType.replace(/_/g, " ").toUpperCase()
    : null;

  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

          {/* ── Main question column ── */}
          <div className="px-[22px] pt-12 pb-16 space-y-5">

            {/* Back button */}
            <button
              onClick={() => setLocation("/lobby")}
              className="flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(255,255,255,.08)", border: "none", cursor: "pointer",
              }}
              aria-label="Back to lobby"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>

            {/* Header row: question counter + score pill */}
            {total > 0 && (
              <div className="flex items-center justify-between">
                <span
                  className="font-bold uppercase"
                  style={{ fontSize: 10, letterSpacing: ".24em", color: "#a3aec2" }}
                >
                  Question {Math.min(answeredCount + 1, total)} / {total}
                </span>
                <div
                  className="flex items-center gap-1.5 font-extrabold"
                  style={{
                    fontSize: 14,
                    background: "#ffe500",
                    color: "#0a0510",
                    borderRadius: 20,
                    padding: "5px 14px",
                    boxShadow: "0 4px 16px rgba(255,229,0,.4)",
                  }}
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {myScore}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {total > 0 && (
              <div
                className="h-[6px] rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,.10)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(answeredCount / total) * 100}%`,
                    background: "linear-gradient(90deg,#ff0080,#ffe500)",
                  }}
                />
              </div>
            )}

            {/* AnimatePresence wrapper */}
            <AnimatePresence mode="wait">
              {total === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div
                    className="rounded-[20px] p-10 text-center space-y-4"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.1)" }}
                  >
                    <Sparkles className="mx-auto h-12 w-12" style={{ color: "rgba(255,0,128,.5)" }} />
                    <h3 className="text-2xl font-bold">Questions loading soon</h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-sm">
                      The host hasn't added questions yet — this page checks automatically.
                    </p>
                  </div>
                </motion.div>

              ) : current ? (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                  className="space-y-5"
                >
                  {/* Category + points chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: 10, letterSpacing: ".12em",
                        background: "rgba(0,221,255,.12)",
                        color: "#00ddff",
                        border: "1px solid rgba(0,221,255,.3)",
                        borderRadius: 8, padding: "5px 10px",
                      }}
                    >
                      {categoryLabel}
                    </span>
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: 10, letterSpacing: ".12em",
                        background: "rgba(255,229,0,.10)",
                        color: "#ffe500",
                        border: "1px solid rgba(255,229,0,.3)",
                        borderRadius: 8, padding: "5px 10px",
                      }}
                    >
                      {current.points} PTS
                    </span>
                  </div>

                  {/* Question text */}
                  <h2
                    className="font-extrabold text-white"
                    style={{ fontSize: 22, lineHeight: 1.22, letterSpacing: "-.01em" }}
                  >
                    {current.questionText}
                  </h2>

                  {/* Image (if present) */}
                  {current.imageUrl && current.questionType !== "image_recognition" && current.questionType !== "image_hotspot" && (
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-background/60">
                      <img src={current.imageUrl} alt="" className="w-full max-h-60 object-contain" />
                    </div>
                  )}

                  {/* Answer choices */}
                  {renderQuestion(current)}

                  {/* Hint / feedback footer */}
                  <AnimatePresence mode="wait">
                    {feedback ? (
                      <motion.div
                        key="feedback"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3 pt-2"
                      >
                        {/* Compact stats row */}
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          <span
                            className="font-extrabold text-sm"
                            style={{ color: feedback.isCorrect ? "#00ddff" : "#ff0080" }}
                          >
                            {feedback.isCorrect ? "Correct!" : "Not quite —"}{" "}
                            {feedback.pointsEarned > 0 ? `+${feedback.pointsEarned}` : "0"} pts
                          </span>
                          {questionStats && (
                            <>
                              <span style={{ color: "#475569" }}>·</span>
                              <span className="text-sm text-muted-foreground">
                                {questionStats.correctCount}/{questionStats.totalAnswered} got it right
                              </span>
                            </>
                          )}
                          {feedback.factCheckUrl && (
                            <>
                              <span style={{ color: "#475569" }}>·</span>
                              <a
                                href={feedback.factCheckUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-secondary underline underline-offset-2"
                              >
                                Source ↗
                              </a>
                            </>
                          )}
                        </div>

                        {/* Advance CTA */}
                        <button
                          onClick={isLastQuestion ? () => setLocation(`/results/${gameId}`) : nextQuestion}
                          className="w-full font-extrabold uppercase text-[15px]"
                          style={{
                            height: 58, borderRadius: 14,
                            background: "#ffe500", color: "#0a0510",
                            letterSpacing: ".08em",
                            boxShadow: "0 10px 30px rgba(255,229,0,.4)",
                            border: "none", cursor: "pointer",
                          }}
                        >
                          {isLastQuestion ? "SEE RESULTS →" : "NEXT →"}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center animate-pulse"
                        style={{ fontSize: 12, fontWeight: 500, color: "#8b7ea3" }}
                      >
                        Tap your answer — the clock's ticking
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

              ) : (
                /* All done */
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                >
                  <div
                    className="rounded-[20px] p-10 text-center space-y-5"
                    style={{
                      background: "linear-gradient(160deg,rgba(255,229,0,.12),rgba(255,229,0,.04))",
                      border: "1.5px solid rgba(255,229,0,.4)",
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.5, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 18 }}
                    >
                      <Trophy className="mx-auto h-16 w-16 text-accent" />
                    </motion.div>
                    <div>
                      <h2 className="text-3xl font-extrabold text-white">THAT'S A WRAP!</h2>
                      <p className="text-lg mt-2">
                        You finished with{" "}
                        <span className="font-bold text-accent">{myScore} points</span>
                        {myRank > 0 && (
                          <span className="text-muted-foreground"> · Rank #{myRank}</span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
                        Watch the leaderboard — other players are still answering.
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center flex-wrap pt-2">
                      <button
                        onClick={() => setLocation(`/results/${gameId}`)}
                        className="font-extrabold uppercase text-[14px] px-8"
                        style={{
                          height: 52, borderRadius: 14,
                          background: "#ffe500", color: "#0a0510",
                          boxShadow: "0 8px 24px rgba(255,229,0,.4)",
                          border: "none", cursor: "pointer",
                          letterSpacing: ".06em",
                        }}
                      >
                        View Results
                      </button>
                      <button
                        onClick={() => setLocation("/lobby")}
                        className="font-bold px-8 text-[14px]"
                        style={{
                          height: 52, borderRadius: 14,
                          background: "rgba(255,255,255,.08)",
                          color: "#ffffff",
                          border: "1px solid rgba(255,255,255,.14)",
                          cursor: "pointer",
                        }}
                      >
                        Back to Lobby
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Sidebar: live leaderboard (desktop only) ── */}
          <aside className="hidden lg:block px-0 pt-12 pb-16 pr-6">
            <div
              className="sticky top-4 rounded-[20px] overflow-hidden"
              style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              <div className="px-5 py-4 border-b border-white/10">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-accent" /> Live Leaderboard
                </p>
              </div>
              <div className="px-4 py-3 space-y-1">
                {sortedParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No players yet.</p>
                ) : (
                  sortedParticipants.map((p, i) => {
                    const isMe = p.userId === userId;
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                        style={{
                          background: isMe ? "rgba(255,229,0,.08)" : "rgba(255,255,255,.03)",
                          boxShadow: isMe ? "inset 2px 0 0 #ffe500" : "none",
                        }}
                      >
                        <span className="w-5 text-center text-xs font-bold tabular-nums text-muted-foreground shrink-0">
                          {i === 0
                            ? <Crown className="h-3.5 w-3.5 text-accent mx-auto" />
                            : <span className="text-xs">{i + 1}</span>}
                        </span>
                        <span className="flex-1 truncate text-sm font-medium" style={{ color: isMe ? "#ffe500" : undefined }}>
                          {p.userName}
                          {isMe && <span className="text-[10px] ml-1 opacity-70">(you)</span>}
                        </span>
                        <span
                          className="font-bold tabular-nums text-sm shrink-0"
                          style={{ color: isMe ? "#ffe500" : "#a3aec2" }}
                        >
                          {p.totalScore}
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
      <Footer />
    </div>
  );
}
