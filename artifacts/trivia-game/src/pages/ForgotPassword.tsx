import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { COPY } from "@workspace/copy";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError(COPY.hostForgotPassword.error.enterEmail); return; }
    setError("");
    setPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (res.status === 503) {
        setError(COPY.hostForgotPassword.error.emailServiceDown);
        return;
      }

      // Always show success to avoid account enumeration
      setDone(true);
    } catch {
      setError(COPY.hostForgotPassword.error.connectionError);
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
        <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-[#35d07f] mx-auto" />
            <h2 className="text-xl font-extrabold tracking-widest text-white">{COPY.hostForgotPassword.sentHeading}</h2>
            <p className="text-[#9aa6bc] text-sm">
              {COPY.hostForgotPassword.sentBodyPrefix}{" "}
              <strong className="text-white break-all">{email.trim().toLowerCase()}</strong>{" "}
              {COPY.hostForgotPassword.sentBodySuffix}
            </p>
            <Button
              variant="outline"
              className="mt-4 border-[#1b2740] text-[#9aa6bc] hover:text-white"
              onClick={() => setLocation("/admin-login")}
            >
              {COPY.hostForgotPassword.backToSignIn}
            </Button>
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
                {COPY.hostForgotPassword.back}
              </button>
            </Link>
          </div>
          <CardTitle className="text-white text-xl tracking-widest">{COPY.hostForgotPassword.heading}</CardTitle>
          <p className="text-[#9aa6bc] text-sm">
            {COPY.hostForgotPassword.helperLink}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold tracking-widest text-[#9aa6bc]">{COPY.hostForgotPassword.emailLabel}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder={COPY.hostForgotPassword.emailPlaceholder}
                  className="pl-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
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
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : COPY.hostForgotPassword.sendLinkBtn}
            </Button>
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
