
import { useMemo } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useLobbySocket } from "../hooks/useGameSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
 Trophy,
 Users,
 Gamepad2,
 Zap,
 LogOut,
 ChevronRight,
 Radio,
 Hourglass,
 Crown,
 Clock,
 PlayCircle,
} from "lucide-react";


const difficultyColors: Record<string, string> = {
 easy: "bg-secondary/15 text-secondary border-secondary/40",
 medium: "bg-accent/15 text-accent border-accent/40",
 hard: "bg-primary/15 text-primary border-primary/40",
};


// Fetches participants for a single game and checks if user is already in it
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


// Active game card — fetches its own participants
function ActiveGameCard({
    game,
    userId,
    onJoin,
    joining,
}: {
    game: { id: number; topic: string; difficulty: string; questionCount: number; status: string };
    userId: number;
    onJoin: (gameId: number, alreadyJoined: boolean) => void;
    joining: boolean;
}) {
    const { participants, joined } = useGameParticipation(game.id, userId);
    const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);
return (
 <motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  className="space-y-4"
 >
  {/* Game banner */}
  <Card className="border-2 border-primary/50 bg-primary/5 backdrop-blur">
     <CardContent className="p-5 space-y-4">
     <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse inline-block" />
        Live Now
       </div>
       <h2 className="text-2xl font-bold tracking-tight">{game.topic}</h2>
       <div className="flex items-center gap-2 text-sm text-muted-foreground">
       <span>{game.questionCount} {game.questionCount === 1 ? "question" :"questions"}</span>
        <span>·</span>
        <Badge
           variant="outline"
           className={`uppercase text-[10px] ${difficultyColors[game.difficulty] ?? ""}`}
        >
           {game.difficulty}
         </Badge>
      </div>
     </div>
     <Button
      size="lg"
      className="font-bold h-12 px-6"
      disabled={joining}
      onClick={() => onJoin(game.id, joined)}
     >
      {joined ? (
         <>
           <PlayCircle className="mr-2 h-5 w-5" /> Continue Game
         </>
      ):(
         <>
           Join Game <ChevronRight className="ml-1 h-5 w-5" />
         </>
      )}
     </Button>
    </div>


    {/* Participants */}
    {sorted.length > 0 && (
     <div className="space-y-2">
       <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
         <Users className="h-3.5 w-3.5" /> {sorted.length} player{sorted.length !== 1 ? "s" :""} in the game
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
       {sorted.map((p, i) => (
        <div
         key={p.id}
         className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
             p.userId === userId
              ? "bg-primary/15 border border-primary/30"
              : "bg-background/40 border border-transparent"
         }`}
        >
         {i === 0 ? (
             <Crown className="h-3.5 w-3.5 text-accent shrink-0" />
         ):(
             <span className="w-3.5 text-center text-xs font-bold text-muted-foregroundshrink-0">
              {i + 1}
             </span>
         )}
         <span className="truncate font-medium">
             {p.userName}
             {p.userId === userId && (
              <span className="text-primary text-[10px] ml-1">(you)</span>
             )}
         </span>
                 <span className="ml-auto font-bold tabular-nums text-accent text-xs shrink-0">
                     {p.totalScore}
                 </span>
                </div>
               ))}
               </div>
           </div>
          )}
          </CardContent>
         </Card>
     </motion.div>
    );
}


export default function Lobby() {
    const { user, logout } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const userId = user?.id ?? 0;


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
      title: "� Game Starting!",
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
 if (alreadyJoined) {
     setLocation(`/game/${gameId}`);
     return;
 }
 if (!user) return;
 joinGame.mutate(
     { gameId, data: {} },
     {
         onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          setLocation(`/game/${gameId}`);
         },
         onError: () =>
          toast({ variant: "destructive", title: "Could not join game" }),
     },
 );
};


const statCards = [
  { label: "Games Hosted", value: stats?.totalGames ?? 0, icon: Gamepad2, color: "text-primary" },
  { label: "Live Games", value: stats?.activeGames ?? 0, icon: Radio, color: "text-secondary" },
 { label: "Players", value: stats?.totalPlayers ?? 0, icon: Users, color: "text-accent" },
 { label: "Answers Fired", value: stats?.totalAnswers ?? 0, icon: Zap, color: "text-primary" },
];


if (!user) return null;
return (
 <div className="min-h-[100dvh] p-4 md:p-8">
  <div className="mx-auto max-w-4xl space-y-8">
   {/* Header */}
     <header className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
    <div>
     <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-primary">
        THE LOBBY
     </h1>
     <p className="text-muted-foreground">
        Playing as{" "}
        <span className="font-semibold text-secondary">{user.name}</span>
     </p>
    </div>
    <Button
     variant="ghost"
     onClick={async () => {
        await logout();
        setLocation("/");
     }}
     className="text-muted-foreground hover:text-foreground"
    >
     <LogOut className="mr-2 h-4 w-4" /> Leave
    </Button>
</header>


{/* Stat strip */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {statCards.map((s, i) => (
  <motion.div
   key={s.label}
   initial={{ opacity: 0, y: 12 }}
   animate={{ opacity: 1, y: 0 }}
   transition={{ delay: i * 0.07 }}
  >
   <Card className="border-card-border bg-card/60 backdrop-blur">
       <CardContent className="p-4 flex items-center gap-3">
       <s.icon className={`h-6 w-6 shrink-0 ${s.color}`} />
       <div>
        <div className="text-2xl font-bold tabular-nums">{s.value}</div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
         {s.label}
        </div>
       </div>
       </CardContent>
   </Card>
  </motion.div>
 ))}
</div>
   {/* Main game area */}
   <AnimatePresence mode="wait">
    {isLoading ? (
     <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid gap-3 md:grid-cols-2"
     >
      {[0, 1].map((i) => (
         <div key={i} className="h-36 rounded-lg bg-card/60 animate-pulse" />
      ))}
     </motion.div>
    ) : activeGames.length > 0 ? (
     <motion.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
     >
       <h2 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
         Game in Progress
      </h2>
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
      <Card className="border-secondary/30 bg-secondary/5">
         <CardContent className="py-14 text-center space-y-4">
         <div className="relative mx-auto w-fit">
            <Hourglass className="h-14 w-14 text-secondary/60" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-secondaryanimate-pulse" />
         </div>
         <div>
            <h3 className="text-2xl font-bold tracking-tight text-secondary">
          Waiting for the next game
         </h3>
         <p className="text-muted-foreground mt-1 max-w-md mx-auto">
          Your host is preparing{" "}
          <span className="font-semibold text-foreground">
           {waitingGames[0]!.topic}
          </span>
          . Sit tight — the game will go live any moment.
         </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
         <Clock className="h-4 w-4" />
         <span>This page refreshes automatically every 5 seconds</span>
        </div>
        {/* Show upcoming games */}
        {waitingGames.length > 0 && (
         <div className="pt-2 space-y-2 max-w-sm mx-auto text-left">
          {waitingGames.map((g) => (
           <div
            key={g.id}
           className="flex items-center justify-between rounded-lg border border-secondary/20 bg-card/60 px-4 py-2.5 text-sm"
           >
            <span className="font-medium">{g.topic}</span>
            <div className="flex items-center gap-2">
               <span className="text-muted-foreground">
                 {g.questionCount} questions
                 </span>
                 <Badge
                 variant="outline"
                 className={`uppercase text-[10px] ${difficultyColors[g.difficulty] ?? ""}`}
                 >
                 {g.difficulty}
                 </Badge>
             </div>
            </div>
           ))}
       </div>
      )}
    </CardContent>
 </Card>
</motion.div>
):(
<motion.div
 key="empty"
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0 }}
>
 <Card className="border-dashed border-primary/30 bg-card/40">
    <CardContent className="py-16 text-center space-y-3">
      <Trophy className="mx-auto h-12 w-12 text-primary/50" />
                <h3 className="text-2xl font-bold tracking-tight">
                  The stage is set
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your host is preparing tonight's trivia. Games will appear
                  here the moment they're ready — hang tight and warm up those
                  brain cells.
                </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                  <Clock className="h-4 w-4" />
                  <span>Checking for games every 5 seconds</span>
                </div>
               </CardContent>
               </Card>
           </motion.div>
          )}
         </AnimatePresence>
         </div>
         <Footer />
     </div>
    );
}


