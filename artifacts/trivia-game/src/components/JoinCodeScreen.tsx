import { useState } from "react";
import { COPY } from "@workspace/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/** Matches the server's CUSTOM_ACCESS_CODE_PATTERN (after uppercasing). */
const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

type Props = {
  /** The game's current (auto-assigned) join code — always pre-filled. */
  initialCode: string;
  /** True while the PATCH request is in flight. */
  saving: boolean;
  /** Server-side field error mapped by the parent (taken / blocked / invalid). */
  error: string | null;
  /** Called with the validated, uppercased code when the host continues. */
  onSubmit: (code: string) => void;
};

/**
 * Join-code choice step — shown after the run-mode screen and before the
 * "Ready to Go!" success screen. Saves via the existing PATCH /games/:id
 * (handled by the parent); unchanged codes just continue.
 */
export function JoinCodeScreen({ initialCode, saving, error, onSubmit }: Props) {
  const [code, setCode] = useState(initialCode);
  const [localError, setLocalError] = useState<string | null>(null);

  const fieldError = localError ?? error;

  const handleContinue = () => {
    const val = code.trim().toUpperCase();
    if (!JOIN_CODE_PATTERN.test(val)) {
      setLocalError(COPY.joinCode.invalidError);
      return;
    }
    setLocalError(null);
    onSubmit(val);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-2 border-primary/40 bg-primary/5">
        <CardContent className="py-10 space-y-6 text-center">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight">{COPY.joinCode.title}</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">{COPY.joinCode.subtitle}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="joinCodeStep"
              className="text-[10px] font-bold tracking-[.15em] text-muted-foreground uppercase"
            >
              {COPY.joinCode.inputLabel}
            </label>
            <input
              id="joinCodeStep"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setLocalError(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleContinue(); }}
              maxLength={12}
              className={`font-mono text-xl font-extrabold tracking-[.2em] text-secondary bg-secondary/10 border rounded-xl px-4 py-2 w-52 text-center focus:outline-none ${
                fieldError
                  ? "border-destructive focus:border-destructive"
                  : "border-secondary/30 focus:border-secondary/60"
              }`}
              aria-label={COPY.joinCode.inputLabel}
              aria-invalid={fieldError !== null}
            />
            {fieldError ? (
              <p className="text-xs text-destructive">{fieldError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{COPY.joinCode.helper}</p>
            )}
          </div>

          <Button
            className="font-bold min-w-40"
            disabled={saving}
            onClick={handleContinue}
          >
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{COPY.joinCode.continueBtn}</>
              : COPY.joinCode.continueBtn}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
