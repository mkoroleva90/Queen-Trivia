export function ElectricStage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #0f1e2e 0%, #060c13 60%, #040810 100%)" }}
    >
      {/* Ambient glow behind title */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[340px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(240,10,120,0.13) 0%, transparent 70%)",
          filter: "blur(40px)",
          top: "8%",
        }}
      />
      {/* Subtle bottom-corner cyan accent */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at bottom right, rgba(6,182,212,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="w-full max-w-md space-y-8 relative z-10">

        {/* Header */}
        <div className="text-center space-y-3">
          {/* Thin accent line */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-pink-500/60" />
            <span className="text-[10px] font-bold tracking-[0.35em] text-pink-500/70 uppercase">Live Tonight</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-pink-500/60" />
          </div>

          <h1
            className="text-[4.5rem] font-black tracking-tighter leading-none"
            style={{
              color: "#f50d88",
              textShadow: "0 0 40px rgba(245,13,136,0.5), 0 0 80px rgba(245,13,136,0.2)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            TRIVIA<br />NIGHT
          </h1>
          <p className="text-lg text-slate-400 tracking-wide font-light">
            The ultimate pub quiz experience
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6 space-y-4"
          style={{
            background: "rgba(10, 18, 28, 0.85)",
            border: "1px solid rgba(245,13,136,0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 0 1px rgba(245,13,136,0.05), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="space-y-2">
            <label
              className="block text-xs font-semibold tracking-[0.25em] uppercase text-center"
              style={{ color: "#22d3ee" }}
            >
              Access Code
            </label>
            <div
              className="h-14 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <span className="text-2xl tracking-[0.3em] font-bold text-slate-600 uppercase">
                ENTER CODE
              </span>
            </div>
          </div>

          <button
            className="w-full h-14 rounded-lg text-lg font-black tracking-widest text-white uppercase relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #f50d88 0%, #c4006d 100%)",
              boxShadow: "0 4px 24px rgba(245,13,136,0.4), 0 1px 0 rgba(255,255,255,0.1) inset",
              letterSpacing: "0.2em",
            }}
          >
            {/* Shimmer line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
            />
            ENTER
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500">
          Hosting tonight?{" "}
          <span className="font-medium" style={{ color: "#22d3ee" }}>
            Admin login
          </span>
        </p>
      </div>
    </div>
  );
}
