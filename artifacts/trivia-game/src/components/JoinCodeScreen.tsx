import { useState } from "react";
import { COPY } from "@workspace/copy";
import { Check, Copy, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/** Matches the server's CUSTOM_ACCESS_CODE_PATTERN (after uppercasing). */
const JOIN_CODE_PATTERN = /^[A-Z0-9]{8,12}$/;

type Props = {
  /** The game's current (auto-assigned) join code — kept when the host leaves the input blank. */
  initialCode: string;
  /** The game's current title (topic) — pre-fills the quiz-title field. */
  initialTitle: string;
  /** True while the PATCH request is in flight. */
  saving: boolean;
  /** Server-side field error mapped by the parent (taken / blocked / invalid). */
  error: string | null;
  /** Server-side field error for the title mapped by the parent (blocked / failed). */
  titleError: string | null;
  /** Called with the validated, uppercased code and trimmed title when the host continues. */
  onSubmit: (code: string, title: string) => void;
};

/**
 * Join-code choice step — shown after the run-mode screen and before the
 * "Ready to go live" confirmation. Also lets the host rename the quiz. Saves
 * via the existing PATCH /games/:id (handled by the parent); unchanged values
 * just continue.
 */
export function JoinCodeScreen({ initialCode, initialTitle, saving, error, titleError, onSubmit }: Props) {
  const [code, setCode] = useState("");
  const [quizTitle, setQuizTitle] = useState(initialTitle);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localTitleError, setLocalTitleError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fieldError = localError ?? error;
  const titleFieldError = localTitleError ?? titleError;

  const handleContinue = () => {
    const title = quizTitle.trim();
    const val = code.trim().toUpperCase();
    // Blank keeps the auto-assigned code (the parent skips the PATCH for an unchanged code).
    const keepInitial = val === "";
    const titleInvalid = title === "";
    const codeInvalid = !keepInitial && !JOIN_CODE_PATTERN.test(val);
    setLocalTitleError(titleInvalid ? COPY.admin.renameEmpty : null);
    setLocalError(codeInvalid ? COPY.joinCode.invalidError : null);
    if (titleInvalid || codeInvalid) return;
    onSubmit(keepInitial ? initialCode : val, title);
  };

  const handleCopy = async () => {
    try {
      // Copy whichever code will actually be used: the typed one, else the auto-assigned one.
      await navigator.clipboard.writeText(code.trim().toUpperCase() || initialCode);
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
        htmlFor="joinCodeTitleStep"
        className="mt-7 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7387]"
      >
        {COPY.joinCode.titleLabel}
      </label>
      <input
        id="joinCodeTitleStep"
        type="text"
        value={quizTitle}
        onChange={(e) => {
          setQuizTitle(e.target.value);
          setLocalTitleError(null);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") handleContinue(); }}
        maxLength={120}
        className={`mt-2 w-full rounded-[14px] bg-[#0f1420] px-[18px] py-4 text-lg font-bold text-white focus:outline-none ${
          titleFieldError
            ? "border-[1.5px] border-destructive"
            : "border-[1.5px] border-[#2b3446] focus:border-[#f5138c]"
        }`}
        aria-label={COPY.joinCode.titleLabel}
        aria-invalid={titleFieldError !== null}
      />
      {titleFieldError && (
        <p className="mt-2 text-[13px] text-destructive">{titleFieldError}</p>
      )}

      <label
        htmlFor="joinCodeStep"
        className="mt-5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7387]"
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
        <p className="mt-2 text-[13px] text-[#6b7387]">
          {code.trim() === "" ? COPY.joinCode.blankHelper(initialCode) : COPY.joinCode.helper}
        </p>
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
