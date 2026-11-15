import { CREW_VOICE } from '../game/dialogue/lines';
import { CrewMember, CrewRole } from '../game/types';

interface DialogueBoxProps {
  line: { who: CrewRole; text: string };
  crew: CrewMember[];
}

// Small speech box in the lower-left. Purely visual: it never takes input or pauses the game.
export function DialogueBox({ line, crew }: DialogueBoxProps) {
  const voice = CREW_VOICE[line.who];
  const member = crew.find((c) => c.role === line.who);
  return (
    <div
      className="pointer-events-none absolute bottom-4 left-3 z-20 max-w-[360px] flex items-start gap-2 rounded-xl border border-white/10 bg-[#120a08]/90 px-2.5 py-2 shadow-lg backdrop-blur"
      role="status"
      aria-live="polite"
      key={`${line.who}-${line.text}`}
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-950"
        style={{ background: voice.color }}
        aria-hidden="true"
      >
        {voice.short[0]}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold" style={{ color: voice.color }}>
          {member?.name ?? voice.short}
        </div>
        <p className="text-[12.5px] leading-snug text-amber-50">{line.text}</p>
      </div>
    </div>
  );
}
