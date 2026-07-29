import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ArrowLeft, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Read the token from the URL at render time
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.status === 503) {
        toast({ variant: "destructive", title: "Email service unavailable — contact your administrator" });
        return;
      }
      if (!res.ok) {
        setError((body as { error?: string }).error ?? "Reset failed. The link may have expired.");
        return;
      }

      setDone(true);
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
        <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <p className="text-[#ff6b6b]">Invalid reset link. Please request a new one.</p>
            <Button
              className="bg-[#ff2d8e] hover:bg-[#e0207d] text-white"
              onClick={() => setLocation("/forgot-password")}
            >
              Request new link
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
            <h2 className="text-xl font-bold text-white">Password updated</h2>
            <p className="text-[#9aa6bc] text-sm">
              Your password has been changed. You can now sign in with your new credentials.
            </p>
            <Button
              className="bg-[#ff2d8e] hover:bg-[#e0207d] text-white"
              onClick={() => setLocation("/admin-login")}
            >
              Sign in
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
              <button className="text-[#9aa6bc] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <CardTitle className="text-white text-xl">Set new password</CardTitle>
          </div>
          <p className="text-[#9aa6bc] text-sm">
            Choose a new password for your admin account.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#9aa6bc]">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  className="pl-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#9aa6bc]">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat your new password"
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
              className="w-full bg-[#ff2d8e] hover:bg-[#e0207d] text-white font-bold h-12"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
