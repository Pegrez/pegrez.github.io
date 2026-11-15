import { useState } from 'react';

interface TutorialOverlayProps {
  onDone: () => void;
}

const STEPS: Array<{ title: string; text: string; pos: string; arrow?: string }> = [
  {
    title: 'Keep the crew alive',
    text: 'These bars are your oxygen, power, heat, food and more. If one turns red, something needs you.',
    pos: 'top-3 left-[260px]',
    arrow: '◀',
  },
  {
    title: 'Follow the mission',
    text: 'This card tells you what to do next. The yellow arrow around your astronaut points the way.',
    pos: 'top-[150px] left-1/2 -translate-x-1/2',
    arrow: '▲',
  },
  {
    title: 'Problems come with fixes',
    text: 'When something runs low, a warning appears up here with exactly how to fix it.',
    pos: 'top-[120px] right-[320px]',
    arrow: '▶',
  },
  {
    title: 'Never go outside alone',
    text: 'Your 3 crewmates live in the base. Walk up to one: [B] brings them outside as your EVA buddy, [C] lets you play as them.',
    pos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  },
  {
    title: 'Clean your suit every time',
    text: 'Mars dust is toxic. Every time you come back inside, walk to the suit station by the airlock and press [E] to clean it.',
    pos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  },
  {
    title: 'That's it!',
    text: 'Move with WASD, use things with E. Press H any time to see all the controls. Good luck on Mars.',
    pos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  },
];

// A short, first-time-only tutorial. The game is paused while it is open.
export function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[45] bg-black/45" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className={`absolute ${s.pos} w-[300px] rounded-2xl border-2 border-amber-400 bg-[#160d0b] p-4 shadow-2xl`}>
        {s.arrow && <div className="absolute -top-6 left-4 text-2xl text-amber-400" aria-hidden="true">{s.arrow}</div>}
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
          Quick start · {step + 1} of {STEPS.length}
        </div>
        <h2 className="font-display text-lg font-bold text-white">{s.title}</h2>
        <p className="mt-1 text-sm leading-snug text-amber-50/90">{s.text}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => (last ? onDone() : setStep(step + 1))}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            autoFocus
          >
            {last ? 'Start playing' : 'Next'}
          </button>
          {!last && (
            <button type="button" onClick={onDone} className="rounded-lg border border-white/15 px-3 text-xs text-amber-100 hover:bg-white/10 cursor-pointer">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
