/**
 * Owner usage dashboard — shows per-host plan, game counts, and AI volume.
 * Protected by the ADMIN_ACCESS_KEY (Bearer token) — not tied to a host account.
 *
 * Access: navigate to /owner-dashboard, enter the ADMIN_ACCESS_KEY when prompted.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  Sparkles,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type HostSummary = {
  id: number;
  email: string;
  plan: "free" | "pro";
  createdAt: string;
  gamesTotal: number;
  gamesThisMonth: number;
  aiActionsTotal: number;
  aiActionsThisMonth: number;
};

type UsageData = {
  hosts: HostSummary[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OwnerDashboard() {
  const [ownerKey, setOwnerKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UsageData | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [updatingPlan, setUpdatingPlan] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchUsage = useCallback(
    async (key: string) => {
      setLoading(true);
      setFetchError("");
      try {
        const res = await fetch("/api/owner/usage", {
          headers: { Authorization: `Bearer ${key}` },
          credentials: "include",
        });
        if (res.status === 401) {
          setAuthError("Incorrect owner key — try again");
          setAuthenticated(false);
          return;
        }
        if (!res.ok) {
          setFetchError("Failed to load usage data");
          return;
        }
        const json = (await res.json()) as UsageData;
        setData(json);
        setAuthenticated(true);
        setAuthError("");
      } catch {
        setFetchError("Connection error — please retry");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerKey.trim()) {
      setAuthError("Enter the owner key");
      return;
    }
    await fetchUsage(ownerKey.trim());
  };

  const togglePlan = async (host: HostSummary) => {
    const newPlan = host.plan === "free" ? "pro" : "free";
    setUpdatingPlan(host.id);
    try {
      const res = await fetch(`/api/owner/hosts/${host.id}/plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerKey}`,
        },
        credentials: "include",
        body: JSON.stringify({ plan: newPlan }),
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Failed to update plan" });
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              hosts: prev.hosts.map((h) =>
                h.id === host.id ? { ...h, plan: newPlan } : h,
              ),
            }
          : prev,
      );
      toast({ title: `${host.email} moved to ${newPlan}` });
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    } finally {
      setUpdatingPlan(null);
    }
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Owner Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Enter your owner key to view usage data
            </p>
          </div>
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={ownerKey}
                    onChange={(e) => {
                      setOwnerKey(e.target.value);
                      setAuthError("");
                    }}
                    placeholder="Owner key (ADMIN_ACCESS_KEY)"
                    autoFocus
                    className={`pl-9 ${authError ? "border-destructive" : ""}`}
                  />
                </div>
                {authError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {authError}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Unlock Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  const hosts = data?.hosts ?? [];
  const totalHosts = hosts.length;
  const proHosts = hosts.filter((h) => h.plan === "pro").length;
  const totalGamesMonth = hosts.reduce((s, h) => s + h.gamesThisMonth, 0);
  const totalAiMonth = hosts.reduce((s, h) => s + h.aiActionsThisMonth, 0);

  return (
    <div className="min-h-[100dvh] p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Usage by host · this calendar month</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsage(ownerKey)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {fetchError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Total hosts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalHosts}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{proHosts} pro</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5" /> Games this month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalGamesMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI actions this month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalAiMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Pro conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">
              {totalHosts > 0 ? Math.round((proHosts / totalHosts) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hosts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Hosts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No host accounts yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Games (mo / total)</TableHead>
                    <TableHead className="text-right">AI actions (mo / total)</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hosts.map((host) => (
                    <TableRow key={host.id}>
                      <TableCell className="font-medium">{host.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={host.plan === "pro" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {host.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {host.gamesThisMonth} / {host.gamesTotal}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {host.aiActionsThisMonth} / {host.aiActionsTotal}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(host.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePlan(host)}
                          disabled={updatingPlan === host.id}
                          className="text-xs"
                        >
                          {updatingPlan === host.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : host.plan === "free" ? (
                            "→ Pro"
                          ) : (
                            "→ Free"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
