import { COPY } from "@workspace/copy";
import { Check } from "lucide-react";

export type OpenTdbImportMode = "standard" | "extended" | "surprise";

type Props = {
  value: OpenTdbImportMode | null;
  onSelect: (mode: OpenTdbImportMode) => void;
};

const OPTIONS: Array<{ value: OpenTdbImportMode; label: string }> = [
  { value: "standard", label: COPY.openTdbQuestionMix.standard },
  { value: "extended", label: COPY.openTdbQuestionMix.extended },
  { value: "surprise", label: COPY.openTdbQuestionMix.surprise },
];

export function OpenTdbQuestionMixSelector({ value, onSelect }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-foreground">
        {COPY.openTdbQuestionMix.title}
      </legend>
      <div role="radiogroup" aria-label={COPY.openTdbQuestionMix.title} className="grid gap-3">
        {OPTIONS.map(({ value: optionValue, label }) => {
          const selected = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`open-tdb-mix-${optionValue}`}
              onClick={() => onSelect(optionValue)}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                selected
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : "border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60"
                }`}
              >
                {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {value === null && (
        <p className="text-xs text-muted-foreground" role="status">
          {COPY.openTdbQuestionMix.hint}
        </p>
      )}
    </fieldset>
  );
}