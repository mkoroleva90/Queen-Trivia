import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { COPY } from "@workspace/copy";

type ReportReason = "hateful" | "sexual" | "harassment" | "spam" | "other";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "hateful",    label: COPY.report.reasons.hateful },
  { value: "sexual",     label: COPY.report.reasons.sexual },
  { value: "harassment", label: COPY.report.reasons.harassment },
  { value: "spam",       label: COPY.report.reasons.spam },
  { value: "other",      label: COPY.report.reasons.other },
];

interface ReportDialogProps {
  gameId: number;
  questionId?: number;
  onClose: () => void;
}

export function ReportDialog({ gameId, questionId, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const submit = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { gameId, reason };
      if (questionId) body.questionId = questionId;
      if (note.trim()) body.note = note.trim();
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        const err = new Error(json.error ?? "Request failed");
        (err as Error & { code?: string }).code = json.code;
        throw err;
      }
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: Error) => {
      const code = (err as Error & { code?: string }).code;
      if (code === "content_filtered") {
        toast({ title: COPY.contentFilter.reportNote, variant: "destructive" });
      } else {
        toast({ title: COPY.report.submitError, variant: "destructive" });
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#0f1724", border: "1px solid rgba(255,255,255,.1)" }}
      >
        {submitted ? (
          /* ── Confirmation state ── */
          <div className="space-y-3 text-center py-2">
            <div
              className="mx-auto flex items-center justify-center rounded-full"
              style={{ width: 52, height: 52, background: "rgba(34,197,94,.15)" }}
            >
              <svg
                width="24" height="24" viewBox="0 0 24 24"
                fill="none" stroke="#22c55e" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="font-extrabold text-white text-base">
              {COPY.report.confirmTitle}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#9aa6bc" }}>
              {COPY.report.confirmBody}
            </p>
            <button
              onClick={onClose}
              className="w-full font-bold text-sm mt-1"
              style={{
                height: 44, borderRadius: 12,
                background: "rgba(255,255,255,.08)",
                color: "#e2e8f0",
                border: "1px solid rgba(255,255,255,.12)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-base">
                {COPY.report.title}
              </h3>
              <p className="text-sm" style={{ color: "#9aa6bc" }}>
                {COPY.report.subtitle}
              </p>
            </div>

            {/* Reason buttons */}
            <div className="space-y-2">
              {REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className="w-full text-left text-sm font-medium px-4"
                    style={{
                      height: 42, borderRadius: 10,
                      background: selected
                        ? "rgba(255,45,142,.18)"
                        : "rgba(255,255,255,.05)",
                      border: selected
                        ? "1.5px solid rgba(255,45,142,.6)"
                        : "1px solid rgba(255,255,255,.09)",
                      color: selected ? "#ff5aa8" : "#e2e8f0",
                      cursor: "pointer",
                      transition: "background .12s, border .12s",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Optional note */}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder={COPY.report.notePlaceholder}
              rows={3}
              className="w-full text-sm resize-none outline-none"
              style={{
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.09)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#e2e8f0",
              }}
            />

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={submit.isPending}
                className="flex-1 font-semibold text-sm"
                style={{
                  height: 44, borderRadius: 12,
                  background: "rgba(255,255,255,.06)",
                  color: "#9aa6bc",
                  border: "1px solid rgba(255,255,255,.09)",
                  cursor: "pointer",
                }}
              >
                {COPY.report.cancel}
              </button>
              <button
                onClick={() => reason && submit.mutate()}
                disabled={!reason || submit.isPending}
                className="flex-1 font-extrabold text-sm"
                style={{
                  height: 44, borderRadius: 12,
                  background: reason ? "#ff2d8e" : "rgba(255,255,255,.08)",
                  color: reason ? "#fff" : "#555",
                  border: "none",
                  cursor: reason && !submit.isPending ? "pointer" : "not-allowed",
                  opacity: submit.isPending ? 0.7 : 1,
                  transition: "background .12s",
                }}
              >
                {submit.isPending ? "Submitting…" : COPY.report.submit}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
