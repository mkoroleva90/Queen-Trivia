import { COPY } from "@workspace/copy";
import { CrownMark } from "@/components/Brand";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

export type RunMode = "hostOnly" | "hostPlay";

type Props = {
  /** Currently selected mode, or null when nothing is selected yet. */
  value: RunMode | null;
  onSelect: (mode: RunMode) => void;
  /** Called when the host confirms their choice. */
  onContinue: () => void;
};

const OPTIONS: Array<{ mode: RunMode; label: string; desc: string }> = [
  { mode: "hostOnly", label: COPY.runMode.hostOnlyLabel, desc: COPY.runMode.hostOnlyDesc },
  { mode: "hostPlay", label: COPY.runMode.hostPlayLabel, desc: COPY.runMode.hostPlayDesc },
];

/**
 * Run-mode choice screen — shown immediately after a host creates a game,
 * before the join-code step. Design-handoff "1a" treatment: two equal
 * color-blocked cards side by side, Continue bottom-right.
 */
export function RunModeScreen({ value, onSelect, onContinue }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl"
    >
      <h3 className="text-[28px] font-bold leading-tight text-white">{COPY.runMode.title}</h3>
      <p className="mt-[6px] text-sm text-[#8b93a4]">{COPY.runMode.subtitle}</p>

      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {OPTIONS.map(({ mode, label, desc }) => {
          const selected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onSelect(mode)}
              aria-pressed={selected}
              className={`relative flex flex-col items-center gap-[14px] rounded-[22px] p-[26px] text-center transition ${
                selected
                  ? "bg-[rgba(245,19,140,0.14)] border-[1.5px] border-[#f5138c] shadow-[0_0_0_4px_rgba(245,19,140,0.15)]"
                  : "bg-[#12151f] border-[1.5px] border-[#232a38] hover:border-[#39414f]"
              }`}
            >
              {selected && (
                <span className="absolute top-3 right-3 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#f5138c]">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </span>
              )}
              <span
                className={`flex h-[68px] w-[68px] items-center justify-center rounded-[20px] ${
                  selected ? "bg-[rgba(245,19,140,0.22)]" : "bg-[rgba(25,210,237,0.12)]"
                }`}
              >
                <CrownMark width={34} color={selected ? "#f5138c" : "#19d2ed"} />
              </span>
              <span className="block text-xl font-bold text-white">{label}</span>
              <span className={`block text-sm leading-[1.5] ${selected ? "text-[#cfd4de]" : "text-[#8b93a4]"}`}>
                {desc}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 flex justify-end">
        <button
          type="button"
          disabled={value === null}
          onClick={onContinue}
          className="rounded-[14px] bg-[#f5138c] px-11 py-[15px] text-base font-bold text-white transition hover:bg-[#ff2a9c] disabled:opacity-40 disabled:hover:bg-[#f5138c]"
        >
          {COPY.runMode.continueBtn}
        </button>
      </div>
    </motion.div>
  );
}
