
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, AlertCircle, ArrowLeft, Mail, KeyRound } from "lucide-react";


type SignInMode = "code" | "email";

export default function AdminLogin() {
  const [mode, setMode] = useState<SignInMode>("code");

  // Access-code state
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  // Email+password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  const [pending, setPending] = useState(false);
  const { loginAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();


  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCodeError("Enter your admin code");
      return;
    }
    setCodeError("");
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: trimmed }),
      });

      if (res.status === 401) {
        setCodeError("That code isn't right — try again");
        return;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Something went wrong — please retry" });
        return;
      }

      loginAdmin();
      setLocation("/admin");
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setEmailError("Enter your email and password");
      return;
    }
    setEmailError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.status === 403) {
        setEmailError("Please verify your email address before logging in. Check your inbox for the verification link.");
        return;
      }
      if (res.status === 401) {
        setEmailError("Invalid email or password");
        return;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Something went wrong — please retry" });
        return;
      }

      loginAdmin();
      setLocation("/admin");
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };


  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold tracking-tighter">
              HOST ACCESS
            </h1>
          </div>
          <p className="text-muted-foreground">
            {mode === "code"
              ? "Enter your admin code to manage tonight's games"
              : "Sign in with your email and password"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-primary/20 bg-card/50 backdrop-blur p-1 gap-1">
          <button
            type="button"
            onClick={() => { setMode("code"); setCodeError(""); setEmailError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "code"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Access Code
          </button>
          <button
            type="button"
            onClick={() => { setMode("email"); setCodeError(""); setEmailError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "email"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="h-4 w-4" />
            Email &amp; Password
          </button>
        </div>

        {mode === "code" ? (
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-widest">
                Admin Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeError("");
                    }}
                    placeholder="ENTER ADMIN CODE"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!codeError}
                    className={`h-14 text-center text-2xl uppercase tracking-widest bg-background border-primary/30 focus-visible:ring-primary ${
                      codeError ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {codeError && (
                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {codeError}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold tracking-wide"
                  disabled={pending}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      VERIFYING...
                    </>
                  ) : (
                    "UNLOCK DASHBOARD"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-widest">
                Sign In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    placeholder="Email address"
                    autoComplete="email"
                    autoFocus
                    aria-invalid={!!emailError}
                    className={`h-12 bg-background border-primary/30 focus-visible:ring-primary ${
                      emailError ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setEmailError("");
                    }}
                    placeholder="Password"
                    autoComplete="current-password"
                    aria-invalid={!!emailError}
                    className={`h-12 bg-background border-primary/30 focus-visible:ring-primary ${
                      emailError ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {emailError && (
                    <p className="flex items-center gap-1.5 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {emailError}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold tracking-wide"
                  disabled={pending}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      SIGNING IN...
                    </>
                  ) : (
                    "SIGN IN"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to player login
          </Link>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-foreground transition-colors">
              Create account
            </Link>
            <span>·</span>
            <Link href="/forgot-password" className="hover:text-foreground transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
