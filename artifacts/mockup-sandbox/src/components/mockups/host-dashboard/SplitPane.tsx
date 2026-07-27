import React from "react";
import { Shield, Plus, Circle, Users, Activity, ListOrdered, Calendar, History, StopCircle, ArrowRight, Play, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SplitPane() {
  return (
    <div className="min-h-screen bg-[#0a0510] text-white flex flex-col font-sans overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-10 bg-[#0a0510]">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#8b5cf6]" />
          <span className="font-bold tracking-widest text-sm text-white/90">HOST CONTROL</span>
        </div>
        <Button 
          className="bg-[#fbbf24] hover:bg-[#fbbf24]/90 text-black font-bold h-8 px-4 rounded-full text-xs shadow-[0_0_15px_rgba(251,191,36,0.3)] border-0"
        >
          <Plus className="w-4 h-4 mr-1 -ml-1" />
          New Game
        </Button>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Pane: Game Roster */}
        <aside className="w-[300px] border-r border-white/10 flex flex-col bg-[#0a0510]/50 shrink-0">
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <h2 className="font-semibold text-white/80">Games</h2>
            <Badge variant="outline" className="border-white/10 text-white/50 bg-white/5 px-2 font-mono rounded">
              5 Total
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            
            {/* LIVE Section */}
            <div>
              <h3 className="text-[10px] font-bold text-[#ff0080] tracking-wider uppercase mb-2 px-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-[#ff0080] animate-pulse" /> Live Now
              </h3>
              <div className="space-y-1">
                {/* Active/Selected Game */}
                <button className="w-full text-left flex items-center justify-between p-2 rounded border-l-2 border-[#8b5cf6] bg-[#8b5cf6]/10 group transition-all">
                  <div className="flex items-center gap-3 truncate">
                    <Circle className="w-2.5 h-2.5 fill-[#ff0080] text-[#ff0080] shrink-0" />
                    <span className="font-medium text-white truncate text-sm">90s Pop Music</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/80 text-xs shrink-0 bg-white/10 px-1.5 py-0.5 rounded">
                    <Users className="w-3 h-3 text-[#00ddff]" />
                    <span>23</span>
                  </div>
                </button>
              </div>
            </div>

            {/* WAITING Section */}
            <div>
              <h3 className="text-[10px] font-bold text-[#fbbf24] tracking-wider uppercase mb-2 px-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-[#fbbf24] text-[#fbbf24]" /> Waiting
              </h3>
              <div className="space-y-1">
                <button className="w-full text-left flex items-center justify-between p-2 rounded border-l-2 border-transparent hover:bg-white/5 group transition-colors">
                  <div className="flex items-center gap-3 truncate">
                    <Circle className="w-2.5 h-2.5 fill-[#fbbf24] text-[#fbbf24] shrink-0" />
                    <span className="font-medium text-white/60 group-hover:text-white/90 truncate text-sm">World Capitals</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-xs shrink-0">
                    <span>15q</span>
                  </div>
                </button>
                <button className="w-full text-left flex items-center justify-between p-2 rounded border-l-2 border-transparent hover:bg-white/5 group transition-colors">
                  <div className="flex items-center gap-3 truncate">
                    <Circle className="w-2.5 h-2.5 fill-[#fbbf24] text-[#fbbf24] shrink-0" />
                    <span className="font-medium text-white/60 group-hover:text-white/90 truncate text-sm">Marvel Movies</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-xs shrink-0">
                    <span>0p</span>
                  </div>
                </button>
              </div>
            </div>

            {/* DONE Section */}
            <div>
              <h3 className="text-[10px] font-bold text-white/40 tracking-wider uppercase mb-2 px-2 flex items-center gap-2">
                <Circle className="w-2 h-2 fill-white/30 text-white/30" /> Completed
              </h3>
              <div className="space-y-1">
                <button className="w-full text-left flex items-center justify-between p-2 rounded border-l-2 border-transparent hover:bg-white/5 group transition-colors">
                  <div className="flex items-center gap-3 truncate">
                    <Circle className="w-2.5 h-2.5 fill-white/20 text-white/20 shrink-0" />
                    <span className="font-medium text-white/40 group-hover:text-white/70 truncate text-sm line-through decoration-white/20">Cars of the 2000s</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/30 text-xs shrink-0">
                    <span>18p</span>
                  </div>
                </button>
                <button className="w-full text-left flex items-center justify-between p-2 rounded border-l-2 border-transparent hover:bg-white/5 group transition-colors">
                  <div className="flex items-center gap-3 truncate">
                    <Circle className="w-2.5 h-2.5 fill-white/20 text-white/20 shrink-0" />
                    <span className="font-medium text-white/40 group-hover:text-white/70 truncate text-sm line-through decoration-white/20">Ancient Rome</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/30 text-xs shrink-0">
                    <span>42p</span>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </aside>

        {/* Right Pane: Context-Sensitive Action Panel */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0510] relative">
          {/* Subtle gradient glow for active game */}
          <div className="absolute top-0 right-0 left-0 h-64 bg-gradient-to-b from-[#8b5cf6]/10 to-transparent pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 z-10">
            <div className="max-w-4xl mx-auto space-y-10">
              
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className="bg-[#ff0080]/10 text-[#ff0080] border border-[#ff0080]/30 font-bold px-2.5 py-0.5 rounded-sm">
                      <Circle className="w-2 h-2 fill-current mr-1.5 animate-pulse" /> LIVE
                    </Badge>
                    <span className="text-white/40 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> Today, 8:00 PM
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">90s Pop Music</h1>
                  <p className="text-white/50 text-lg">Test your knowledge of the best decade of pop.</p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Big Stat Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-6 flex flex-col justify-between aspect-[2/1] md:aspect-auto">
                  <div className="text-white/40 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Players Joined
                  </div>
                  <div className="text-5xl font-black text-[#00ddff]">23</div>
                </div>
                
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-6 flex flex-col justify-between aspect-[2/1] md:aspect-auto">
                  <div className="text-white/40 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ListOrdered className="w-4 h-4" /> Questions
                  </div>
                  <div className="text-5xl font-black text-white">10</div>
                </div>

                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-6 flex flex-col justify-between aspect-[2/1] md:aspect-auto relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Activity className="w-24 h-24" />
                  </div>
                  <div className="text-white/40 text-sm font-medium uppercase tracking-wider mb-2 z-10 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Difficulty
                  </div>
                  <div className="text-3xl font-bold text-white/90 z-10 mt-auto">Medium</div>
                </div>
              </div>

              {/* Primary Action Area */}
              <div className="flex flex-col gap-4 bg-[rgba(255,255,255,0.02)] p-6 rounded-2xl border border-white/5">
                <Button className="w-full bg-[#ff0080] hover:bg-[#ff0080]/90 text-white font-bold h-16 text-lg rounded-xl shadow-[0_0_30px_rgba(255,0,128,0.3)] transition-all hover:scale-[1.01] active:scale-100 flex items-center justify-center gap-3 border-0">
                  <StopCircle className="w-6 h-6" />
                  END GAME NOW
                </Button>
                <Button variant="ghost" className="w-full h-12 text-white/60 hover:text-white hover:bg-white/5 border border-transparent rounded-xl flex items-center justify-center gap-2 transition-colors">
                  Manage Live Game <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              {/* Mini Activity Feed */}
              <div>
                <h3 className="text-sm font-bold text-white/60 tracking-wider uppercase mb-6 flex items-center gap-2">
                  <History className="w-4 h-4" /> Live Activity Feed
                </h3>
                <div className="space-y-4">
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#00ddff]/10 flex items-center justify-center shrink-0 border border-[#00ddff]/20">
                      <Users className="w-4 h-4 text-[#00ddff]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/80 text-sm">Player <span className="font-bold text-white">JohnD</span> joined the game</p>
                      <p className="text-white/40 text-xs mt-0.5">2m ago</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center shrink-0 border border-[#8b5cf6]/20">
                      <Play className="w-4 h-4 text-[#8b5cf6]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/80 text-sm">Question 7 (<span className="text-white/60 italic">"Which Nirvana song..."</span>) was revealed</p>
                      <p className="text-white/40 text-xs mt-0.5">5m ago</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                      <Activity className="w-4 h-4 text-white/50" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/80 text-sm">Game was started by host</p>
                      <p className="text-white/40 text-xs mt-0.5">15m ago</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
