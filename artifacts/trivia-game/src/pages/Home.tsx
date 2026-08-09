
import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { CrownMark } from "@/components/Brand";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

// ─── Queen Trivia home / landing page ────────────────────────────────────────
// Two entry paths: Admin Login and Join a Game (per-game code).
// Join wires into /api/auth/verify, then hands off to /join?code=...
// Invalid/expired codes show an inline error.

export default function Home() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleJoin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter your game code");
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
        setError("That code isn't right — try again");
        return;
      }
      setLocation(`/join?code=${encodeURIComponent(trimmed)}`);
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: "100dvh", background: "#0d0f15", color: "#eef2f8" }}
    >
      <style>{`
        @keyframes qt-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes qt-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes qt-floaty2{0%,100%{transform:translateY(0) rotate(-15deg)}50%{transform:translateY(-12px) rotate(-15deg)}}
        @keyframes qt-floaty3{0%,100%{transform:translateY(0) rotate(13deg)}50%{transform:translateY(10px) rotate(13deg)}}
        .qt-tbtn{cursor:pointer;transition:filter .14s,transform .14s}
        .qt-tbtn:hover{filter:brightness(1.1)}
        .qt-tbtn:active{transform:translateY(1px)}
        @media (max-width:680px){
          .qt-hero{padding:20px 20px 12px!important}
          .qt-motif{display:none}
        }
        .qt-code-input::placeholder{color:#3a3550}
        .qt-code-input:focus{outline:none;border-color:rgba(255,0,128,.6)!important;box-shadow:0 0 0 3px rgba(255,0,128,.12)}
      `}</style>
      {/* floating answer-tile motifs */}
      <div className="qt-motif pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: 120, left: -30, width: 150, height: 150, borderRadius: 24, background: "rgba(255,229,0,.06)", border: "1px solid rgba(255,229,0,.18)", animation: "qt-floaty2 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: 70, right: -36, width: 180, height: 180, borderRadius: 28, background: "rgba(255,0,128,.06)", border: "1px solid rgba(255,0,128,.18)", animation: "qt-floaty3 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: 210, right: 90, width: 84, height: 84, borderRadius: 18, background: "rgba(255,229,0,.05)", border: "1px solid rgba(255,229,0,.16)", animation: "qt-floaty2 6.5s ease-in-out infinite .6s" }} />
        <div style={{ position: "absolute", bottom: 180, left: 70, width: 64, height: 64, borderRadius: 16, background: "rgba(255,0,128,.05)", border: "1px solid rgba(255,0,128,.16)", animation: "qt-floaty3 7.5s ease-in-out infinite .3s" }} />
        <div style={{ position: "absolute", top: "16%", left: "20%", width: 5, height: 5, borderRadius: "50%", background: "#ffe500", animation: "qt-twinkle 3s infinite" }} />
        <div style={{ position: "absolute", top: "30%", right: "24%", width: 4, height: 4, borderRadius: "50%", background: "#ff0080", animation: "qt-twinkle 2.6s infinite .5s" }} />
        <div style={{ position: "absolute", bottom: "24%", left: "32%", width: 4, height: 4, borderRadius: "50%", background: "#ffe500", animation: "qt-twinkle 3.4s infinite .8s" }} />
      </div>
      {/* hero */}
      <div
        className="qt-hero relative flex flex-col items-center text-center"
        style={{ padding: "clamp(20px,4vw,30px) clamp(20px,5vw,40px) 20px" }}
      >
        <CrownMark
          width="clamp(104px,26vw,152px)"
          gemHoles
          style={{ marginBottom: "clamp(12px,3vw,20px)", animation: "qt-floaty 5.5s ease-in-out infinite" }}
        />
        <h1 className="font-extrabold" style={{ fontSize: "clamp(46px,13vw,76px)", lineHeight: 0.9, letterSpacing: "-.045em", margin: "0 0 4px", color: "#ffe500" }}>
          QUEEN
        </h1>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(46px,13vw,76px)", lineHeight: 0.9, letterSpacing: "-.045em", margin: "0 0 18px", color: "#ff0080" }}>
          TRIVIA
        </h1>
        <p className="font-medium" style={{ fontSize: "clamp(14px,3.6vw,16px)", lineHeight: 1.4, color: "#b09aa6", margin: "0 0 30px", maxWidth: 360 }}>
          Enter the code. Answer fast. Take the throne.
        </p>

        {/* join centerpiece */}
        <form
          onSubmit={handleJoin}
          className="flex flex-col items-center w-full"
          style={{
            maxWidth: 340,
            gap: 15,
            padding: "24px clamp(18px,5vw,28px)",
            borderRadius: 22,
            background: "rgba(255,255,255,.03)",
            border: "1px solid #2a2233",
            boxShadow: "0 34px 80px -30px rgba(255,0,128,.45)",
          }}
        >
          <div className="font-bold" style={{ fontSize: 10, letterSpacing: ".16em", color: "#66728a" }}>
            JOIN A GAME
          </div>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
              setError("");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            enterKeyHint="go"
            aria-label="Game code"
            placeholder="      "
            className="qt-code-input w-full text-center"
            style={{
              fontFamily: "ui-monospace,monospace",
              fontWeight: 800,
              fontSize: "clamp(22px,6vw,28px)",
              letterSpacing: "0.18em",
              color: code ? "#fff" : undefined,
              background: code ? "rgba(255,0,128,.07)" : "rgba(0,0,0,.25)",
              border: `1.5px solid ${code ? "rgba(255,0,128,.45)" : "#2a2233"}`,
              borderRadius: 13,
              padding: "14px 12px 14px",
              transition: "border-color .15s, background .15s",
            }}
          />
          {error && (
            <p className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="qt-tbtn w-full font-extrabold disabled:opacity-60"
            style={{
              fontSize: 16,
              color: "#041016",
              background: "#ffe500",
              border: "none",
              borderRadius: 13,
              padding: 15,
              boxShadow: "0 12px 30px -10px rgba(255,229,0,.5)",
            }}
          >
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Checking…
              </span>
            ) : (
              "Let's play →"
            )}
          </button>
        </form>

        {/* Admin login */}
        <div className="font-medium" style={{ marginTop: 18, fontSize: 13, color: "#66728a" }}>
          Hosting tonight?{" "}
          <Link href="/admin-login" className="qt-tbtn font-bold" style={{ color: "#ffe500" }}>
            Admin login →
          </Link>
        </div>
      </div>
    </div>
  );
}
