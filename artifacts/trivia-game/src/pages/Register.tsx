import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { COPY } from "@workspace/copy";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    // Same checks, same order, same messages as the mobile form.
    if (!trimmedEmail) { setError(COPY.hostLogin.error.enterEmail); return; }
    if (!password) { setError(COPY.hostRegister.error.enterPassword); return; }
    if (password.length < 8) { setError(COPY.hostForgotPassword.error.passwordTooShort); return; }
    if (password !== confirm) { setError(COPY.hostForgotPassword.error.passwordsNoMatch); return; }
    setError("");
    setPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      if (res.status === 503) {
        setError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? COPY.hostLogin.error.somethingWrong);
        return;
      }

      setResendMsg("");
      setDone(true);
    } catch {
      setError(COPY.hostLogin.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  // Re-issues the verification link for the address just registered
  // (mirrors the mobile verify step's resend-code affordance).
  const handleResend = async () => {
    if (resending) return;
    setResendMsg("");
    setError("");
    setResending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 503) {
        setError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }
      // Server always returns a generic ack (no enumeration).
      setResendMsg(COPY.hostRegister.verify.resent);
    } catch {
      setError(COPY.hostLogin.error.connectionError);
    } finally {
      setResending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
        <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
          <CardHeader className="pb-2">
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-[#9aa6bc] hover:text-white transition-colors"
              onClick={() => { setDone(false); setError(""); }}
            >
              <ArrowLeft className="w-4 h-4" />
              {COPY.common.back}
            </button>
          </CardHeader>
          <CardContent className="pt-4 pb-8 text-center space-y-4">
            <Mail className="w-12 h-12 text-[#ff2d8e] mx-auto" />
            <h2 className="text-xl font-extrabold tracking-widest text-white">{COPY.hostRegister.verify.heading}</h2>
            <p className="text-[#9aa6bc] text-sm">
              {COPY.hostRegister.verify.linkHelperPrefix}{" "}
              <strong className="text-white break-all">{email.trim().toLowerCase()}</strong>.{" "}
              {COPY.hostRegister.verify.linkHelperSuffix}
            </p>
            <p className="text-[#9aa6bc] text-xs">
              {COPY.hostRegister.verify.resendPrompt}{" "}
              <button
                type="button"
                className="text-[#ff2d8e] hover:underline disabled:opacity-60"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? COPY.hostRegister.verify.resending : COPY.hostRegister.verify.resendLink}
              </button>
            </p>
            {resendMsg && (
              <p className="text-[#9aa6bc] text-xs">{resendMsg}</p>
            )}
            {error && (
              <p className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <p className="text-sm text-[#9aa6bc] pt-2">
              {COPY.hostRegister.verify.wrongEmail}{" "}
              <button
                type="button"
                className="text-[#ff2d8e] hover:underline"
                onClick={() => { setDone(false); setError(""); }}
              >
                {COPY.hostRegister.verify.startOver}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
      <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin-login">
              <button className="flex items-center gap-1 text-sm text-[#9aa6bc] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                {COPY.common.back}
              </button>
            </Link>
          </div>
          <CardTitle className="text-white text-xl tracking-widest">{COPY.hostRegister.heading}</CardTitle>
          <p className="text-[#9aa6bc] text-sm">
            {COPY.hostRegister.helper}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold tracking-widest text-[#9aa6bc]">{COPY.hostLogin.emailLabel}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder={COPY.hostLogin.emailPlaceholder}
                  className="pl-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold tracking-widest text-[#9aa6bc]">{COPY.hostLogin.passwordLabel}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder={COPY.hostRegister.passwordPlaceholder}
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
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  placeholder={COPY.hostForgotPassword.confirmPlaceholder}
                  className="pl-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-center text-xs text-[#9aa6bc] leading-relaxed">
              {COPY.hostRegister.legalPrefix}{" "}
              <Link href="/terms" className="text-[#ff2d8e] hover:underline">
                {COPY.footer.termsOfService}
              </Link>{" "}
              {COPY.hostRegister.legalAnd}{" "}
              <Link href="/privacy" className="text-[#ff2d8e] hover:underline">
                {COPY.footer.privacyPolicy}
              </Link>
              .
            </p>

            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-[#ff2d8e] hover:bg-[#e0207d] text-white font-bold h-12 tracking-wider"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : COPY.hostRegister.submitBtn}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[#9aa6bc]">
            {COPY.hostRegister.haveAccount}{" "}
            <button
              type="button"
              className="text-[#ff2d8e] hover:underline"
              onClick={() => setLocation("/admin-login")}
            >
              {COPY.hostRegister.signInLink}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
