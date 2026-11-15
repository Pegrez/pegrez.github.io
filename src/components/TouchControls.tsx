interface TouchControlsProps {
  canInteract: boolean;
  onMoveDir: (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => void;
  onInteract: () => void;
}

export function TouchControls({ canInteract, onMoveDir, onInteract }: TouchControlsProps) {
  return (
    <>
      <div
        className="fixed bottom-4 left-4 z-20 md:hidden grid grid-cols-3 gap-1.5 w-32 h-32"
        onTouchCancel={() => {
          // A cancelled touch never sends touchend: release every direction
          (['up', 'down', 'left', 'right'] as const).forEach((d) => onMoveDir(d, false));
        }}
      >
        <div />
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveDir('up', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onMoveDir('up', false);
          }}
          className="bg-[#160d0b]/90 border border-[#613122] rounded-lg text-white font-bold flex items-center justify-center active:bg-amber-500/50"
          aria-label="Move up"
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveDir('left', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onMoveDir('left', false);
          }}
          className="bg-[#160d0b]/90 border border-[#613122] rounded-lg text-white font-bold flex items-center justify-center active:bg-amber-500/50"
          aria-label="Move left"
        >
          ◀
        </button>
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveDir('down', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onMoveDir('down', false);
          }}
          className="bg-[#160d0b]/90 border border-[#613122] rounded-lg text-white font-bold flex items-center justify-center active:bg-amber-500/50"
          aria-label="Move down"
        >
          ▼
        </button>
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveDir('right', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onMoveDir('right', false);
          }}
          className="bg-[#160d0b]/90 border border-[#613122] rounded-lg text-white font-bold flex items-center justify-center active:bg-amber-500/50"
          aria-label="Move right"
        >
          ▶
        </button>
      </div>

      <div className="fixed bottom-6 right-5 z-20 md:hidden">
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            onInteract();
          }}
          onClick={onInteract}
          disabled={!canInteract}
          className={`w-16 h-16 rounded-full font-display text-xs font-bold border-2 flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
            canInteract
              ? 'bg-amber-500 border-amber-200 text-slate-950'
              : 'bg-[#160d0b]/80 border-[#4d261b] text-slate-500'
          }`}
        >
          Inspect
        </button>
      </div>
    </>
  );
}
