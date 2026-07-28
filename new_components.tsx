
// =========================================================================
// NEW DESIGN COMPONENTS
// =========================================================================

function LiveGameView({
  activeGame,
  endGame,
}: {
  activeGame?: Game;
  endGame: (id: number) => void;
}) {
  const { data: qData } = useListGameQuestions(activeGame?.id ?? 0, {
    query: { enabled: !!activeGame, queryKey: getListGameQuestionsQueryKey(activeGame?.id ?? 0) },
  });
  const questions = qData?.questions ?? [];
  const currentQ = questions.find((q) => q.questionOrder === (activeGame?.currentQuestionIndex ?? 0) + 1) || questions[0];

  const { data: parts = [] } = useListGameParticipants(activeGame?.id ?? 0, {
    query: { enabled: !!activeGame, queryKey: getListGameParticipantsQueryKey(activeGame?.id ?? 0) },
  });

  const sortedParticipants = [...parts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6);

  if (!activeGame) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Radio className="h-16 w-16 text-[#66728a] mb-4" />
        <h2 className="text-xl font-bold text-[#eef2f8] mb-2">No game is live right now</h2>
        <p className="text-[#9aa6bc] mb-6">Go to Games to launch one</p>
      </div>
    );
  }

  const accessCode = activeGame?.id ? "123456" : "WAIT"; // stub for now, actually it's global

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a1019] p-4 rounded-xl border border-[#1b2740]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2d8e]/10 border border-[#ff2d8e]/30">
            <span className="h-2 w-2 rounded-full bg-[#ff2d8e] animate-pulse" />
            <span className="text-xs font-bold tracking-wider text-[#ff2d8e]">LIVE NOW</span>
          </div>
          <h1 className="text-lg font-bold text-white">{activeGame.topic}</h1>
          <div className="flex items-center gap-2 bg-[#00d4f0]/10 text-[#00d4f0] px-3 py-1 rounded-md font-mono text-sm border border-[#00d4f0]/20">
            ROOM <span className="font-bold">????</span>
          </div>
          <div className="flex items-center gap-1 text-[#9aa6bc] text-sm">
            <Users className="w-4 h-4" />
            {parts.length}
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-[#ff6b6b] hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10"
          onClick={() => endGame(activeGame.id)}
        >
          <Flag className="w-4 h-4 mr-2" />
          End game
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COL */}
        <div className="flex-1 w-full space-y-4">
          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6">
            <div className="text-[10px] tracking-wider text-[#9aa6bc] font-bold mb-6">
              QUESTION {(activeGame.currentQuestionIndex ?? 0) + 1} / {questions.length || '?'}
            </div>
            
            <div className="flex gap-6 items-start mb-8">
              <div className="w-16 h-16 rounded-full border-4 border-[#ff2d8e]/20 border-t-[#ff2d8e] flex items-center justify-center shrink-0">
                <span className="text-[#ff2d8e] font-mono font-bold">20</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white leading-tight">
                {currentQ?.questionText || "Waiting for game to start…"}
              </h2>
            </div>

            <div className="space-y-3">
              {(currentQ?.options as any)?.choices?.map((c: string, i: number) => {
                const isCorrect = currentQ.correctAnswer === c;
                return (
                  <div key={i} className={`relative overflow-hidden rounded-xl border p-4 ${isCorrect ? 'border-[#35d07f] bg-[#35d07f]/10' : 'border-[#1b2740] bg-[#0a1019]'}`}>
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="font-medium text-[#eef2f8]">{c}</span>
                      {isCorrect && <CheckCircle2 className="w-5 h-5 text-[#35d07f]" />}
                    </div>
                    {/* Mock tally bar */}
                    <div className="absolute inset-0 bg-white/5 w-1/3 z-0" />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-[#1b2740]">
              <Button variant="ghost" disabled className="text-[#9aa6bc]">
                <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Prev
              </Button>
              <Button variant="ghost" className="text-[#ffe14d] hover:text-[#ffe14d] hover:bg-[#ffe14d]/10">
                <Square className="w-4 h-4 mr-2" /> Pause
              </Button>
              <Button variant="ghost" className="text-[#00d4f0] hover:text-[#00d4f0] hover:bg-[#00d4f0]/10">
                <Eye className="w-4 h-4 mr-2" /> Reveal
              </Button>
              <Button variant="ghost" className="text-[#ff6b6b] hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10">
                <ShieldCheck className="w-4 h-4 mr-2" /> Lock
              </Button>
              <Button 
                className="ml-auto bg-[#ff2d8e] hover:bg-[#ff2d8e]/90 text-white rounded-xl px-6"
                onClick={() => console.log('TODO: wire to host-advance endpoint')}
              >
                Next question <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT COL */}
        <div className="w-full lg:w-72 shrink-0 space-y-6">
          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#9aa6bc] mb-4 uppercase tracking-wider">Answered</h3>
            <div className="text-4xl font-mono font-bold text-[#00d4f0] mb-4">
              {parts.length} <span className="text-lg text-[#66728a]">/ {parts.length}</span>
            </div>
            <div className="h-2 bg-[#0a1019] rounded-full overflow-hidden mb-6">
              <div className="h-full bg-[#00d4f0] w-full" />
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {parts.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#0a1019] border border-[#1b2740]">
                  <div className="w-6 h-6 rounded-full bg-[#35d07f]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-[#35d07f]" />
                  </div>
                  <span className="text-sm font-medium text-[#eef2f8] truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#9aa6bc] mb-4 uppercase tracking-wider">Live Standings</h3>
            <div className="space-y-3">
              {sortedParticipants.length === 0 && (
                <p className="text-sm text-[#66728a] text-center py-4">No players yet</p>
              )}
              {sortedParticipants.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-[#ffe14d] text-black' : 'bg-[#1b2740] text-[#9aa6bc]'}`}>
                    {i + 1}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#ff2d8e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-[#eef2f8] flex-1 truncate">{p.name}</span>
                  <span className="text-sm font-mono text-[#00d4f0] font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GamesView({
  games,
  onNavigate,
}: {
  games: Game[];
  onNavigate: (section: Section, gameId?: number) => void;
}) {
  const [filter, setFilter] = useState<"all"|"live"|"drafts">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateGame = useUpdateGame();
  
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
  };

  const handleGoLive = async (game: Game) => {
    updateGame.mutate(
      { gameId: game.id, data: { status: "active" } },
      {
        onSuccess: () => { invalidate(); toast({ title: `"${game.topic}" is now live!` }); },
        onError: () => toast({ variant: "destructive", title: "Failed to start" }),
      }
    );
  };

  const filteredGames = games.filter(g => {
    if (filter === "live") return g.status === "active";
    if (filter === "drafts") return g.status === "waiting";
    return True;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-white">Your games</h1>
          <span className="bg-[#1b2740] text-[#9aa6bc] px-3 py-1 rounded-full text-sm font-bold">{games.length}</span>
        </div>
        <Button className="bg-[#ff2d8e] hover:bg-[#ff2d8e]/90 text-white rounded-xl" onClick={() => onNavigate("build")}>
          <Plus className="w-4 h-4 mr-2" /> New quiz
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#1b2740] pb-px">
        {["all", "live", "drafts"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-colors border-b-2 -mb-px ${
              filter === f 
                ? 'border-[#ff2d8e] text-white' 
                : 'border-transparent text-[#66728a] hover:text-[#9aa6bc]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* New Quiz Tile */}
        <button
          onClick={() => onNavigate("build")}
          className="border-2 border-dashed border-[#1b2740] rounded-2xl flex flex-col items-center justify-center p-8 text-[#66728a] hover:text-white hover:border-[#66728a] transition-all bg-[#0a1019]/50 hover:bg-[#0f1724]"
        >
          <div className="w-12 h-12 rounded-full bg-[#1b2740] flex items-center justify-center mb-4">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-bold">Create new quiz</span>
        </button>

        {filteredGames.map(game => {
          const isLive = game.status === "active";
          const isDraft = game.status === "waiting";
          const isCompleted = game.status === "completed";

          return (
            <div 
              key={game.id} 
              className={`rounded-2xl p-5 flex flex-col ${
                isLive 
                  ? 'bg-[#0f1724] border border-[#ff2d8e]/50 ring-1 ring-[#ff2d8e]/20' 
                  : isCompleted
                  ? 'bg-[#0a1019] border border-[#1b2740] opacity-75'
                  : 'bg-[#0f1724] border border-[#1b2740]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                {isLive && (
                  <div className="flex items-center gap-1.5 bg-[#ff2d8e]/10 text-[#ff2d8e] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff2d8e] animate-pulse" /> LIVE
                  </div>
                )}
                {isDraft && <div className="bg-[#1b2740] text-[#9aa6bc] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">DRAFT</div>}
                {isCompleted && <div className="bg-[#1b2740]/50 text-[#66728a] px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">COMPLETED</div>}
                
                <span className="text-xs font-mono text-[#66728a]">#{game.id}</span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 line-clamp-2 leading-tight">{game.topic}</h3>
              <p className="text-[#9aa6bc] text-sm mb-6 flex-1">
                {game.questionCount} {game.questionCount === 1 ? 'question' : 'questions'}
              </p>

              <div className="mt-auto">
                {isLive && (
                  <Button className="w-full bg-[#ff2d8e] hover:bg-[#ff2d8e]/90 text-white" onClick={() => onNavigate("live", game.id)}>
                    Open live control <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                {isDraft && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-[#1b2740] bg-[#0a1019] text-[#eef2f8] hover:bg-[#1b2740]" onClick={() => onNavigate("build", game.id)}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button className="flex-1 bg-[#35d07f] hover:bg-[#35d07f]/90 text-black font-bold" onClick={() => handleGoLive(game)} disabled={game.questionCount === 0}>
                      <Play className="w-4 h-4 mr-2" /> Go Live
                    </Button>
                  </div>
                )}
                {isCompleted && (
                  <Button variant="outline" className="w-full border-[#1b2740] bg-[#0a1019] text-[#eef2f8] hover:bg-[#1b2740]" onClick={() => onNavigate("results", game.id)}>
                    <BarChart3 className="w-4 h-4 mr-2" /> Results
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuildQuizView({
  games,
  preferGameId,
  onNavigate
}: {
  games: Game[];
  preferGameId?: number;
  onNavigate: (section: Section, gameId?: number) => void;
}) {
  const [subTab, setSubTab] = useState<"setup"|"questions"|"review">("setup");

  useEffect(() => {
    if (preferGameId) setSubTab("questions");
  }, [preferGameId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-[#0a1019] p-2 rounded-xl border border-[#1b2740] w-fit">
        {["setup", "questions", "review"].map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t as any)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
              subTab === t 
                ? 'bg-[#1b2740] text-white shadow-sm' 
                : 'text-[#66728a] hover:text-[#9aa6bc]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6">
        {subTab === "setup" && (
          <CreateGameSection onCreated={(g) => { setSubTab("questions"); onNavigate("build", g.id); }} />
        )}
        {subTab === "questions" && (
          <QuestionsSection games={games} preferGameId={preferGameId} />
        )}
        {subTab === "review" && (
          <ReviewSection games={games} />
        )}
      </div>
    </div>
  );
}

function NewResultsSection({ games }: { games: Game[] }) {
  // Wrapping existing ResultsSection for now, but adding style tweaks if possible
  return (
    <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6">
      <ResultsSection games={games} />
    </div>
  );
}

function NewSettingsSection() {
  // Wrapping existing SettingsSection
  return (
    <div className="bg-[#0f1724] border border-[#1b2740] rounded-2xl p-6">
      <SettingsSection />
    </div>
  );
}


function NewAdminDashboard() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("games");
  const [preferredGameId, setPreferredGameId] = useState<number | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: games = [] } = useListGames(undefined, {
    query: { queryKey: getListGamesQueryKey(), refetchInterval: 10000 },
  });

  const activeGame = games.find((g) => g.status === "active");

  const navigate = (s: Section, gameId?: number) => {
    setSection(s);
    if (gameId !== undefined) setPreferredGameId(gameId);
    setSidebarOpen(false);
  };

  const updateGame = useUpdateGame();
  const queryClient = useQueryClient();

  const endGame = (id: number) => {
    updateGame.mutate(
      { gameId: id, data: { status: "completed" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() }) }
    );
  };

  const navItems = [
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "live", label: "Live game", icon: Radio },
    { id: "build", label: "Build a quiz", icon: Wand2 },
    { id: "results", label: "Results", icon: BarChart3 },
    { id: "rooms", label: "Rooms & codes", icon: KeyRound },
  ] as const;

  const renderSection = () => {
    switch (section) {
      case "games": return <GamesView games={games} onNavigate={navigate} />;
      case "live": return <LiveGameView activeGame={activeGame} endGame={(id) => {}} />;
      case "build": return <BuildQuizView games={games} preferGameId={preferredGameId} onNavigate={navigate} />;
      case "results": return <NewResultsSection games={games} />;
      case "rooms": return <NewSettingsSection />;
      default: return null;
    }
  };

  return (
    <div className="min-h-[100dvh] flex bg-[#0a0c12] text-[#eef2f8] font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 bg-[#0a1019] border-b border-[#1b2740] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-[#ff2d8e]" />
          <span className="font-bold text-white tracking-widest text-sm">HOST CONSOLE</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-2">
          <div className="w-5 h-0.5 bg-white mb-1" />
          <div className="w-5 h-0.5 bg-white mb-1" />
          <div className="w-5 h-0.5 bg-white" />
        </button>
      </header>

      {/* Persistent Left Rail */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-[216px] bg-[#0a1019] border-r border-[#1b2740] flex flex-col
        transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 flex flex-col items-center pb-8 pt-8">
          <Shield className="h-10 w-10 text-[#ff2d8e] mb-3" />
          <div className="text-2xl font-black tracking-tight text-white mb-1">MK</div>
          <div className="text-[10px] text-[#9aa6bc] uppercase tracking-widest font-bold">HOST CONSOLE</div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map(item => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`
                  w-full flex items-center gap-3 h-[44px] px-4 rounded-lg text-sm font-medium transition-all relative overflow-hidden group
                  ${isActive ? 'bg-[#ff2d8e]/10 text-[#eef2f8] font-bold' : 'text-[#9aa6bc] hover:bg-white/5'}
                `}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff2d8e]" />}
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#ff2d8e]' : 'text-[#66728a] group-hover:text-[#9aa6bc]'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1b2740]">
          <div className="bg-[#0f1724] rounded-xl p-3 flex items-center gap-3 border border-[#1b2740]">
            <div className="w-8 h-8 rounded-full bg-[#ff2d8e] text-white flex items-center justify-center text-xs font-bold">
              HO
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">Host</div>
              <button 
                onClick={async () => { await logout(); setLocation("/"); }}
                className="text-xs text-[#9aa6bc] hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/80 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8 lg:p-10 max-w-[1200px] w-full mx-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

