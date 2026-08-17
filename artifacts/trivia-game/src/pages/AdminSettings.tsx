import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { COPY } from "@workspace/copy";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Lock,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────

function apiFetch(path: string, options?: RequestInit) {
  return fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
}

// ── Small reusable inline message ────────────────────────────────────────────

function InlineMsg({ kind, text }: { kind: "error" | "success"; text: string }) {
  const isErr = kind === "error";
  return (
    <p className={`flex items-start gap-1.5 text-sm ${isErr ? "text-destructive" : "text-green-400"}`}>
      {isErr
        ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      {text}
    </p>
  );
}

// ── Password field with show/hide toggle ─────────────────────────────────────

function PwField({
  value, onChange, placeholder, autoComplete, isError,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  isError?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`h-11 bg-background pr-10 border-primary/30 focus-visible:ring-primary ${isError ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Card: Change password ─────────────────────────────────────────────────────

function ChangePasswordCard() {
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mismatch = !!pwConfirm && pwConfirm !== pwNew;

  const clear = () => { setPwCurrent(""); setPwNew(""); setPwConfirm(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!pwCurrent) { setError("Please enter your current password."); return; }
    if (pwNew.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { setError("New passwords do not match."); return; }
    setSaving(true);
    try {
      const r = await apiFetch("/api/auth/email/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const json = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!r.ok) {
        setError(json.error ?? `HTTP ${r.status}`);
        return;
      }
      clear();
      setSuccess(json.message ?? "Password changed successfully.");
    } catch {
      setError("Connection error — please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your current password and choose a new one (at least 8 characters).
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Current password
            </label>
            <PwField
              value={pwCurrent}
              onChange={(v) => { setPwCurrent(v); setError(""); setSuccess(""); }}
              placeholder="Current password"
              autoComplete="current-password"
              isError={!!error && !pwCurrent}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New password
            </label>
            <PwField
              value={pwNew}
              onChange={(v) => { setPwNew(v); setError(""); setSuccess(""); }}
              placeholder="New password (min. 8 characters)"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Confirm new password
            </label>
            <PwField
              value={pwConfirm}
              onChange={(v) => { setPwConfirm(v); setError(""); setSuccess(""); }}
              placeholder="Confirm new password"
              autoComplete="new-password"
              isError={mismatch}
            />
            {mismatch && <InlineMsg kind="error" text="Passwords do not match." />}
          </div>

          {error && <InlineMsg kind="error" text={error} />}
          {success && <InlineMsg kind="success" text={success} />}

          <Button type="submit" disabled={saving} className="w-full h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Card: Danger zone ─────────────────────────────────────────────────────────

function DangerZoneCard() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      const r = await apiFetch("/api/auth/email/account", { method: "DELETE" });
      if (!r.ok) {
        const json = await r.json().catch(() => ({})) as { error?: string };
        setError(json.error ?? "Failed to delete account. Please try again.");
        return;
      }
      await logout();
      setLocation("/");
    } catch {
      setError("Connection error — please retry.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {COPY.heading.dangerZone}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Deleting your account is permanent and cannot be undone. Your account and all associated games will be removed immediately.
        </p>

        {error && <InlineMsg kind="error" text={error} />}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting} className="w-full h-11">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {COPY.btn.deleteAccount}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all your games. This cannot be undone.
                Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ── Card: Legal ───────────────────────────────────────────────────────────────

function LegalCard() {
  const links = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Support", href: "/support" },
  ] as const;

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Legal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {links.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between py-3 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {label}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AdminSettings() {
  return (
    <div className="max-w-lg space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{COPY.nav.rooms}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your password and account.
        </p>
      </div>
      <ChangePasswordCard />
      <DangerZoneCard />
      <LegalCard />
    </div>
  );
}
