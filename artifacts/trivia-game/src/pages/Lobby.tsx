
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import {
  useListGames,
  useGetStatsSummary,
  getGetStatsSummaryQueryKey,
  useJoinGame,
  getListGamesQueryKey,
  useListGameParticipants,
  getListGameParticipantsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useLobbySocket } from "../hooks/useGameSocket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Gamepad2,
  Crown,
  PlayCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Clock,
  Hourglass,
  Trophy,
} from "lucide-react";

// ─── Avatar colors ────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#ff0080", "#00ddff", "#8b5cf6", "#22c55e", "#f97316"];
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length] ?? "#ff0080"; }
function initials(name: string) { return name.trim().charAt(0).toUpperCase(); }

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameResults {
  game: { id: number; topic: string; questionCount: number };
  participants: {
    id: number; userId: number; userName: string;
    totalScore: number; rank: number; totalAnswered: number; correctCount: number;
  }[];
  totalQuestions: number;
}

function useGameResults(gameId: number, enabled: boolean) {
  return useQuery<GameResults>({
    queryKey: ["game-results", gameId],
    queryFn: async () => {
      const r = await fetch(`/api/games/${gameId}/results`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch results");
      return r.json();
    },
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}

// ─── Players modal (unchanged) ────────────────────────────────────────────────
function PlayersModal({
  open, onClose, activeGames,
}: {
  open: boolean;
  onClose: () => void;
  activeGames: { id: number; topic: string; questionCount: number }[];
}) {
  const results = activeGames.map((g) => ({
    gameId: g.id,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    query: useGameResults(g.id, open && activeGames.length > 0),
  }));

  const loading = results.some((r) => r.query.isLoading);
  const allParticipants = results.flatMap((r) => {
    if (!r.query.data) return [];
    const { participants, totalQuestions, game } = r.query.data;
    return participants.map((p) => ({
      ...p, gameTopic: game.topic, gameId: game.id,
      totalQuestions, done: p.totalAnswered >= totalQuestions && totalQuestions > 0,
    }));
  });

  const sorted = [...allParticipants].sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    return b.totalScore - a.totalScore;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Users className="h-4 w-4 text-accent" /> Players
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading players…</span>
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No players yet — be the first to join!
            </p>
          ) : (
            sorted.map((p, i) => (
              <div key={`${p.gameId}-${p.userId}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-card/60 border border-border/40">
                <span className="w-5 text-center text-xs font-bold tabular-nums text-muted-foreground shrink-0">
                  {i === 0 ? <Crown className="h-3.5 w-3.5 text-accent mx-auto" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate text-sm">{p.userName}</p>
                  {activeGames.length > 1 && (
                    <p className="text-[10px] text-muted-foreground truncate">{p.gameTopic}</p>
                  )}
                </div>
                {p.done ? (
                  <div className="flex items-center gap-1 text-secondary text-xs font-medium shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Done
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {p.totalAnswered}/{p.totalQuestions}
                  </span>
                )}
                <span className="font-bold tabular-nums text-sm text-accent shrink-0 w-10 text-right">
                  {p.totalScore}
                </span>
              </div>
            ))
          )}
        </div>
        {sorted.length > 0 && (
          <div className="px-5 pb-4 pt-1 text-center text-[10px] text-muted-foreground">
            {sorted.filter((p) => p.done).length} of {sorted.length} player{sorted.length !== 1 ? "s" : ""} finished
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Difficulty chip ──────────────────────────────────────────────────────────
const difficultyColors: Record<string, string> = {
  easy:   "bg-secondary/15 text-secondary border-secondary/40",
  medium: "bg-accent/15 text-accent border-accent/40",
  hard:   "bg-primary/15 text-primary border-primary/40",
};

// ─── Participant hook ─────────────────────────────────────────────────────────
function useGameParticipation(gameId: number | null, userId: number) {
  const { data: participants } = useListGameParticipants(gameId ?? 0, {
    query: {
      enabled: !!gameId,
      queryKey: getListGameParticipantsQueryKey(gameId ?? 0),
      refetchInterval: 5000,
    },
  });
  const joined = useMemo(
    () => (participants ?? []).some((p) => p.userId === userId),
    [participants, userId],
  );
  return { participants: participants ?? [], joined };
}

// ─── Active game card ─────────────────────────────────────────────────────────
function ActiveGameCard({
  game, userId, onJoin, joining,
}: {
  game: { id: number; topic: string; difficulty: string; questionCount: number; status: string };
  userId: number;
  onJoin: (gameId: number, alreadyJoined: boolean) => void;
  joining: boolean;
}) {
  const { participants, joined } = useGameParticipation(game.id, userId);
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);
  const displayParticipants = sorted.slice(0, 4);
  const extra = sorted.length - 4;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div
        className="rounded-[20px] overflow-hidden"
        style={{
          padding: 18,
          background: "rgba(255,0,128,.1)",
          border: "1.5px solid rgba(255,0,128,.4)",
        }}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          <span
            className="h-[8px] w-[8px] rounded-full inline-block animate-pulse"
            style={{ background: "#ff5aa8" }}
          />
          <span
            className="font-extrabold uppercase"
            style={{ fontSize: 10, letterSpacing: ".18em", color: "#ff5aa8" }}
          >
            Live Now
          </span>
        </div>

        {/* Title */}
        <h2 className="font-extrabold text-white mb-2 break-words" style={{ fontSize: 24 }}>
          {game.topic}
        </h2>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: 13, fontWeight: 600, color: "#c7b8e0" }}>
            {game.questionCount} {game.questionCount === 1 ? "question" : "questions"}
          </span>
          <span style={{ color: "#8b7ea3" }}>·</span>
          <Badge
            variant="outline"
            className={`uppercase text-[10px] ${difficultyColors[game.difficulty] ?? ""}`}
            style={{ borderRadius: 8 }}
          >
            {game.difficulty}
          </Badge>
        </div>

        {/* Avatar stack */}
        {sorted.length > 0 && (
          <div className="flex items-center mb-4">
            <div className="flex items-center">
              {displayParticipants.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-center rounded-full font-extrabold text-[11px]"
                  style={{
                    width: 30, height: 30,
                    background: avatarColor(i),
                    color: "#ffffff",
                    border: "2px solid #0d0f15",
                    marginLeft: i > 0 ? -8 : 0,
                    zIndex: displayParticipants.length - i,
                    position: "relative",
                  }}
                >
                  {initials(p.userName)}
                </div>
              ))}
              {extra > 0 && (
                <div
                  className="flex items-center justify-center rounded-full font-bold text-[11px]"
                  style={{
                    width: 30, height: 30,
                    background: "rgba(255,255,255,.12)",
                    color: "#ffffff",
                    border: "2px solid #0d0f15",
                    marginLeft: -8,
                    position: "relative",
                    zIndex: 0,
                  }}
                >
                  +{extra}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          disabled={joining}
          onClick={() => onJoin(game.id, joined)}
          className="w-full font-extrabold uppercase disabled:opacity-60"
          style={{
            height: 54,
            borderRadius: 16,
            background: "#ffe500",
            color: "#0a0510",
            letterSpacing: ".08em",
            fontSize: 15,
            boxShadow: "0 8px 24px rgba(255,229,0,.4)",
            border: "none",
            cursor: joining ? "not-allowed" : "pointer",
          }}
        >
          {joining ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Joining…
            </span>
          ) : joined ? (
            <span className="flex items-center justify-center gap-2">
              <PlayCircle className="h-5 w-5" /> Continue →
            </span>
          ) : (
            "JOIN GAME →"
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
export default function Lobby() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 0;
  const [showPlayers, setShowPlayers] = useState(false);

  const { data: games, isLoading } = useListGames(undefined, {
    query: { refetchInterval: 5000, queryKey: getListGamesQueryKey() },
  });
  const { data: stats } = useGetStatsSummary({
    query: { refetchInterval: 10000, queryKey: getGetStatsSummaryQueryKey() },
  });

  const joinGame = useJoinGame();

  useLobbySocket({
    onGameStarted: ({ topic }) => {
      queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
      toast({
        title: "🎮 Game Starting!",
        description: `"${topic}" is now live — join now!`,
      });
    },
  });

  const activeGames = useMemo(
    () => (games ?? []).filter((g) => g.status === "active"),
    [games],
  );
  const waitingGames = useMemo(
    () => (games ?? []).filter((g) => g.status === "waiting"),
    [games],
  );

  const handleJoin = (gameId: number, alreadyJoined: boolean) => {
    if (alreadyJoined) { setLocation(`/game/${gameId}`); return; }
    if (!user) return;
    joinGame.mutate(
      { gameId, data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          setLocation(`/game/${gameId}`);
        },
        onError: () => toast({ variant: "destructive", title: "Could not join game" }),
      },
    );
  };

  // Stat chips data
  const statChips = [
    { label: "LIVE",    value: activeGames.length,        color: "#00ddff" },
    { label: "PLAYERS", value: stats?.totalPlayers ?? 0,  color: "#ffe500",
      clickable: activeGames.length > 0 },
    { label: "GAMES",   value: stats?.totalGames ?? 0,    color: "#ff0080" },
  ];

  if (!user) return null;

  return (
    <>
      <div className="min-h-[100dvh]">
        <div className="mx-auto max-w-md px-[22px] pt-12 pb-16 space-y-6">

          {/* ── Header row ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            {/* Back / leave button */}
            <button
              onClick={async () => { await logout(); setLocation("/"); }}
              className="flex items-center justify-center shrink-0 mt-1"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(255,255,255,.08)", border: "none", cursor: "pointer",
              }}
              aria-label="Leave lobby"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>

            <div className="flex-1">
              <h1
                className="font-extrabold leading-none"
                style={{ fontSize: 30, color: "#ffffff", letterSpacing: "-.01em" }}
              >
                THE LOBBY
              </h1>
              <p className="mt-1" style={{ fontSize: 15, fontWeight: 500, color: "#a3aec2" }}>
                Playing as{" "}
                <span style={{ color: "#00ddff", fontWeight: 700 }}>{user.name}</span>
              </p>
            </div>
          </motion.div>

          {/* ── Stat chips ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className="grid grid-cols-3 gap-3"
          >
            {statChips.map((chip) => (
              <div
                key={chip.label}
                onClick={chip.clickable ? () => setShowPlayers(true) : undefined}
                className="rounded-[14px] flex flex-col items-center justify-center py-4"
                style={{
                  background: "rgba(255,255,255,.05)",
                  cursor: chip.clickable ? "pointer" : "default",
                }}
              >
                <span
                  className="font-extrabold tabular-nums"
                  style={{ fontSize: 20, color: chip.color, lineHeight: 1 }}
                >
                  {chip.value}
                </span>
                <span
                  className="font-semibold uppercase mt-1"
                  style={{ fontSize: 9, letterSpacing: ".14em", color: "#a3aec2" }}
                >
                  {chip.label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* ── Main game area ── */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="h-48 rounded-[20px] animate-pulse" style={{ background: "rgba(255,255,255,.04)" }} />
              </motion.div>

            ) : activeGames.length > 0 ? (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {activeGames.map((game) => (
                  <ActiveGameCard
                    key={game.id}
                    game={game}
                    userId={userId}
                    onJoin={handleJoin}
                    joining={joinGame.isPending}
                  />
                ))}
              </motion.div>

            ) : waitingGames.length > 0 ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="rounded-[20px] p-5 space-y-4"
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.1)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Hourglass className="h-5 w-5 text-secondary/70 shrink-0" />
                    <span
                      className="font-extrabold uppercase"
                      style={{ fontSize: 10, letterSpacing: ".18em", color: "#00ddff" }}
                    >
                      Up Next
                    </span>
                  </div>
                  <div>
                    <h3
                      className="font-extrabold text-white break-words"
                      style={{ fontSize: 22, letterSpacing: "-.01em" }}
                    >
                      {waitingGames[0]!.topic}
                    </h3>
                    <p style={{ fontSize: 13, color: "#8b7ea3", marginTop: 4 }}>
                      Your host is preparing the game. Hang tight.
                    </p>
                  </div>
                  <div className="flex items-center gap-2" style={{ fontSize: 12, color: "#8b7ea3" }}>
                    <Clock className="h-3.5 w-3.5" />
                    Checking for updates every 5 seconds
                  </div>
                </div>
              </motion.div>

            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="rounded-[20px] p-8 flex flex-col items-center text-center space-y-4"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px dashed rgba(255,255,255,.1)",
                  }}
                >
                  <Trophy className="h-12 w-12" style={{ color: "rgba(255,0,128,.4)" }} />
                  <div>
                    <h3 className="font-extrabold text-white" style={{ fontSize: 20 }}>
                      The stage is set
                    </h3>
                    <p style={{ fontSize: 13, color: "#8b7ea3", marginTop: 6, lineHeight: 1.6 }}>
                      Your host is preparing tonight's trivia. Games appear here when they're live.
                    </p>
                  </div>
                  <div className="flex items-center gap-2" style={{ fontSize: 12, color: "#8b7ea3" }}>
                    <Clock className="h-3.5 w-3.5" />
                    Checking every 5 seconds
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        <Footer />
      </div>

      <PlayersModal
        open={showPlayers}
        onClose={() => setShowPlayers(false)}
        activeGames={activeGames.map((g) => ({
          id: g.id, topic: g.topic, questionCount: g.questionCount,
        }))}
      />
    </>
  );
}
