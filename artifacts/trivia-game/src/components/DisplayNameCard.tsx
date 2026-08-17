import { useEffect, useState } from "react";
import { COPY } from "@workspace/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function apiFetch(path: string, options?: RequestInit) {
  return fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
}

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

export function DisplayNameCard() {
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue]     = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const dn = COPY.account.displayName;

  useEffect(() => {
    (async () => {
      try {
        const r    = await apiFetch("/api/account/display-name");
        const data = (await r.json()) as { displayName: string | null };
        const name = data.displayName ?? "";
        setCurrent(name);
        setValue(name);
      } catch {
        // non-fatal — leave value empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const r    = await apiFetch("/api/account/display-name", {
        method: "PATCH",
        body:   JSON.stringify({ displayName: value }),
      });
      const json = (await r.json()) as { ok?: boolean; error?: string; message?: string; displayName?: string };
      if (!r.ok) {
        const msg =
          json.error === "too_long"        ? dn.errorTooLong  :
          json.error === "content_filtered" ? dn.errorBlocked  :
          json.error === "empty"            ? dn.errorEmpty    :
          dn.errorFailed;
        setError(msg);
        return;
      }
      const saved = json.displayName ?? value.trim();
      setCurrent(saved);
      setValue(saved);
      setSuccess(dn.saved);
    } catch {
      setError(dn.errorFailed);
    } finally {
      setSaving(false);
    }
  };

  const unchanged = value.trim() === (current ?? "");

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4 text-primary" />
          {dn.sectionTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-muted-foreground">{dn.description}</p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <Input
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); setSuccess(""); }}
              placeholder={dn.placeholder}
              maxLength={64}
              className="h-11 bg-background border-primary/30 focus-visible:ring-primary"
              autoComplete="off"
              autoCorrect="off"
            />
          )}

          <p className="text-xs text-muted-foreground">
            {dn.previewLabel}{" "}
            <span className="font-medium text-foreground">
              {value.trim()
                ? `${value.trim()}${COPY.hostName.suffix}`
                : COPY.hostName.generic}
            </span>
          </p>

          {error   && <InlineMsg kind="error"   text={error}   />}
          {success && <InlineMsg kind="success"  text={success} />}

          <Button
            type="submit"
            disabled={saving || loading || unchanged}
            className="w-full h-11"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {dn.saveBtn}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
