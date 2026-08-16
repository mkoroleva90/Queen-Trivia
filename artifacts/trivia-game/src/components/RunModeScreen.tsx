import { COPY } from "@workspace/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Crown, Users } from "lucide-react";
import { motion } from "framer-motion";

export type RunMode = "hostOnly" | "hostPlay";

type Props = {
  /** Currently selected mode, or null when nothing is selected yet. */
  value: RunMode | null;
  onSelect: (mode: RunMode) => void;
  /** Called when the host confirms their choice. */
  onContinue: () => void;
};

const OPTIONS: Array<{
  mode: RunMode;
  label: string;
  desc: string;
  Icon: typeof Crown;
}> = [
  { mode: "hostOnly", label: COPY.runMode.hostOnlyLabel, desc: COPY.runMode.hostOnlyDesc, Icon: Crown },
  { mode: "hostPlay", label: COPY.runMode.hostPlayLabel, desc: COPY.runMode.hostPlayDesc, Icon: Users },
];

/**
 * Run-mode choice screen — shown immediately after a host creates a game,
 * before the "Ready to Go!" success screen. The choice feeds the same
 * host-plays-along flag the old "Play along" checkbox set.
 */
export function RunModeScreen({ value, onSelect, onContinue }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-2 border-primary/40 bg-primary/5">
        <CardContent className="py-10 space-y-6 text-center">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight">{COPY.runMode.title}</h3>
            <p className="text-muted-foreground text-sm">{COPY.runMode.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
            {OPTIONS.map(({ mode, label, desc, Icon }) => {
              const selected = value === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSelect(mode)}
                  aria-pressed={selected}
                  className={`relative rounded-2xl border-2 p-5 text-left transition
                    ${selected
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_-6px] shadow-primary/50"
                      : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"}`}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <Icon className={`h-7 w-7 mb-3 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="block text-base font-bold">{label}</span>
                  <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</span>
                </button>
              );
            })}
          </div>

          <Button
            className="font-bold min-w-40"
            disabled={value === null}
            onClick={onContinue}
          >
            {COPY.runMode.continueBtn}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
