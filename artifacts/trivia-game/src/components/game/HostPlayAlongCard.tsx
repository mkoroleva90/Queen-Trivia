/**
 * HostPlayAlongCard — renders the current unanswered question for a playing host.
 *
 * Reuses the same question components as the regular player screen (GamePlay.tsx),
 * so every question type that players can answer is also available to the host.
 * Feedback is shown inline after submission (correct/wrong + points), then the
 * host advances via "Next question" or "See results" — exactly like a player.
 */

import { useState, useEffect } from "react";
import type { Question } from "@workspace/api-client-react";
import { COPY } from "@workspace/copy";
import {
  MultipleChoiceQuestion,
  MultiSelectQuestion,
  OrderingQuestion,
  TrueFalseQuestion,
  WriteInQuestion,
  ImageQuestion,
  ImageHotspotQuestion,
  ShortResponseQuestion,
  SliderQuestion,
  MatchingBoard,
  ActionBtn,
  type FeedbackResult,
} from "@/pages/GamePlay";
import { Check, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HostAnswerResult = {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  feedback?: string;
};

interface HostPlayAlongCardProps {
  question: Question;
  /** Called when the host submits; parent handles the fetch and returns the result. */
  onSubmit: (questionId: number, answer: string) => Promise<HostAnswerResult | null>;
  /** True while the fetch is in-flight. */
  submitting: boolean;
  /** True when there are still unanswered questions after this one. */
  hasMore: boolean;
  /**
   * Called when the host presses "Next question" or "See results".
   * Receives the question id and the answer the host submitted, so the parent
   * can persist it to hostAnswers — which advances currentPlayingQ — only
   * after the host has acknowledged the feedback.
   */
  onNext: (questionId: number, answer: string) => void;
  /** True when there is more than one unanswered question (so deferring is possible). */
  canSkip: boolean;
  /** Called when the host defers (skips) this question without answering. */
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HostPlayAlongCard({
  question,
  onSubmit,
  submitting,
  hasMore,
  onNext,
  canSkip,
  onSkip,
}: HostPlayAlongCardProps) {
  // Local state: reset when question changes (parent also keys this component on question.id)
  const [localAnswer, setLocalAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<HostAnswerResult | null>(null);

  useEffect(() => {
    setLocalAnswer(null);
    setResult(null);
  }, [question.id]);

  const answered = result !== null;

  const handleSubmit = async (answer: string) => {
    if (submitting || answered) return;
    const r = await onSubmit(question.id, answer);
    if (r) {
      setLocalAnswer(answer);
      setResult(r);
    }
  };

  // Build the FeedbackResult shape that question components use for inline reveal
  const feedbackResult: FeedbackResult | null =
    answered && localAnswer !== null
      ? { isCorrect: result!.isCorrect, lockedAnswer: localAnswer }
      : null;

  const renderQuestion = () => {
    const sub = { question, disabled: submitting || answered };
    switch (question.questionType) {
      case "multiple_choice":
        return (
          <MultipleChoiceQuestion
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "multi_select":
        return (
          <MultiSelectQuestion
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "slider":
        return (
          <SliderQuestion
            key={question.id}
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "ordering":
        return (
          <OrderingQuestion
            key={question.id}
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "true_false":
        return (
          <TrueFalseQuestion
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "matching":
        return (
          <MatchingBoard key={question.id} {...sub} onSubmit={handleSubmit} />
        );
      case "image_recognition":
        return <ImageQuestion {...sub} onSubmit={handleSubmit} />;
      case "image_hotspot":
        return (
          <ImageHotspotQuestion
            key={question.id}
            {...sub}
            onSubmit={handleSubmit}
            feedbackResult={feedbackResult}
          />
        );
      case "short_response":
        return (
          <ShortResponseQuestion
            {...sub}
            onSubmit={handleSubmit}
            options={question.options as { maxWords?: number } | null}
          />
        );
      case "write_in":
        return <WriteInQuestion {...sub} onSubmit={handleSubmit} />;
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-[#1b2740] space-y-4">
      {renderQuestion()}

      {/* ── Feedback card — shown after submission ── */}
      {answered && result && (
        <div
          className={`rounded-xl border px-4 py-4 ${
            result.isCorrect
              ? "border-[#00ddff]/40 bg-[#00ddff]/[.08]"
              : "border-[#ff0080]/40 bg-[#ff0080]/[.08]"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            {result.isCorrect ? (
              <Check className="h-5 w-5 shrink-0 text-[#00ddff]" />
            ) : (
              <X className="h-5 w-5 shrink-0 text-[#ff5aa8]" />
            )}
            <div className="flex-1">
              <p
                className={`font-extrabold text-sm ${
                  result.isCorrect ? "text-[#00ddff]" : "text-[#ff5aa8]"
                }`}
              >
                {result.isCorrect
                  ? COPY.gameplay.feedbackCorrect
                  : COPY.gameplay.feedbackWrong}
              </p>
              <p className="text-[12px] text-[#9aa6bc] mt-0.5">
                +{result.pointsEarned} pts · total {result.totalScore}
              </p>
            </div>
          </div>

          {result.feedback && (
            <p className="text-[13px] text-[#9aa6bc] leading-relaxed mb-3">
              {result.feedback}
            </p>
          )}

          <ActionBtn
            onClick={() => onNext(question.id, localAnswer!)}
            bg={result.isCorrect ? "#00ddff" : "#1b2740"}
            color={result.isCorrect ? "#0a0510" : "#eef2f8"}
          >
            {hasMore
              ? COPY.hostPlayAlong.nextQuestionBtn
              : COPY.hostPlayAlong.endGameBtn}
          </ActionBtn>
        </div>
      )}

      {/* ── Skip affordance — only before answering ── */}
      {!answered && canSkip && (
        <button
          onClick={onSkip}
          className="w-full text-center text-xs font-semibold text-[#66728a] hover:text-[#9aa6bc] py-1 transition"
        >
          {COPY.hostPlayAlong.skipBtn}
        </button>
      )}
    </div>
  );
}
