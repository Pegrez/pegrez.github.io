import { useEffect } from 'react';

// Studio card shown for under 2 seconds before the title screen. Click or any key skips it.
export function IntroSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1800);
    const skip = () => onDone();
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <div
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black cursor-pointer"
      onClick={onDone}
    >
      <div className="intro-splash text-center">
        <div className="text-[11px] tracking-[0.5em] text-orange-300/70 uppercase mb-3">Developed by</div>
        <div className="text-4xl md:text-5xl font-black tracking-[0.18em] text-orange-100">ARPEBA RANGERS</div>
      </div>
    </div>
  );
}
