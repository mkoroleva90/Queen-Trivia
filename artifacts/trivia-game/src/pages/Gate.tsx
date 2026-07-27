
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";


export default function Gate() {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [step, setStep] = useState<"code" | "name">("code");
    const [pending, setPending] = useState(false);
    const [codeError, setCodeError] = useState("");
    const [nameError, setNameError] = useState("");
    const { loginUser } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();


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

    return (
        <div
            className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 0%, #0f1e2e 0%, #060c13 60%, #040810 100%)",
            }}
        >
            {/* Ambient magenta glow behind title */}
            <div
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                    top: "8%",
                    width: "700px",
                    height: "340px",
                    background: "radial-gradient(ellipse, rgba(240,10,120,0.13) 0%, transparent 70%)",
                    filter: "blur(40px)",
                }}
            />
            {/* Bottom-right cyan accent */}
            <div
                className="absolute bottom-0 right-0 pointer-events-none"
                style={{
                    width: "500px",
                    height: "300px",
                    background: "radial-gradient(ellipse at bottom right, rgba(6,182,212,0.08) 0%, transparent 70%)",
                }}
            />

            <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="text-center space-y-3">
                    {/* Eyebrow */}
                    <div className="flex items-center justify-center gap-3">
                        <div className="h-px w-10" style={{ background: "linear-gradient(to right, transparent, rgba(245,13,136,0.6))" }} />
                        <span
                            className="text-[10px] font-bold uppercase"
                            style={{ letterSpacing: "0.35em", color: "rgba(245,13,136,0.7)" }}
                        >
                            Live Tonight
                        </span>
                        <div className="h-px w-10" style={{ background: "linear-gradient(to left, transparent, rgba(245,13,136,0.6))" }} />
                    </div>

                    {/* Title */}
                    <h1
                        className="font-black leading-none"
                        style={{
                            fontSize: "4.5rem",
                            letterSpacing: "-0.02em",
                            color: "#f50d88",
                            textShadow: "0 0 40px rgba(245,13,136,0.5), 0 0 80px rgba(245,13,136,0.2)",
                        }}
                    >
                        TRIVIA<br />NIGHT
                    </h1>

                    <p className="text-lg font-light" style={{ color: "#64748b" }}>
                        The ultimate pub quiz experience
                    </p>
                </div>

                {/* Card */}
                <div
                    className="rounded-xl p-6 space-y-4"
                    style={{
                        background: "rgba(10, 18, 28, 0.85)",
                        border: "1px solid rgba(245,13,136,0.25)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 0 0 1px rgba(245,13,136,0.05), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                >
                    {step === "code" ? (
                        <form onSubmit={handleCodeSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label
                                    className="block text-xs font-semibold text-center uppercase"
                                    style={{ letterSpacing: "0.25em", color: "#22d3ee" }}
                                >
                                    Access Code
                                </label>
                                <Input
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        setCodeError("");
                                    }}
                                    placeholder="ENTER CODE"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    aria-invalid={!!codeError}
                                    className="h-14 text-center text-2xl uppercase tracking-widest"
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: codeError
                                            ? "1px solid rgba(239,68,68,0.6)"
                                            : "1px solid rgba(255,255,255,0.1)",
                                        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
                                        color: "#e2e8f0",
                                    }}
                                />
                                {codeError && (
                                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        {codeError}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={pending}
                                className="w-full h-14 rounded-lg text-lg font-black tracking-widest text-white uppercase relative overflow-hidden disabled:opacity-60 transition-opacity"
                                style={{
                                    background: "linear-gradient(135deg, #f50d88 0%, #c4006d 100%)",
                                    boxShadow: "0 4px 24px rgba(245,13,136,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                                    letterSpacing: "0.2em",
                                }}
                            >
                                {/* Shimmer highlight */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
                                />
                                {pending ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        CHECKING...
                                    </span>
                                ) : "ENTER"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleNameSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label
                                    className="block text-xs font-semibold text-center uppercase"
                                    style={{ letterSpacing: "0.25em", color: "#22d3ee" }}
                                >
                                    Display Name
                                </label>
                                <Input
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setNameError("");
                                    }}
                                    placeholder="YOUR NAME"
                                    autoFocus
                                    aria-invalid={!!nameError}
                                    className="h-14 text-center text-2xl uppercase tracking-widest"
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: nameError
                                            ? "1px solid rgba(239,68,68,0.6)"
                                            : "1px solid rgba(255,255,255,0.1)",
                                        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
                                        color: "#e2e8f0",
                                    }}
                                />
                                {nameError && (
                                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        {nameError}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={pending}
                                className="w-full h-14 rounded-lg text-lg font-black tracking-widest text-white uppercase relative overflow-hidden disabled:opacity-60 transition-opacity"
                                style={{
                                    background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
                                    boxShadow: "0 4px 24px rgba(8,145,178,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                                    letterSpacing: "0.2em",
                                }}
                            >
                                <div
                                    className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
                                />
                                {pending ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        JOINING...
                                    </span>
                                ) : "JOIN LOBBY"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep("code")}
                                className="w-full text-sm transition-colors"
                                style={{ color: "#475569" }}
                                onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
                                onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
                            >
                                Wrong code? Go back
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-sm" style={{ color: "#475569" }}>
                    Hosting tonight?{" "}
                    <Link
                        href="/admin-login"
                        className="font-medium underline-offset-4 hover:underline"
                        style={{ color: "#22d3ee" }}
                    >
                        Admin login
                    </Link>
                </p>
            </div>
        </div>
    );
}
