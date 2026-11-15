import { useEffect, useState } from 'react';

interface LaunchCinematicProps {
  discoveries: number;
  science: number;
  samples: number;
  onDone: () => void;
}

// Short launch scene shown after a successful expedition. Click or press any key to skip.
export function LaunchCinematic({ discoveries, science, samples, onDone }: LaunchCinematicProps) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const s = (now - start) / 1000;
      setT(s);
      if (s >= 9) onDone();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const skip = () => onDone();
    window.addEventListener('keydown', skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  // Rocket waits on the pad, ignites at 1.5 s, climbs and accelerates
  const lift = t < 1.5 ? 0 : Math.pow(t - 1.5, 2.1) * 26;
  const shake = t > 1.2 && t < 3.5 ? (Math.random() - 0.5) * 4 : 0;
  const flame = t > 1.2;
  const message =
    discoveries > 0
      ? `Houston: "Your samples may hold the first signs of ancient life ever found. The whole world is waiting to see them. Welcome home."`
      : science >= 150
      ? `Houston: "Outstanding science, crew. ${samples} sample tubes and a mountain of data are coming home with you."`
      : `Houston: "Clean ascent, crew. Six months on Mars and everyone is coming home. Well done."`;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden cursor-pointer select-none"
      onClick={onDone}
      role="dialog"
      aria-label="Launch scene. Click to continue."
      style={{ background: `linear-gradient(to bottom, #050712 0%, #1b0b10 ${60 - Math.min(40, lift / 20)}%, #7c2d12 100%)` }}
    >
      {/* Stars */}
      {Array.from({ length: 60 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 60}%`,
            width: 2,
            height: 2,
            opacity: 0.3 + ((i * 13) % 7) / 10,
          }}
        />
      ))}
      {/* Ground + launch pad */}
      <div className="absolute left-0 right-0 bottom-0 h-[22%] bg-[#7a2e14]" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] w-48 h-3 bg-slate-500" />
      {/* Rocket */}
      <div
        className="absolute left-1/2 bottom-[22%]"
        style={{ transform: `translate(calc(-50% + ${shake}px), ${-lift}px)` }}
      >
        <div className="relative w-10 h-36">
          <div className="absolute inset-x-0 top-0 h-8 bg-slate-100" style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
          <div className="absolute inset-x-0 top-8 bottom-4 bg-slate-200 border-x-2 border-slate-400" />
          <div className="absolute left-1/2 -translate-x-1/2 top-14 w-4 h-4 rounded-full bg-sky-400 border-2 border-slate-500" />
          <div className="absolute -left-3 bottom-0 w-4 h-10 bg-orange-600" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
          <div className="absolute -right-3 bottom-0 w-4 h-10 bg-orange-600" style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
          {flame && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full w-8 rounded-b-full"
              style={{
                height: 40 + Math.random() * 30 + Math.min(80, lift / 6),
                background: 'linear-gradient(to bottom, #fde68a, #f97316 45%, rgba(239,68,68,0))',
              }}
            />
          )}
        </div>
      </div>
      {/* Exhaust cloud on the pad */}
      {flame && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[18%] rounded-full bg-orange-200/40 blur-xl"
          style={{ width: 120 + Math.min(500, (t - 1.2) * 220), height: 60 + Math.min(120, (t - 1.2) * 50) }}
        />
      )}
      {/* Captions */}
      <div className="absolute inset-x-0 top-[12%] text-center px-6 space-y-3">
        <div className="font-display text-3xl sm:text-5xl font-bold text-white" style={{ opacity: Math.min(1, t / 1) }}>
          {t < 1.5 ? 'Ignition sequence…' : t < 4 ? 'Liftoff from Jezero Crater!' : 'Next stop: Earth'}
        </div>
        {t > 4.5 && (
          <p className="mx-auto max-w-xl text-base sm:text-lg text-amber-100" style={{ opacity: Math.min(1, (t - 4.5) / 1) }}>
            {message}
          </p>
        )}
      </div>
      <div className="absolute bottom-4 inset-x-0 text-center text-xs text-amber-100/60">Click or press any key to continue</div>
    </div>
  );
}
