export function ClubNight() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#070b13" }}
    >
      {/* Background: layered grid + glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245,13,136,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,13,136,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      {/* Top glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "900px",
          height: "500px",
          background: "radial-gradient(ellipse, rgba(245,13,136,0.09) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      {/* Bottom-left cyan accent */}
      <div
        className="absolute bottom-0 left-0 pointer-events-none"
        style={{
          width: "400px",
          height: "300px",
          background: "radial-gradient(ellipse at bottom left, rgba(6,182,212,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="w-full max-w-sm space-y-10 relative z-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1
            className="text-7xl font-black leading-none"
            style={{
              color: "#f50d88",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "-0.04em",
              textShadow: "0 2px 30px rgba(245,13,136,0.35)",
            }}
          >
            TRIVIA
          </h1>
          <h1
            className="text-7xl font-black leading-none"
            style={{
              color: "#f50d88",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "-0.04em",
              textShadow: "0 2px 30px rgba(245,13,136,0.35)",
            }}
          >
            NIGHT
          </h1>
          <p className="text-base text-slate-500 tracking-widest uppercase font-medium pt-1" style={{ letterSpacing: "0.18em" }}>
            The Ultimate Pub Quiz
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(20,32,50,0.95) 0%, rgba(10,16,26,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 0 0 1px rgba(245,13,136,0.08), 0 32px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Top highlight stripe */}
          <div
            className="h-px w-full"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(245,13,136,0.4) 40%, rgba(6,182,212,0.3) 60%, transparent 100%)" }}
          />

          <div className="p-7 space-y-5">
            <div className="space-y-3">
              <label
                className="block text-[11px] font-bold tracking-[0.3em] uppercase text-center"
                style={{ color: "#22d3ee" }}
              >
                Access Code
              </label>
              <div
                className="h-[60px] rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 2px 12px rgba(0,0,0,0.4)",
                }}
              >
                <span
                  className="text-2xl font-bold tracking-[0.25em] uppercase"
                  style={{ color: "rgba(255,255,255,0.12)" }}
                >
                  ENTER CODE
                </span>
              </div>
            </div>

            <button
              className="w-full h-[56px] rounded-xl text-base font-black tracking-[0.2em] uppercase text-white"
              style={{
                background: "#f50d88",
                boxShadow: "0 0 24px rgba(245,13,136,0.3), 0 4px 16px rgba(245,13,136,0.2)",
                letterSpacing: "0.25em",
              }}
            >
              ENTER
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 tracking-wide">
          Hosting tonight?{" "}
          <span className="font-semibold" style={{ color: "#22d3ee" }}>
            Admin login
          </span>
        </p>
      </div>
    </div>
  );
}
