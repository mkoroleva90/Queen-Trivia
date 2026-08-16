
// ─── Queen Trivia brand primitives ───────────────────────────────────────────
// Flat geometric crown mark + stacked wordmark. No gradients, glows, or
// drop-shadows on the mark (client preference).

export function CrownMark({
  width = 26,
  gemHoles = false,
  color,
  className,
  style,
}: {
  width?: number | string;
  gemHoles?: boolean;
  /** Monochrome tint (design-handoff cyan/magenta tiles); omit for brand colors. */
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const crown = color ?? "#ff0080";
  const gems = color ?? "#ffe500";
  return (
    <svg
      viewBox="0 0 100 84"
      className={className}
      style={{ width, height: "auto", ...style }}
      aria-hidden="true"
    >
      <path d="M8,66 L8,26 L30,46 L50,14 L70,46 L92,26 L92,66 Z" fill={crown} />
      <rect x="8" y="64" width="84" height="14" rx="4" fill={crown} />
      <circle cx="8" cy="24" r="6" fill={gems} />
      <circle cx="50" cy="12" r="7.5" fill={gems} />
      <circle cx="92" cy="24" r="6" fill={gems} />
      {gemHoles && (
        <>
          <circle cx="30" cy="71" r="3.6" fill="#0d0f15" opacity=".4" />
          <circle cx="50" cy="71" r="3.6" fill="#0d0f15" opacity=".4" />
          <circle cx="70" cy="71" r="3.6" fill="#0d0f15" opacity=".4" />
        </>
      )}
    </svg>
  );
}

export function Wordmark({ fontSize = 44 }: { fontSize?: number | string }) {
  return (
    <h1
      className="font-extrabold"
      style={{
        margin: 0,
        fontSize,
        lineHeight: 0.9,
        letterSpacing: "-.035em",
        textAlign: "center",
      }}
    >
      <span style={{ color: "#ffe500" }}>QUEEN</span>
      <br />
      <span style={{ color: "#ff0080" }}>TRIVIA</span>
    </h1>
  );
}
