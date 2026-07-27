import React from 'react';
import { 
  Shield, 
  Home, 
  Users, 
  Settings, 
  LogOut, 
  Search, 
  Plus, 
  Play, 
  Square, 
  Trash2, 
  Activity, 
  ListOrdered,
  FileText,
  BarChart2,
  ChevronRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function HostDashboardRedesign() {
  const games = [
    { id: 1, title: "90s Pop Music", status: "live", players: 23, difficulty: "Medium", questions: 10 },
    { id: 2, title: "World Capitals", status: "waiting", players: 0, difficulty: "Hard", questions: 15 },
    { id: 3, title: "Marvel Movies", status: "waiting", players: 0, difficulty: "Easy", questions: 12 },
    { id: 4, title: "Cars of the 2000s", status: "completed", players: 18, difficulty: "Medium", questions: 10 },
    { id: 5, title: "Ancient Rome", status: "completed", players: 42, difficulty: "Hard", questions: 20 },
  ];

  return (
    <div className="min-h-screen flex text-white font-sans selection:bg-[#ff0080]/30" style={{ backgroundColor: '#0a0510' }}>
      
      {/* Sidebar - Icon Strip */}
      <div className="w-16 flex-shrink-0 flex flex-col items-center py-6 border-r border-white/10 bg-black/20 relative z-20">
        <div className="flex flex-col items-center gap-8 w-full mt-16">
          {/* Active Nav Item */}
          <div className="relative group w-full flex justify-center cursor-pointer">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#8b5cf6] rounded-r-md shadow-[0_0_10px_#8b5cf6]"></div>
            <div className="p-3 rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6]">
              <Home className="w-5 h-5" />
            </div>
            <div className="absolute left-16 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Manage Games
            </div>
          </div>
          
          <div className="relative group w-full flex justify-center cursor-pointer text-white/40 hover:text-white transition-colors">
            <div className="p-3">
              <Users className="w-5 h-5" />
            </div>
            <div className="absolute left-16 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Players
            </div>
          </div>
          
          <div className="relative group w-full flex justify-center cursor-pointer text-white/40 hover:text-white transition-colors">
            <div className="p-3">
              <Settings className="w-5 h-5" />
            </div>
            <div className="absolute left-16 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Settings
            </div>
          </div>
        </div>
        
        <div className="mt-auto flex flex-col items-center gap-6 w-full mb-2">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/50 font-medium">
            5
          </div>
          <div className="relative group w-full flex justify-center cursor-pointer text-white/40 hover:text-[#ff0080] transition-colors">
            <div className="p-3">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="absolute left-16 px-2 py-1 bg-gray-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 text-white">
              Sign Out
            </div>
          </div>
        </div>
      </div>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ff0080] shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-bold tracking-widest text-sm text-white/90">HOST CONTROL</h1>
          </div>
          
          <div className="flex-1 max-w-md mx-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <Input 
              placeholder="Filter games..." 
              className="bg-black/40 border-white/10 pl-9 text-sm text-white placeholder:text-white/30 focus-visible:ring-[#8b5cf6]/50 h-9 rounded-full"
            />
          </div>
          
          <Button className="bg-[#fbbf24] hover:bg-[#fbbf24]/90 text-black font-semibold rounded-full h-9 px-5 shadow-[0_0_15px_rgba(251,191,36,0.3)] border-0">
            New Game <Plus className="w-4 h-4 ml-1" />
          </Button>
        </header>

        {/* Live Game Banner */}
        <div className="bg-[#ff0080]/10 border-b border-[#ff0080]/20 px-6 py-3 flex items-center justify-between shrink-0 relative overflow-hidden">
          {/* Subtle animated background element */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff0080]/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-3 h-3">
                <div className="absolute w-full h-full bg-[#ff0080] rounded-full animate-ping opacity-75"></div>
                <div className="relative w-2 h-2 bg-[#ff0080] rounded-full"></div>
              </div>
              <span className="text-[#ff0080] font-bold text-xs tracking-wider uppercase">Active Game</span>
            </div>
            <div className="h-4 w-[1px] bg-white/20"></div>
            <span className="font-semibold text-white">90s Pop Music</span>
            <Badge variant="secondary" className="bg-[#ff0080]/20 text-[#ff0080] hover:bg-[#ff0080]/30 border-0 text-xs px-2 py-0 h-5">
              23 Players Joined
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 relative z-10">
            <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/10 h-8 text-xs font-medium border border-white/10">
              Manage <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
            <Button size="sm" className="bg-[#ff0080] hover:bg-[#ff0080]/90 text-white h-8 text-xs font-bold border-0 shadow-[0_0_10px_rgba(255,0,128,0.4)]">
              <Square className="w-3 h-3 mr-1.5 fill-current" /> End Game
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6 md:p-10 lg:max-w-6xl mx-auto w-full">
          
          {/* Stats Bar */}
          <div className="flex items-center justify-between px-8 py-4 mb-10 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg text-white/50"><ListOrdered className="w-4 h-4" /></div>
              <div>
                <div className="text-xs text-white/50 font-medium">Total Games</div>
                <div className="text-lg font-bold text-white leading-none mt-1">12</div>
              </div>
            </div>
            
            <div className="w-[1px] h-10 bg-white/10"></div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ff0080]/10 rounded-lg text-[#ff0080]"><Activity className="w-4 h-4" /></div>
              <div>
                <div className="text-xs text-white/50 font-medium">Live Now</div>
                <div className="text-lg font-bold text-[#ff0080] leading-none mt-1">1</div>
              </div>
            </div>
            
            <div className="w-[1px] h-10 bg-white/10"></div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00ddff]/10 rounded-lg text-[#00ddff]"><Users className="w-4 h-4" /></div>
              <div>
                <div className="text-xs text-white/50 font-medium">Total Players</div>
                <div className="text-lg font-bold text-[#00ddff] leading-none mt-1">248</div>
              </div>
            </div>
            
            <div className="w-[1px] h-10 bg-white/10"></div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#fbbf24]/10 rounded-lg text-[#fbbf24]"><BarChart2 className="w-4 h-4" /></div>
              <div>
                <div className="text-xs text-white/50 font-medium">Answers Submitted</div>
                <div className="text-lg font-bold text-[#fbbf24] leading-none mt-1">1.2k</div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white/90">Your Games</h2>
          </div>

          {/* Games List */}
          <div className="flex flex-col gap-3">
            {games.map(game => (
              <div key={game.id} className="relative group bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.06)] rounded-xl transition-all duration-200 overflow-hidden flex items-center pr-4">
                
                {/* Left Edge Color Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${
                  game.status === 'live' ? 'bg-[#ff0080] shadow-[0_0_10px_rgba(255,0,128,0.5)]' :
                  game.status === 'waiting' ? 'bg-[#fbbf24]' :
                  'bg-white/10'
                }`} />

                {/* Content Strip */}
                <div className="flex-1 flex items-center pl-6 py-4 gap-6">
                  
                  {/* Status Icon */}
                  <div className="w-10 flex justify-center shrink-0">
                    {game.status === 'live' ? (
                      <div className="p-2 bg-[#ff0080]/10 rounded-full animate-pulse">
                        <Activity className="w-5 h-5 text-[#ff0080]" />
                      </div>
                    ) : game.status === 'waiting' ? (
                      <div className="p-2 bg-white/5 rounded-full text-white/40">
                        <Clock className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="p-2 bg-white/5 rounded-full text-white/20">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <h3 className={`font-semibold truncate text-[15px] ${game.status === 'completed' ? 'text-white/50' : 'text-white'}`}>
                      {game.title}
                    </h3>
                    
                    {game.status === 'live' && (
                      <Badge variant="outline" className="bg-[#ff0080]/10 text-[#ff0080] border-[#ff0080]/30 text-[10px] uppercase tracking-wider animate-pulse">
                        Live
                      </Badge>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-transparent border-white/10 text-white/60 text-xs font-normal">
                        {game.difficulty}
                      </Badge>
                      <Badge variant="outline" className="bg-transparent border-white/10 text-white/60 text-xs font-normal flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {game.questions}
                      </Badge>
                      {game.players > 0 && (
                        <Badge variant="outline" className={`border-white/10 text-xs font-normal flex items-center gap-1 ${game.status === 'live' ? 'bg-[#00ddff]/10 text-[#00ddff] border-[#00ddff]/20' : 'bg-transparent text-white/60'}`}>
                          <Users className="w-3 h-3" /> {game.players}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions (Right Side) */}
                <div className="flex items-center gap-2 pl-4 shrink-0">
                  {game.status === 'waiting' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium h-8">
                        Questions
                      </Button>
                      <Button size="sm" className="bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/30 h-8 text-xs font-bold transition-all shadow-[0_0_10px_rgba(251,191,36,0.15)] hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] ml-2">
                        Go Live <Play className="w-3 h-3 ml-1.5 fill-current" />
                      </Button>
                    </>
                  )}
                  
                  {game.status === 'live' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium border border-white/10 h-8">
                        Manage <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                      <Button size="sm" className="bg-[#ff0080]/10 hover:bg-[#ff0080]/20 text-[#ff0080] border border-[#ff0080]/30 h-8 text-xs font-bold ml-2">
                        <Square className="w-3 h-3 mr-1.5 fill-current" /> End Game
                      </Button>
                    </>
                  )}
                  
                  {game.status === 'completed' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-white/40 hover:text-white/80 hover:bg-white/5 text-xs font-medium h-8">
                        Results
                      </Button>
                      <Button variant="ghost" size="icon" className="text-white/20 hover:text-red-400 hover:bg-red-400/10 h-8 w-8 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
}
