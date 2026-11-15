interface SuitDamageOverlayProps {
  hp: number;
}

export function SuitDamageOverlay({ hp }: SuitDamageOverlayProps) {
  if (hp > 38) return null;

  // Severity scales from 0 (at 38% HP) to 1 (at 0% HP)
  const severity = Math.max(0, Math.min(1, (38 - hp) / 38));
  const heavyCracks = hp <= 22;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      {/* Foggy / Frosted Visor Condensation around viewport edges */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 0.45 + severity * 0.5,
          backdropFilter: `blur(${(2.5 + severity * 5.5).toFixed(1)}px)`,
          WebkitBackdropFilter: `blur(${(2.5 + severity * 5.5).toFixed(1)}px)`,
          maskImage:
            'radial-gradient(circle at 50% 50%, transparent 26%, rgba(0,0,0,0.65) 58%, black 88%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 50%, transparent 26%, rgba(0,0,0,0.65) 58%, black 88%)',
        }}
      />

      {/* Dusty / Frosty Condensation Mist + Critical Crimson Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(226,232,240,0) 32%, rgba(203,213,225,${
            (0.14 + severity * 0.22).toFixed(2)
          }) 72%, rgba(185,28,28,${(0.24 + severity * 0.34).toFixed(2)}) 100%)`,
        }}
      />

      {/* Broken / Cracked Helmet Visor Glass SVG */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.45 + severity * 0.45 }}
      >
        {/* Primary impact shatter on upper-right visor */}
        <g stroke="rgba(241, 245, 249, 0.85)" fill="none" strokeLinecap="round">
          <path d="M915 70 L820 120 L745 112 L680 155" strokeWidth="2.4" />
          <path d="M915 70 L840 165 L805 235 L760 285" strokeWidth="2.1" />
          <path d="M915 70 L955 155 L930 230 L965 305" strokeWidth="2" />
          <path d="M915 70 L860 30 L795 18" strokeWidth="1.8" />
          <path d="M820 120 L785 182 L720 208" strokeWidth="1.4" />
          <path d="M840 165 L888 215 L872 275" strokeWidth="1.3" />
          <path d="M745 112 L715 70" strokeWidth="1.2" />
          <polygon
            points="915,70 882,92 896,120 930,104"
            fill="rgba(255,255,255,0.12)"
            strokeWidth="1.6"
          />
        </g>

        {/* Secondary shatter cluster on lower-left visor when critically low */}
        {heavyCracks && (
          <g stroke="rgba(226, 232, 240, 0.88)" fill="none" strokeLinecap="round">
            <path d="M85 520 L165 465 L245 478 L315 430" strokeWidth="2.5" />
            <path d="M85 520 L135 415 L165 350 L210 310" strokeWidth="2.1" />
            <path d="M85 520 L55 430 L72 360" strokeWidth="1.8" />
            <path d="M165 465 L205 525 L265 555" strokeWidth="1.5" />
            <path d="M135 415 L92 388" strokeWidth="1.2" />
            <polygon
              points="85,520 118,494 106,466 72,484"
              fill="rgba(255,255,255,0.14)"
              strokeWidth="1.6"
            />
          </g>
        )}
      </svg>

      {/* Subtle critical warning badge in bottom-center above controls */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2 hidden sm:block">
        <div className="font-mono-tabular text-[11px] font-bold text-rose-200/90 bg-rose-950/75 border border-rose-500/60 px-2.5 py-1 rounded">
          VISOR BREACH · SUIT {Math.round(hp)}%
        </div>
      </div>
    </div>
  );
}
