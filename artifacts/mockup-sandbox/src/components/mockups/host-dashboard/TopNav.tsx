import React from "react";
import { 
  Shield, 
  Plus, 
  Play, 
  Square, 
  Settings, 
  BarChart, 
  Trash2,
  Gamepad2,
  Users,
  CheckCircle2,
  Radio
} from "lucide-react";

export default function TopNavLayout() {
  return (
    <div className="min-h-screen bg-[#0a0510] text-white font-sans selection:bg-[#8b5cf6]/30">
      {/* Topbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/[0.07] bg-[#0a0510] px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#8b5cf6]" />
          <span className="font-bold tracking-widest text-sm text-white/90">HOST CONTROL</span>
        </div>

        {/* Center Pill Nav */}
        <nav className="flex items-center gap-1 rounded-full bg-white/[0.03] p-1 border border-white/[0.05]">
          <button className="px-4 py-1.5 rounded-full bg-[#8b5cf6] text-white text-sm font-medium transition-colors">
            Manage
          </button>
          <button className="px-4 py-1.5 rounded-full text-white/50 hover:text-white/90 hover:bg-white/[0.05] text-sm font-medium transition-colors">
            Create
          </button>
          <button className="px-4 py-1.5 rounded-full text-white/50 hover:text-white/90 hover:bg-white/[0.05] text-sm font-medium transition-colors">
            Questions
          </button>
          <button className="px-4 py-1.5 rounded-full text-white/50 hover:text-white/90 hover:bg-white/[0.05] text-sm font-medium transition-colors">
            Results
          </button>
        </nav>

        {/* Right Actions */}
        <div>
          <button className="flex items-center gap-2 rounded bg-[#fbbf24] px-4 py-1.5 text-sm font-bold text-black hover:bg-[#fbbf24]/90 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <Plus className="h-4 w-4" />
            New Game +
          </button>
        </div>
      </header>

      {/* Live Banner */}
      <div className="flex w-full items-center justify-between bg-[#ff0080]/10 border-b border-[#ff0080]/20 px-6 py-2">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-[#ff0080] animate-pulse"></span>
          <span className="text-sm font-medium text-[#ff0080]">LIVE NOW</span>
          <span className="text-sm text-white/70 px-2 border-l border-[#ff0080]/20">90s Pop Music</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/70">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> 23 Players Connected</span>
          <span className="flex items-center gap-1.5"><Radio className="h-4 w-4" /> Q3/10 Active</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl p-6 lg:p-8 space-y-6">
        {/* Stats Row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <Gamepad2 className="h-4 w-4 text-[#8b5cf6]" />
            <span className="text-sm font-medium">12 Games</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#ff0080]/30 bg-[#ff0080]/10 px-3 py-1.5">
            <Radio className="h-4 w-4 text-[#ff0080]" />
            <span className="text-sm font-medium text-[#ff0080]">1 Live</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <Users className="h-4 w-4 text-[#00ddff]" />
            <span className="text-sm font-medium">248 Players</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#fbbf24]" />
            <span className="text-sm font-medium">1.2k Answers</span>
          </div>
        </div>

        {/* Games Table container */}
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0a0510] text-xs uppercase tracking-wider text-white/40 border-b border-white/[0.07]">
              <tr>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Game Topic</th>
                <th className="px-6 py-4 font-semibold">Difficulty</th>
                <th className="px-6 py-4 font-semibold text-center">Questions</th>
                <th className="px-6 py-4 font-semibold text-center">Players</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {/* Live Game */}
              <tr className="bg-[#ff0080]/[0.04] hover:bg-[#ff0080]/[0.08] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff0080] shadow-[0_0_8px_#ff0080]"></span>
                    <span className="font-medium text-[#ff0080]">Live</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white text-base">90s Pop Music</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">Medium</span>
                </td>
                <td className="px-6 py-4 text-center text-white/70">10</td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#00ddff]/10 px-2.5 py-0.5 text-xs font-medium text-[#00ddff]">
                    <Users className="h-3 w-3" /> 23
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                    <button className="text-white/50 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors">
                      Manage →
                    </button>
                    <button className="flex items-center gap-1.5 rounded bg-[#ff0080] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#ff0080]/90 transition-colors shadow-[0_0_10px_rgba(255,0,128,0.3)]">
                      <Square className="h-3.5 w-3.5 fill-current" /> End
                    </button>
                  </div>
                </td>
              </tr>

              {/* Waiting Game 1 */}
              <tr className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#fbbf24]"></span>
                    <span className="font-medium text-white/70">Waiting</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white">World Capitals</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-[#ff0080]/20 px-2 py-0.5 text-xs font-medium text-[#ff0080]">Hard</span>
                </td>
                <td className="px-6 py-4 text-center text-white/70">15</td>
                <td className="px-6 py-4 text-center text-white/30">—</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-white/50 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors">
                      Questions
                    </button>
                    <button className="flex items-center gap-1.5 rounded bg-[#fbbf24] px-3 py-1.5 text-sm font-bold text-black hover:bg-[#fbbf24]/90 transition-colors">
                      <Play className="h-3.5 w-3.5 fill-current" /> Go Live
                    </button>
                  </div>
                </td>
              </tr>

              {/* Waiting Game 2 */}
              <tr className="bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#fbbf24]"></span>
                    <span className="font-medium text-white/70">Waiting</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white">Marvel Movies</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-[#00ddff]/20 px-2 py-0.5 text-xs font-medium text-[#00ddff]">Easy</span>
                </td>
                <td className="px-6 py-4 text-center text-white/70">12</td>
                <td className="px-6 py-4 text-center text-white/30">0</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-white/50 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors">
                      Questions
                    </button>
                    <button className="flex items-center gap-1.5 rounded bg-[#fbbf24] px-3 py-1.5 text-sm font-bold text-black hover:bg-[#fbbf24]/90 transition-colors">
                      <Play className="h-3.5 w-3.5 fill-current" /> Go Live
                    </button>
                  </div>
                </td>
              </tr>

              {/* Completed Game 1 */}
              <tr className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20"></span>
                    <span className="font-medium text-white/40">Done</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white/70">Cars of the 2000s</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">Medium</span>
                </td>
                <td className="px-6 py-4 text-center text-white/50">10</td>
                <td className="px-6 py-4 text-center text-white/50">18</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-white/50 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors">
                      <BarChart className="h-4 w-4 inline mr-1" /> Results
                    </button>
                    <button className="text-white/30 hover:text-[#ff0080] p-1.5 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>

              {/* Completed Game 2 */}
              <tr className="bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20"></span>
                    <span className="font-medium text-white/40">Done</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-white/70">Ancient Rome</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">Hard</span>
                </td>
                <td className="px-6 py-4 text-center text-white/50">20</td>
                <td className="px-6 py-4 text-center text-white/50">42</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-white/50 hover:text-white px-3 py-1.5 text-sm font-medium transition-colors">
                      <BarChart className="h-4 w-4 inline mr-1" /> Results
                    </button>
                    <button className="text-white/30 hover:text-[#ff0080] p-1.5 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
