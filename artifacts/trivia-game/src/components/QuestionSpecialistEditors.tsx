import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { COPY } from "@workspace/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MultiSelectChoice = {
  text: string;
  correct: boolean;
};

type SpecialistEditorsProps = {
  questionType: "ordering" | "multi_select" | "slider" | "short_response";
  orderingItems: string[];
  onOrderingItemsChange: (items: string[]) => void;
  multiSelectChoices: MultiSelectChoice[];
  onMultiSelectChoicesChange: (choices: MultiSelectChoice[]) => void;
  sliderMin: string;
  sliderMax: string;
  sliderStep: string;
  sliderUnit: string;
  sliderTolerance: string;
  sliderAnswer: string;
  onSliderFieldChange: (field: "min" | "max" | "step" | "unit" | "tolerance" | "answer", value: string) => void;
  shortResponseAnswer: string;
  shortResponseRubric: string;
  shortResponseMaxWords: string;
  onShortResponseFieldChange: (field: "answer" | "rubric" | "maxWords", value: string) => void;
  showErrors: boolean;
};

function validationText(showErrors: boolean, message: string | null) {
  return showErrors && message ? (
    <p role="alert" className="text-xs text-destructive">{message}</p>
  ) : null;
}

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function QuestionSpecialistEditors({
  questionType,
  orderingItems,
  onOrderingItemsChange,
  multiSelectChoices,
  onMultiSelectChoicesChange,
  sliderMin,
  sliderMax,
  sliderStep,
  sliderUnit,
  sliderTolerance,
  sliderAnswer,
  onSliderFieldChange,
  shortResponseAnswer,
  shortResponseRubric,
  shortResponseMaxWords,
  onShortResponseFieldChange,
  showErrors,
}: SpecialistEditorsProps) {
  if (questionType === "ordering") {
    const trimmedItems = orderingItems.map((item) => item.trim());
    const duplicateItems = new Set(trimmedItems.filter(Boolean).map((item) => item.toLocaleLowerCase())).size
      !== trimmedItems.filter(Boolean).length;
    const message = trimmedItems.length < 3
      ? COPY.questionEditor.specialist.ordering.minError
      : trimmedItems.some((item) => !item)
        ? COPY.questionEditor.specialist.ordering.emptyError
        : duplicateItems
          ? COPY.questionEditor.specialist.ordering.uniqueError
          : null;

    return (
      <div className="space-y-3">
        <div>
          <Label>{COPY.questionEditor.specialist.ordering.itemsLabel}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.questionEditor.specialist.ordering.help}</p>
        </div>
        <div className="space-y-2">
          {orderingItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">{index + 1}</span>
              <Input
                value={item}
                onChange={(event) => {
                  const next = [...orderingItems];
                  next[index] = event.target.value;
                  onOrderingItemsChange(next);
                }}
                placeholder={COPY.questionEditor.specialist.ordering.itemPlaceholder}
                aria-label={`${COPY.questionEditor.specialist.ordering.itemLabel} ${index + 1}`}
                aria-invalid={showErrors && !item.trim()}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={index === 0}
                onClick={() => onOrderingItemsChange([
                  ...orderingItems.slice(0, index - 1),
                  orderingItems[index],
                  orderingItems[index - 1],
                  ...orderingItems.slice(index + 1),
                ])}
                aria-label={COPY.questionEditor.specialist.ordering.moveUp}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={index === orderingItems.length - 1}
                onClick={() => onOrderingItemsChange([
                  ...orderingItems.slice(0, index),
                  orderingItems[index + 1],
                  orderingItems[index],
                  ...orderingItems.slice(index + 2),
                ])}
                aria-label={COPY.questionEditor.specialist.ordering.moveDown}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => onOrderingItemsChange(orderingItems.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={COPY.questionEditor.specialist.ordering.removeItem}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {validationText(showErrors, message)}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOrderingItemsChange([...orderingItems, ""])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {COPY.questionEditor.specialist.ordering.addItem}
        </Button>
      </div>
    );
  }

  if (questionType === "multi_select") {
    const trimmedChoices = multiSelectChoices.map((choice) => choice.text.trim());
    const duplicateChoices = new Set(trimmedChoices.filter(Boolean).map((choice) => choice.toLocaleLowerCase())).size
      !== trimmedChoices.filter(Boolean).length;
    const correctCount = multiSelectChoices.filter((choice) => choice.correct).length;
    const incorrectCount = multiSelectChoices.length - correctCount;
    const message = trimmedChoices.length < 3
      ? COPY.questionEditor.specialist.multiSelect.minError
      : trimmedChoices.some((choice) => !choice)
        ? COPY.questionEditor.specialist.multiSelect.emptyError
        : duplicateChoices
          ? COPY.questionEditor.specialist.multiSelect.uniqueError
          : correctCount < 2 || incorrectCount < 1
            ? COPY.questionEditor.specialist.multiSelect.correctnessError
            : null;

    return (
      <div className="space-y-3">
        <div>
          <Label>{COPY.questionEditor.specialist.multiSelect.choicesLabel}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.questionEditor.specialist.multiSelect.help}</p>
        </div>
        <div className="space-y-2">
          {multiSelectChoices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={choice.text}
                onChange={(event) => {
                  const next = [...multiSelectChoices];
                  next[index] = { ...next[index], text: event.target.value };
                  onMultiSelectChoicesChange(next);
                }}
                placeholder={COPY.questionEditor.specialist.multiSelect.choicePlaceholder}
                aria-label={`${COPY.questionEditor.specialist.multiSelect.choiceLabel} ${index + 1}`}
                aria-invalid={showErrors && !choice.text.trim()}
              />
              <Button
                type="button"
                variant={choice.correct ? "default" : "outline"}
                size="sm"
                className="shrink-0 min-w-24"
                aria-pressed={choice.correct}
                onClick={() => {
                  const next = [...multiSelectChoices];
                  next[index] = { ...next[index], correct: !next[index].correct };
                  onMultiSelectChoicesChange(next);
                }}
              >
                {choice.correct && <Check className="mr-1 h-3.5 w-3.5" />}
                {choice.correct
                  ? COPY.questionEditor.specialist.multiSelect.correctLabel
                  : COPY.questionEditor.specialist.multiSelect.incorrectLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => onMultiSelectChoicesChange(
                  multiSelectChoices.filter((_, choiceIndex) => choiceIndex !== index),
                )}
                aria-label={COPY.questionEditor.specialist.multiSelect.removeChoice}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {validationText(showErrors, message)}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMultiSelectChoicesChange([...multiSelectChoices, { text: "", correct: false }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {COPY.questionEditor.specialist.multiSelect.addChoice}
        </Button>
      </div>
    );
  }

  if (questionType === "slider") {
    const min = finiteNumber(sliderMin);
    const max = finiteNumber(sliderMax);
    const step = finiteNumber(sliderStep);
    const tolerance = finiteNumber(sliderTolerance);
    const answer = finiteNumber(sliderAnswer);
    const fieldErrors = {
      range: min === null || max === null || min >= max
        ? COPY.questionEditor.specialist.slider.rangeError
        : null,
      step: step === null || step <= 0 ? COPY.questionEditor.specialist.slider.stepError : null,
      tolerance: tolerance === null || tolerance < 0
        ? COPY.questionEditor.specialist.slider.toleranceError
        : null,
      unit: !sliderUnit.trim() ? COPY.questionEditor.specialist.slider.unitError : null,
      answer: answer === null || min === null || max === null || answer < min || answer > max
        ? COPY.questionEditor.specialist.slider.answerError
        : null,
    };

    const numberField = (
      field: "min" | "max" | "step" | "tolerance" | "answer",
      label: string,
      value: string,
      error: string | null,
    ) => (
      <div className="space-y-1.5">
        <Label htmlFor={`slider-${field}`}>{label}</Label>
        <Input
          id={`slider-${field}`}
          type="number"
          value={value}
          onChange={(event) => onSliderFieldChange(field, event.target.value)}
          aria-invalid={showErrors && !!error}
        />
        {validationText(showErrors, error)}
      </div>
    );

    return (
      <div className="space-y-4">
        <div>
          <Label>{COPY.questionEditor.specialist.slider.settingsLabel}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.questionEditor.specialist.slider.help}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {numberField("min", COPY.questionEditor.specialist.slider.minLabel, sliderMin, fieldErrors.range)}
          {numberField("max", COPY.questionEditor.specialist.slider.maxLabel, sliderMax, fieldErrors.range)}
          {numberField("step", COPY.questionEditor.specialist.slider.stepLabel, sliderStep, fieldErrors.step)}
          {numberField("tolerance", COPY.questionEditor.specialist.slider.toleranceLabel, sliderTolerance, fieldErrors.tolerance)}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slider-unit">{COPY.questionEditor.specialist.slider.unitLabel}</Label>
          <Input
            id="slider-unit"
            value={sliderUnit}
            onChange={(event) => onSliderFieldChange("unit", event.target.value)}
            placeholder={COPY.questionEditor.specialist.slider.unitPlaceholder}
            aria-invalid={showErrors && !!fieldErrors.unit}
          />
          {validationText(showErrors, fieldErrors.unit)}
        </div>
        {numberField(
          "answer",
          COPY.questionEditor.specialist.slider.answerLabel,
          sliderAnswer,
          fieldErrors.answer,
        )}
      </div>
    );
  }

  const maxWords = finiteNumber(shortResponseMaxWords);
  const rubricError = !shortResponseRubric.trim()
    ? COPY.questionEditor.specialist.shortResponse.rubricError
    : null;
  const answerError = !shortResponseAnswer.trim()
    ? COPY.questionEditor.specialist.shortResponse.answerError
    : null;
  const maxWordsError = shortResponseMaxWords.trim()
    && (maxWords === null || !Number.isInteger(maxWords) || maxWords <= 0)
    ? COPY.questionEditor.specialist.shortResponse.maxWordsError
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="short-response-answer">{COPY.questionEditor.specialist.shortResponse.answerLabel}</Label>
        <Input
          id="short-response-answer"
          value={shortResponseAnswer}
          onChange={(event) => onShortResponseFieldChange("answer", event.target.value)}
          placeholder={COPY.questionEditor.specialist.shortResponse.answerPlaceholder}
          aria-invalid={showErrors && !!answerError}
        />
        {validationText(showErrors, answerError)}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="short-response-rubric">{COPY.questionEditor.specialist.shortResponse.rubricLabel}</Label>
        <Textarea
          id="short-response-rubric"
          value={shortResponseRubric}
          onChange={(event) => onShortResponseFieldChange("rubric", event.target.value)}
          placeholder={COPY.questionEditor.specialist.shortResponse.rubricPlaceholder}
          rows={4}
          aria-invalid={showErrors && !!rubricError}
        />
        {validationText(showErrors, rubricError)}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="short-response-max-words">
          {COPY.questionEditor.specialist.shortResponse.maxWordsLabel}
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
            ({COPY.questionEditor.specialist.shortResponse.optionalLabel})
          </span>
        </Label>
        <Input
          id="short-response-max-words"
          type="number"
          min={1}
          step={1}
          value={shortResponseMaxWords}
          onChange={(event) => onShortResponseFieldChange("maxWords", event.target.value)}
          placeholder={COPY.questionEditor.specialist.shortResponse.maxWordsPlaceholder}
          aria-invalid={showErrors && !!maxWordsError}
        />
        {validationText(showErrors, maxWordsError)}
      </div>
    </div>
  );
}