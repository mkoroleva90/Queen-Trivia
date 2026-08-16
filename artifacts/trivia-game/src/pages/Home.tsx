
import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { CrownMark } from "@/components/Brand";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { COPY } from "@workspace/copy";

// ─── Queen Trivia home / landing page ────────────────────────────────────────
// Three-step flow matching mobile: Welcome → How it works → Code entry.
// Code verification hands off to /join?code=... (name entry lives there).

type Step = 0 | 1 | 2;

const HOW_STEPS = [
  { bar: "#ff0080", title: COPY.join.howStep1Title, sub: COPY.join.howStep1Sub },
  { bar: "#00ddff", title: COPY.join.howStep2Title, sub: COPY.join.howStep2Sub },
  { bar: "#ffe500", title: COPY.join.howStep3Title, sub: COPY.join.howStep3Sub },
] as const;

export default function Home() {
  const [step, setStep] = useState<Step>(0);
  const [animDir, setAnimDir] = useState<"in" | "out">("in");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const goTo = (next: Step) => {
    setAnimDir(next > step ? "in" : "out");
    setError("");
    setStep(next);
    if (next === 2) setTimeout(() => inputRef.current?.focus(), 320);
  };

  const handleJoin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError(COPY.join.error.enterCode);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!data.valid) {
        setError(COPY.join.error.wrongCode);
        return;
      }
      setLocation(`/join?code=${encodeURIComponent(trimmed)}`);
    } catch {
      toast({ variant: "destructive", title: COPY.join.error.connectionError });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: "100dvh", background: "#0d0f15", color: "#eef2f8", display: "flex", flexDirection: "column" }}
    >
      <style>{`
        @keyframes qt-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes qt-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes qt-floaty2{0%,100%{transform:translateY(0) rotate(-15deg)}50%{transform:translateY(-12px) rotate(-15deg)}}
        @keyframes qt-floaty3{0%,100%{transform:translateY(0) rotate(13deg)}50%{transform:translateY(10px) rotate(13deg)}}
        @keyframes qt-step-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes qt-step-out{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:translateY(0)}}
        .qt-step-in{animation:qt-step-in .22s ease both}
        .qt-step-out{animation:qt-step-out .22s ease both}
        .qt-tbtn{cursor:pointer;transition:filter .14s,transform .14s}
        .qt-tbtn:hover{filter:brightness(1.1)}
        .qt-tbtn:active{transform:translateY(1px)}
        .qt-code-input::placeholder{color:#3a3550}
        .qt-code-input:focus{outline:none;border-color:rgba(255,0,128,.6)!important;box-shadow:0 0 0 3px rgba(255,0,128,.12)}
        .qt-back{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;color:#8893a8;padding:0;font-size:14px;transition:color .15s}
        .qt-back:hover{color:#eef2f8}
      `}</style>
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: 80, left: -60, width: 220, height: 220, borderRadius: "50%", background: "#ff0080", opacity: 0.08 }} />
        <div style={{ position: "absolute", top: 300, right: -80, width: 180, height: 180, borderRadius: "50%", background: "#ffe500", opacity: 0.07 }} />
        {/* floating tile motifs */}
        <div style={{ position: "absolute", top: 120, left: -30, width: 150, height: 150, borderRadius: 24, background: "rgba(255,229,0,.05)", border: "1px solid rgba(255,229,0,.15)", animation: "qt-floaty2 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: 70, right: -36, width: 180, height: 180, borderRadius: 28, background: "rgba(255,0,128,.05)", border: "1px solid rgba(255,0,128,.15)", animation: "qt-floaty3 8s ease-in-out infinite" }} />
        {/* twinkle dots */}
        <div style={{ position: "absolute", top: "16%", left: "20%", width: 5, height: 5, borderRadius: "50%", background: "#ffe500", animation: "qt-twinkle 3s infinite" }} />
        <div style={{ position: "absolute", top: "30%", right: "24%", width: 4, height: 4, borderRadius: "50%", background: "#ff0080", animation: "qt-twinkle 2.6s infinite .5s" }} />
        <div style={{ position: "absolute", bottom: "24%", left: "32%", width: 4, height: 4, borderRadius: "50%", background: "#ffe500", animation: "qt-twinkle 3.4s infinite .8s" }} />
      </div>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, paddingTop: 20, paddingBottom: 4, position: "relative", zIndex: 1 }}>
        {([0, 1, 2] as const).map((s) => (
          <div
            key={s}
            style={{
              height: 8,
              borderRadius: 4,
              transition: "width .2s, background .2s",
              width: s === step ? 24 : 8,
              background: s === step ? "#ffe500" : "rgba(255,255,255,.22)",
            }}
          />
        ))}
      </div>
      {/* Step content */}
      <div
        key={step}
        className={animDir === "in" ? "qt-step-in" : "qt-step-out"}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(20px,4vw,40px) clamp(20px,5vw,40px)",
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: "100%" }}>
            <CrownMark
              width="clamp(88px,22vw,120px)"
              gemHoles
              style={{ marginBottom: "clamp(10px,2.5vw,18px)", animation: "qt-floaty 5.5s ease-in-out infinite" }}
            />
            <h1
              className="font-extrabold"
              style={{ fontSize: "clamp(52px,13vw,80px)", lineHeight: 0.9, letterSpacing: "-.045em", margin: 0, color: "#ffe500" }}
            >
              QUEEN
            </h1>
            <h1
              className="font-extrabold"
              style={{ fontSize: "clamp(52px,13vw,80px)", lineHeight: 0.9, letterSpacing: "-.045em", margin: "0 0 18px", color: "#ff0080" }}
            >
              TRIVIA
            </h1>
            <p
              className="font-medium"
              style={{ fontSize: "clamp(14px,3.6vw,16px)", lineHeight: 1.5, color: "#b09aa6", margin: "0 0 28px", textAlign: "center", maxWidth: 320 }}
            >
              {COPY.join.tagline}
            </p>

            {/* Card */}
            <div
              style={{
                width: "100%",
                padding: "22px clamp(18px,5vw,28px)",
                borderRadius: 22,
                background: "rgba(255,255,255,.03)",
                border: "1px solid #2a2233",
                boxShadow: "0 34px 80px -30px rgba(255,0,128,.45)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginBottom: 18,
              }}
            >
              <button
                type="button"
                onClick={() => goTo(1)}
                className="qt-tbtn w-full font-extrabold"
                style={{
                  fontSize: 16,
                  color: "#041016",
                  background: "#ffe500",
                  border: "none",
                  borderRadius: 13,
                  padding: 15,
                  boxShadow: "0 12px 30px -10px rgba(255,229,0,.5)",
                  cursor: "pointer",
                }}
              >
                {COPY.join.letsPlay}
              </button>

              <button
                type="button"
                onClick={() => setLocation("/admin-login")}
                className="qt-tbtn w-full font-extrabold bg-ring rounded-tl-[10px] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px] pt-[10px] pb-[10px]"
                style={{
                  fontSize: 16,
                  color: "#041016",
                  background: "#ff0080",
                  border: "none",
                  borderRadius: 13,
                  padding: 15,
                  boxShadow: "0 12px 30px -10px rgba(255,0,128,.5)",
                  cursor: "pointer",
                }}
              >HOST A GAME</button>
            </div>
          </div>
        )}

        {/* ── Step 1: How it works ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <button className="qt-back" onClick={() => goTo(0)}>
              <ChevronLeft size={20} />
            </button>
            <h2
              className="font-extrabold"
              style={{ fontSize: "clamp(28px,7vw,38px)", letterSpacing: "-.03em", margin: 0, color: "#eef2f8" }}
            >
              {COPY.join.heresDeal}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {HOW_STEPS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "rgba(255,255,255,.05)",
                  }}
                >
                  <div style={{ width: 8, flexShrink: 0, background: item.bar }} />
                  <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="font-extrabold" style={{ fontSize: 16, color: "#eef2f8" }}>{item.title}</span>
                    <span className="font-medium" style={{ fontSize: 13, color: "#8893a8" }}>{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => goTo(2)}
              className="qt-tbtn w-full font-extrabold"
              style={{
                fontSize: 16,
                color: "#041016",
                background: "#ffe500",
                border: "none",
                borderRadius: 13,
                padding: 15,
                boxShadow: "0 12px 30px -10px rgba(255,229,0,.5)",
                marginTop: 4,
                cursor: "pointer",
              }}
            >
              {COPY.join.gotIt}
            </button>
          </div>
        )}

        {/* ── Step 2: Code entry ── */}
        {step === 2 && (
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
            <button type="button" className="qt-back" onClick={() => goTo(1)}>
              <ChevronLeft size={20} />
            </button>
            <h2
              className="font-extrabold"
              style={{ fontSize: "clamp(28px,7vw,38px)", letterSpacing: "-.03em", margin: 0, color: "#eef2f8" }}
            >
              {COPY.join.magicWord}
            </h2>
            <p className="font-medium" style={{ fontSize: 15, color: "#8893a8", margin: "-8px 0 0" }}>
              {COPY.join.punchIn}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
                  setError("");
                }}
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                enterKeyHint="go"
                aria-label={COPY.join.codeAriaLabel}
                placeholder={COPY.join.codePlaceholder}
                className="qt-code-input w-full text-center"
                style={{
                  fontFamily: "ui-monospace,monospace",
                  fontWeight: 800,
                  fontSize: "clamp(26px,7vw,32px)",
                  letterSpacing: "0.18em",
                  color: code ? "#fff" : undefined,
                  background: code ? "rgba(255,0,128,.07)" : "rgba(0,0,0,.25)",
                  border: `2px solid ${error ? "#f87171" : code ? "rgba(255,0,128,.45)" : "rgba(255,0,128,.45)"}`,
                  borderRadius: 18,
                  padding: "18px 16px",
                  transition: "border-color .15s, background .15s",
                  height: 72,
                }}
              />
              {error && (
                <p className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
                  <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="qt-tbtn w-full font-extrabold disabled:opacity-60"
              style={{
                fontSize: 16,
                color: "#041016",
                background: "#ff0080",
                border: "none",
                borderRadius: 13,
                padding: 15,
                boxShadow: "0 12px 30px -10px rgba(255,0,128,.45)",
                cursor: pending ? "default" : "pointer",
              }}
            >
              {pending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> {COPY.join.checking}
                </span>
              ) : (
                COPY.join.checkIt
              )}
            </button>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}
