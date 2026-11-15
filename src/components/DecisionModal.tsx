import { useEffect } from 'react';
import { DecisionView } from '../game/types';

interface DecisionModalProps {
  decision: DecisionView;
  onChoose: (index: number) => void;
}

// A short choice with trade-offs. The world is paused while it is open. Keys 1/2 also work.
export function DecisionModal({ decision, onChoose }: DecisionModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.stopImmediatePropagation();
        onChoose(0);
      } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.stopImmediatePropagation();
        onChoose(1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onChoose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/55 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <div className="max-w-md w-full bg-[#160d0b] border-2 border-amber-400/70 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Crew decision · game paused</div>
        <h2 id="decision-title" className="font-display text-xl font-bold text-white">
          {decision.title}
        </h2>
        <p className="text-sm text-amber-50/90 leading-relaxed">{decision.text}</p>
        <div className="space-y-2 pt-1">
          {decision.options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onChoose(i)}
              className={`w-full text-left rounded-xl px-3.5 py-2.5 border cursor-pointer transition-colors ${
                i === 0
                  ? 'bg-amber-500/90 hover:bg-amber-400 border-amber-200 text-slate-950'
                  : 'bg-[#2a170f] hover:bg-[#3a2016] border-amber-700/60 text-amber-50'
              }`}
            >
              <div className="font-bold text-sm">
                <kbd className={`mr-1.5 px-1.5 rounded text-[11px] ${i === 0 ? 'bg-slate-950 text-amber-300' : 'bg-amber-300 text-slate-950'}`}>
                  {i + 1}
                </kbd>
                {o.label}
              </div>
              <div className={`text-xs mt-0.5 ${i === 0 ? 'text-slate-900' : 'text-amber-100/75'}`}>{o.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
