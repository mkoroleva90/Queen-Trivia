import React from "react";
import { Shield, Play, Plus, Square, ArrowRight, Trash2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CommandGrid() {
  return (
    <div className="min-h-screen font-sans bg-[#0a0510] text-white selection:bg-[#8b5cf6]/30 pb-20">
      {/* Topbar */}
      <header className="flex h-14 items-center justify-between px-6 border-b border-white/[0.07] bg-[#0a0510]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-white/[0.05] border border-white/[0.1]">
            <Shield className="w-4 h-4 text-[#8b5cf6]" />
          </div>
          <span className="font-bold tracking-widest text-xs text-white/80 uppercase">Host Control</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-[13px] text-white/50 hidden md:flex items-center gap-3 font-medium">
            <span>12 games</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[#ff0080]">1 live</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>248 players</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>1.2k answers</span>
          </div>
          
          <Button size="sm" className="bg-[#fbbf24] hover:bg-[#f59e0b] text-black font-bold h-8 rounded-full px-4 gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <span>New Game</span>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 pt-10 flex flex-col gap-12">
        
        {/* Zone 1: Active Game */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-[#ff0080] animate-pulse shadow-[0_0_8px_#ff0080]"></span>
            <h2 className="text-sm font-semibold tracking-wider text-white/70 uppercase">Active Session</h2>
          </div>
          
          <div className="h-auto sm:h-[140px] flex flex-col sm:flex-row bg-[#ff0080]/[0.05] border border-white/[0.07] border-l-4 border-l-[#ff0080] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(255,0,128,0.1)]">
            
            {/* Left */}
            <div className="flex-1 p-6 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.07]">
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="bg-[#ff0080]/20 text-[#ff0080] border-[#ff0080]/30 font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide">LIVE NOW</Badge>
              </div>
              <h3 className="text-[22px] font-bold text-white leading-tight">90s Pop Music</h3>
            </div>
            
            {/* Center */}
            <div className="flex-[1.5] p-6 flex items-center gap-4 border-b sm:border-b-0 sm:border-r border-white/[0.07] flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-[120px] bg-white/[0.03] border border-[#00ddff]/20 rounded-lg p-3 flex flex-col items-center justify-center gap-1 shadow-[inset_0_0_12px_rgba(0,221,255,0.05)]">
                <span className="text-2xl font-black text-[#00ddff]">23</span>
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Players</span>
              </div>
              <div className="flex-1 min-w-[120px] bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                <span className="text-2xl font-bold text-white">10</span>
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Questions</span>
              </div>
              <div className="flex-1 min-w-[120px] bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                <span className="text-2xl font-bold text-white">4<span className="text-white/30 text-lg">/10</span></span>
                <span className="text-[10px] text-[#fbbf24] uppercase font-bold tracking-widest">In Progress</span>
              </div>
            </div>
            
            {/* Right */}
            <div className="flex sm:w-48 flex-col sm:h-full bg-white/[0.02]">
              <button className="flex-1 flex items-center justify-center gap-2 bg-[#ff0080] hover:bg-[#e60073] text-white font-bold transition-colors py-4 sm:py-0">
                <Square className="w-4 h-4 fill-white" />
                End Game
              </button>
              <button className="h-12 flex items-center justify-center gap-2 text-[13px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors font-medium border-t border-white/[0.07]">
                Manage
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
          </div>
        </section>

        {/* Zone 2: Launch Queue */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-3 px-1">
            <span className="w-2 h-2 rounded-full bg-[#fbbf24]"></span>
            <h2 className="text-sm font-semibold tracking-wider text-white/70 uppercase">Ready to Launch</h2>
            <Badge className="bg-white/10 text-white hover:bg-white/10 border-none rounded-full h-5 px-2">2</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Queue Card 1 */}
            <div className="bg-white/[0.03] border border-white/[0.07] border-l-4 border-l-[#fbbf24] rounded-xl flex flex-col">
              <div className="p-5 flex-1">
                <h3 className="text-lg font-bold text-white mb-4">World Capitals</h3>
                <div className="flex items-center gap-2 mb-6">
                  <Badge variant="outline" className="text-red-400 border-red-400/20 bg-red-400/10">Hard</Badge>
                  <Badge variant="outline" className="text-white/60 border-white/10 bg-white/5">15q</Badge>
                  <span className="text-[13px] text-white/40 ml-auto font-medium">0 players</span>
                </div>
              </div>
              <div className="flex flex-col border-t border-white/[0.07]">
                <button className="h-10 text-[13px] text-white/50 hover:text-white hover:bg-white/[0.02] transition-colors font-medium">
                  Edit Questions
                </button>
                <button className="h-12 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] font-bold text-sm flex items-center justify-center gap-2 transition-colors border-t border-[#fbbf24]/20 rounded-b-xl">
                  Go Live
                  <Play className="w-4 h-4 fill-[#fbbf24]" />
                </button>
              </div>
            </div>

            {/* Queue Card 2 */}
            <div className="bg-white/[0.03] border border-white/[0.07] border-l-4 border-l-[#fbbf24] rounded-xl flex flex-col">
              <div className="p-5 flex-1">
                <h3 className="text-lg font-bold text-white mb-4">Marvel Movies</h3>
                <div className="flex items-center gap-2 mb-6">
                  <Badge variant="outline" className="text-green-400 border-green-400/20 bg-green-400/10">Easy</Badge>
                  <Badge variant="outline" className="text-white/60 border-white/10 bg-white/5">12q</Badge>
                  <span className="text-[13px] text-white/40 ml-auto font-medium">0 players</span>
                </div>
              </div>
              <div className="flex flex-col border-t border-white/[0.07]">
                <button className="h-10 text-[13px] text-white/50 hover:text-white hover:bg-white/[0.02] transition-colors font-medium">
                  Edit Questions
                </button>
                <button className="h-12 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] font-bold text-sm flex items-center justify-center gap-2 transition-colors border-t border-[#fbbf24]/20 rounded-b-xl">
                  Go Live
                  <Play className="w-4 h-4 fill-[#fbbf24]" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Zone 3: Archive */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-1 mt-4">
            <span className="w-2 h-2 rounded-full bg-white/30"></span>
            <h2 className="text-sm font-semibold tracking-wider text-white/50 uppercase">Completed</h2>
            <Badge className="bg-white/5 text-white/50 hover:bg-white/5 border-none rounded-full h-5 px-2">2</Badge>
          </div>
          
          <div className="flex flex-col border border-white/[0.05] rounded-xl overflow-hidden bg-white/[0.01]">
            {/* Archive Row 1 */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors group">
              <div className="flex items-center gap-4 w-1/3">
                <h3 className="font-semibold text-white/80">Cars of the 2000s</h3>
              </div>
              <div className="flex items-center gap-3 w-1/4">
                <Badge variant="outline" className="text-white/40 border-white/10 bg-transparent text-[11px] font-normal">Medium</Badge>
                <Badge variant="outline" className="text-white/40 border-white/10 bg-transparent text-[11px] font-normal">10q</Badge>
              </div>
              <div className="flex items-center gap-2 w-1/5 text-white/50 text-sm">
                <span className="font-medium">18</span> <span className="text-xs">players</span>
              </div>
              <div className="flex items-center gap-2 justify-end flex-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 text-white/60 hover:text-white hover:bg-white/10">
                  <BarChart2 className="w-4 h-4 mr-1.5" />
                  Results
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Archive Row 2 */}
            <div className="flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors group">
              <div className="flex items-center gap-4 w-1/3">
                <h3 className="font-semibold text-white/80">Ancient Rome</h3>
              </div>
              <div className="flex items-center gap-3 w-1/4">
                <Badge variant="outline" className="text-white/40 border-white/10 bg-transparent text-[11px] font-normal">Hard</Badge>
                <Badge variant="outline" className="text-white/40 border-white/10 bg-transparent text-[11px] font-normal">20q</Badge>
              </div>
              <div className="flex items-center gap-2 w-1/5 text-white/50 text-sm">
                <span className="font-medium">42</span> <span className="text-xs">players</span>
              </div>
              <div className="flex items-center gap-2 justify-end flex-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 text-white/60 hover:text-white hover:bg-white/10">
                  <BarChart2 className="w-4 h-4 mr-1.5" />
                  Results
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-400/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
        
      </main>
    </div>
  );
}
