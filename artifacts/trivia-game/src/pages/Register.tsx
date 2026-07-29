import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, ArrowLeft, CheckCircle } from "lucide-react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.status === 503) {
        toast({ variant: "destructive", title: "Email service unavailable — contact your administrator" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Registration failed");
        return;
      }

      setDone(true);
    } catch {
      toast({ variant: "destructive", title: "Connection error — please retry" });
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
            <h2 className="text-xl font-bold text-white">Check your email</h2>
            <p className="text-[#9aa6bc] text-sm">
              We've sent a verification link to <strong className="text-white">{email}</strong>.
              Click the link in that email to activate your account.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-[#1b2740] text-[#9aa6bc] hover:text-white"
              onClick={() => setLocation("/admin-login")}
            >
              Back to login
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
            <CardTitle className="text-white text-xl">Create admin account</CardTitle>
          </div>
          <p className="text-[#9aa6bc] text-sm">
            Register with your email to access the Queen Trivia admin console.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#9aa6bc]">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="pl-10 bg-[#060d16] border-[#1b2740] text-white placeholder:text-[#3d5068] focus:border-[#ff2d8e]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#9aa6bc]">Password</label>
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
              <label className="text-sm text-[#9aa6bc]">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa6bc]" />
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat your password"
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
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[#9aa6bc]">
            Already have an account?{" "}
            <Link href="/admin-login" className="text-[#ff2d8e] hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
