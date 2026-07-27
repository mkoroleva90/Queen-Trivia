
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, ChevronLeft } from "lucide-react";

// ─── Avatar colour swatches (local UI state only) ────────────────────────────
const AVATAR_COLORS = [
  { id: "pink",   bg: "#ff0080" },
  { id: "cyan",   bg: "#00ddff" },
  { id: "purple", bg: "#8b5cf6" },
  { id: "green",  bg: "#22c55e" },
];

// ─── Shared CTA button ───────────────────────────────────────────────────────
function Cta({
  onClick,
  type = "button",
  disabled = false,
  pending = false,
  pendingLabel,
  bg,
  color,
  children,
}: {
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      onClick={onClick}
      className="w-full font-extrabold text-base disabled:opacity-60 transition-opacity"
      style={{
        height: 58,
        borderRadius: 18,
        background: bg,
        color,
        letterSpacing: ".06em",
        boxShadow: `0 10px 30px ${bg}55`,
        border: "none",
        cursor: disabled || pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {pendingLabel ?? "…"}
        </span>
      ) : children}
    </button>
  );
}

// ─── Gate (4-step onboarding) ────────────────────────────────────────────────
export default function Gate() {
  // ── New local UI state (onboarding steps + avatar) ───────────────────────
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [selectedAvatar, setSelectedAvatar] = useState("pink");

  // ── Existing auth state (unchanged) ─────────────────────────────────────
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [pending, setPending] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [nameError, setNameError] = useState("");
  const { loginUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ── Existing handlers (logic unchanged; only UI state calls added) ────────
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCodeError("Enter your access code");
      return;
    }
    setCodeError("");
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
        setCodeError("That code isn't right — try again");
        return;
      }
      if (data.role === "admin") {
        setLocation("/admin-login");
        return;
      }
      setStep("name");
      setOnboardingStep(3); // advance UI to name step
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter your display name");
      return;
    }
    if (trimmed.length > 50) {
      setNameError("Name must be 50 characters or fewer");
      return;
    }
    setNameError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim().toUpperCase(), name: trimmed }),
      });
      if (res.status === 401) {
        setStep("code");
        setOnboardingStep(2); // send back to code step
        setCodeError("Code expired — please re-enter it");
        return;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Something went wrong — please retry" });
        return;
      }
      const user = await res.json();
      loginUser({ id: user.id, name: user.name });
      if (user.gameId) {
        try {
          const joinRes = await fetch(`/api/games/${user.gameId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({}),
          });
          if (joinRes.ok || joinRes.status === 409) {
            setLocation(`/game/${user.gameId}`);
            return;
          }
        } catch {
          // fall through to lobby
        }
      }
      setLocation("/lobby");
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };

  // ── Navigation helpers ───────────────────────────────────────────────────
  const goNext = () => setOnboardingStep((s) => s + 1);
  const goBack = () => {
    if (onboardingStep <= 0) return;
    if (onboardingStep === 3) setStep("code"); // reset auth step when going back from name
    setOnboardingStep((s) => s - 1);
  };

  // ── Shared motion config ─────────────────────────────────────────────────
  const slide = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -12 },
    transition: { duration: 0.28, type: "tween" } as const,
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(165deg,#2a0a3d 0%,#12061f 55%,#0a0510 100%)" }}
    >
      {/* ── Ambient blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            top: "-60px", left: "-60px",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle,rgba(255,0,128,.22) 0%,transparent 70%)",
            filter: "blur(22px)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-60px", right: "-60px",
            width: 240, height: 240, borderRadius: "50%",
            background: "radial-gradient(circle,rgba(0,221,255,.16) 0%,transparent 70%)",
            filter: "blur(22px)",
          }}
        />
      </div>

      {/* ── Top bar: back + progress dots ── */}
      <div className="relative z-10 flex items-center justify-between px-[22px] pt-14 pb-2">
        {/* Back chevron — hidden on step 0 */}
        {onboardingStep > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,.10)",
              border: "none", cursor: "pointer",
            }}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: s === onboardingStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: s === onboardingStep ? "#ffe500" : "rgba(255,255,255,.22)",
                boxShadow: s === onboardingStep ? "0 0 8px rgba(255,229,0,.65)" : "none",
                transition: "width 300ms ease, background 300ms ease",
              }}
            />
          ))}
        </div>

        <div style={{ width: 36 }} />
      </div>

      {/* ── Screen content ── */}
      <div className="relative z-10 flex-1 flex flex-col px-[22px] pb-8">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Welcome ── */}
          {onboardingStep === 0 && (
            <motion.div key="s0" {...slide} className="flex-1 flex flex-col justify-center gap-8">
              {/* Headline */}
              <div>
                <h1
                  className="font-extrabold"
                  style={{ fontSize: 56, letterSpacing: "-.03em", lineHeight: .88 }}
                >
                  <span style={{ color: "#ffffff" }}>GAME</span>
                  <br />
                  <span style={{ color: "#00ddff", textShadow: "0 0 30px rgba(0,221,255,.6)" }}>
                    NIGHT
                  </span>
                </h1>
              </div>

              {/* Body */}
              <p style={{ fontSize: 16, fontWeight: 500, color: "#c7b8e0", lineHeight: 1.5 }}>
                Big questions. Bigger bragging rights. Let's find out who's actually smart.
              </p>

              {/* CTA */}
              <Cta bg="#ffe500" color="#0a0510" onClick={goNext}>Let's go →</Cta>
            </motion.div>
          )}

          {/* ── Step 1: How it works ── */}
          {onboardingStep === 1 && (
            <motion.div key="s1" {...slide} className="flex-1 flex flex-col justify-center gap-8">
              <h2
                className="font-extrabold"
                style={{ fontSize: 30, color: "#ffffff", letterSpacing: "-.02em" }}
              >
                Here's the deal
              </h2>

              <div className="flex flex-col gap-3">
                {[
                  { bar: "#ff0080", title: "1 · Enter the code",  sub: "Your host shares it at the door." },
                  { bar: "#00ddff", title: "2 · Grab a name",     sub: "Make it one they'll fear."       },
                  { bar: "#ffe500", title: "3 · Go fast",          sub: "Speed = bonus points."           },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-stretch overflow-hidden"
                    style={{ borderRadius: 16, background: "rgba(255,255,255,.05)" }}
                  >
                    <div style={{ width: 8, background: item.bar, flexShrink: 0 }} />
                    <div className="px-4 py-4 flex-1">
                      <p style={{ fontSize: 16, fontWeight: 800, color: "#ffffff" }}>{item.title}</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#b7a8d0", marginTop: 3 }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Cta bg="#ff0080" color="#ffffff" onClick={goNext}>Got it →</Cta>
            </motion.div>
          )}

          {/* ── Step 2: Access code ── */}
          {onboardingStep === 2 && (
            <motion.div key="s2" {...slide} className="flex-1 flex flex-col justify-center gap-8">
              <div>
                <h2
                  className="font-extrabold"
                  style={{ fontSize: 32, color: "#ffffff", letterSpacing: "-.02em" }}
                >
                  Magic word?
                </h2>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#8b7ea3", marginTop: 8 }}>
                  Punch in tonight's access code.
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Input
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeError(""); }}
                    placeholder="CODE"
                    autoCapitalize="characters"
                    autoComplete="off"
                    aria-invalid={!!codeError}
                    className="text-center font-extrabold uppercase"
                    style={{
                      height: 70,
                      fontSize: 30,
                      letterSpacing: ".16em",
                      background: "rgba(0,0,0,.35)",
                      border: codeError
                        ? "2px solid rgba(239,68,68,.7)"
                        : "2px solid #00ddff",
                      borderRadius: 18,
                      color: "#ffffff",
                      boxShadow: codeError ? "none" : "0 0 14px rgba(0,221,255,.18)",
                    }}
                  />
                  {codeError && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "#f87171" }}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {codeError}
                    </p>
                  )}
                </div>
                <Cta type="submit" bg="#00ddff" color="#0a0510" pending={pending} pendingLabel="CHECKING...">
                  Check it →
                </Cta>
              </form>
            </motion.div>
          )}

          {/* ── Step 3: Name + avatar ── */}
          {onboardingStep === 3 && (
            <motion.div key="s3" {...slide} className="flex-1 flex flex-col justify-center gap-8">
              <div>
                <h2
                  className="font-extrabold"
                  style={{ fontSize: 32, color: "#ffffff", letterSpacing: "-.02em" }}
                >
                  You're in!
                </h2>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#8b7ea3", marginTop: 8 }}>
                  Pick a color and a name.
                </p>
              </div>

              {/* Avatar swatches */}
              <div className="flex items-center gap-3">
                {AVATAR_COLORS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.id)}
                    style={{
                      width: 46, height: 46, borderRadius: 16,
                      background: av.bg, border: "none", cursor: "pointer",
                      flexShrink: 0,
                      boxShadow: selectedAvatar === av.id
                        ? "0 0 0 3px #ffe500, 0 0 12px rgba(255,229,0,.4)"
                        : "none",
                      transition: "box-shadow 200ms ease",
                    }}
                    aria-label={av.id}
                  />
                ))}
              </div>

              <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setNameError(""); }}
                    placeholder="YOUR NAME"
                    autoFocus
                    aria-invalid={!!nameError}
                    className="text-center font-extrabold uppercase"
                    style={{
                      height: 60,
                      fontSize: 22,
                      letterSpacing: ".06em",
                      background: "rgba(0,0,0,.35)",
                      border: nameError
                        ? "2px solid rgba(239,68,68,.7)"
                        : "2px solid rgba(255,255,255,.2)",
                      borderRadius: 18,
                      color: "#ffffff",
                    }}
                  />
                  {nameError && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "#f87171" }}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {nameError}
                    </p>
                  )}
                </div>
                <Cta type="submit" bg="#ffe500" color="#0a0510" pending={pending} pendingLabel="JOINING...">
                  Enter the lobby →
                </Cta>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10 pb-10 text-center px-[22px]">
        <p style={{ fontSize: 13, color: "#475569" }}>
          Hosting tonight?{" "}
          <Link
            href="/admin-login"
            style={{ color: "#00ddff", fontWeight: 600, textDecoration: "underline" }}
          >
            Admin login
          </Link>
        </p>
      </div>
    </div>
  );
}
