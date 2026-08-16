import { useState } from "react";
import { COPY } from "@workspace/copy";
import { Check, Copy, Loader2 } from "lucide-react";
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
 * "Ready to go live" confirmation. Saves via the existing PATCH /games/:id
 * (handled by the parent); unchanged codes just continue.
 */
export function JoinCodeScreen({ initialCode, saving, error, onSubmit }: Props) {
  const [code, setCode] = useState(initialCode);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim().toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-[520px]"
    >
      <h3 className="text-[30px] font-bold leading-tight text-white">{COPY.joinCode.title}</h3>
      <p className="mt-[6px] text-[15px] text-[#8b93a4]">{COPY.joinCode.subtitle}</p>

      <label
        htmlFor="joinCodeStep"
        className="mt-7 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7387]"
      >
        {COPY.joinCode.inputLabel}
      </label>
      <div className="mt-2 flex items-center gap-3">
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
          className={`min-w-0 flex-1 rounded-[14px] bg-[#0f1420] px-[18px] py-4 text-2xl font-bold tracking-[0.12em] text-white focus:outline-none ${
            fieldError
              ? "border-[1.5px] border-destructive"
              : "border-[1.5px] border-[#f5138c] shadow-[0_0_0_4px_rgba(245,19,140,0.12)]"
          }`}
          aria-label={COPY.joinCode.inputLabel}
          aria-invalid={fieldError !== null}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-[#2b3446] transition hover:border-[#445067]"
          aria-label="Copy join code"
        >
          {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5 text-[#8b93a4]" />}
        </button>
      </div>
      {fieldError ? (
        <p className="mt-2 text-[13px] text-destructive">{fieldError}</p>
      ) : (
        <p className="mt-2 text-[13px] text-[#6b7387]">{COPY.joinCode.helper}</p>
      )}

      <div className="mt-7 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleContinue}
          className="flex items-center rounded-[14px] bg-[#f5138c] px-11 py-[15px] text-base font-bold text-white transition hover:bg-[#ff2a9c] disabled:opacity-60"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {COPY.joinCode.continueBtn}
        </button>
      </div>
    </motion.div>
  );
}
