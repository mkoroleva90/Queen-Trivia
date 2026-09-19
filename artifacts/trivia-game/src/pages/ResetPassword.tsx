import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { COPY } from "@workspace/copy";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  // Read the token from the URL at render time
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same checks, same order, same messages as the mobile reset screen.
    if (!token) { setError(COPY.hostForgotPassword.error.invalidLink); return; }
    if (!password) { setError(COPY.hostForgotPassword.error.enterNewPassword); return; }
    if (password.length < 8) { setError(COPY.hostForgotPassword.error.passwordTooShort); return; }
    if (password !== confirm) { setError(COPY.hostForgotPassword.error.passwordsNoMatch); return; }
    setError("");
    setPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      if (res.status === 503) {
        setError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        // Treat any 400 as an invalid/expired link regardless of exact message.
        setError(body.error?.toLowerCase().includes("expired") || body.error?.toLowerCase().includes("invalid")
          ? COPY.hostForgotPassword.error.invalidLink
          : (body.error ?? COPY.hostForgotPassword.error.somethingWrong));
        return;
      }
      if (!res.ok) {
        setError(COPY.hostForgotPassword.error.somethingWrong);
        return;
      }

      setDone(true);
    } catch {
      setError(COPY.hostForgotPassword.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
        <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <p className="text-[#ff6b6b]">{COPY.hostForgotPassword.error.invalidLink}</p>
            <Button
              className="bg-[#ff2d8e] hover:bg-[#e0207d] text-white"
              onClick={() => setLocation("/forgot-password")}
            >
              {COPY.hostForgotPassword.requestNewLink}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
        <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-[#35d07f] mx-auto" />
            <h2 className="text-xl font-extrabold tracking-widest text-white">{COPY.hostForgotPassword.updatedHeading}</h2>
            <p className="text-[#9aa6bc] text-sm">
              {COPY.hostForgotPassword.updatedBody}
            </p>
            <Button
              className="bg-[#ff2d8e] hover:bg-[#e0207d] text-white"
              onClick={() => setLocation("/admin-login")}
            >
              {COPY.hostLogin.signInBtn}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInvalidLink = error === COPY.hostForgotPassword.error.invalidLink;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
      <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin-login">
              <button className="flex items-center gap-1 text-sm text-[#9aa6bc] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                {COPY.hostForgotPassword.back}
              </button>
            </Link>
          </div>
          <CardTitle className="text-white text-xl tracking-widest">{COPY.hostForgotPassword.resetHeading}</CardTitle>
          <p className="text-[#9aa6bc] text-sm">
            {COPY.hostForgotPassword.resetHelperLink}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold tracking-widest text-[#9aa6bc]">{COPY.hostForgotPassword.newPasswordLabel}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder={COPY.hostForgotPassword.newPasswordPlaceholder}
                  className="pl-10 pr-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? COPY.hostLogin.hidePassword : COPY.hostLogin.showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa6bc] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold tracking-widest text-[#9aa6bc]">{COPY.hostForgotPassword.confirmLabel}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  placeholder={COPY.hostForgotPassword.confirmPlaceholder}
                  className="pl-10 pr-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? COPY.hostLogin.hidePassword : COPY.hostLogin.showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa6bc] hover:text-white"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-[#ff2d8e] hover:bg-[#e0207d] text-white font-bold h-12 tracking-wider"
            >
              {pending ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{COPY.hostForgotPassword.submitting}</span>
              ) : COPY.hostForgotPassword.submitBtn}
            </Button>

            {isInvalidLink && (
              <p className="text-center text-sm text-[#9aa6bc]">
                <button
                  type="button"
                  className="text-[#ff2d8e] hover:underline"
                  onClick={() => setLocation("/forgot-password")}
                >
                  {COPY.hostForgotPassword.requestNewLink}
                </button>
              </p>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-[#9aa6bc]">
            {COPY.hostForgotPassword.rememberedIt}{" "}
            <button
              type="button"
              className="text-[#ff2d8e] hover:underline"
              onClick={() => setLocation("/admin-login")}
            >
              {COPY.hostForgotPassword.signIn}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
