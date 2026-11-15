import { useState } from 'react';
import { sound } from '../game/audio';
import { GameSettings, getSettings, updateSettings } from '../game/settings';

interface SettingsModalProps {
  onClose: () => void;
  onReplayTutorial: () => void;
  simSpeed: 1 | 2;
  onToggleSimSpeed: () => void;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-amber-50">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number((e.target as HTMLInputElement).value) / 100)}
        className="flex-1 accent-amber-400"
        aria-label={label}
      />
      <span className="w-10 text-right font-mono-tabular text-xs">{Math.round(value * 100)}%</span>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-amber-50 cursor-pointer">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        className="h-4 w-4 accent-amber-400"
      />
    </label>
  );
}

// Basic settings: volumes, screen shake, crew dialogue, game speed, replay tutorial.
export function SettingsModal({ onClose, onReplayTutorial, simSpeed, onToggleSimSpeed }: SettingsModalProps) {
  const [s, setS] = useState<GameSettings>(() => getSettings());
  const set = (patch: Partial<GameSettings>) => {
    const next = updateSettings(patch);
    setS(next);
    sound.setVolumes(next);
  };
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/40 bg-[#160d0b] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-xl font-bold text-white">
            Settings
          </h2>
          <button type="button" onClick={onClose} className="rounded-md border border-white/15 px-3 py-1 text-xs font-bold text-amber-100 hover:bg-white/10 cursor-pointer">
            Done
          </button>
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Sound</div>
          <Slider label="Master volume" value={s.master} onChange={(v) => set({ master: v })} />
          <Slider label="Music" value={s.music} onChange={(v) => set({ music: v })} />
          <Slider label="Sound effects" value={s.sfx} onChange={(v) => set({ sfx: v })} />
          <Slider label="Wind & ambience" value={s.ambient} onChange={(v) => set({ ambient: v })} />
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Gameplay</div>
          <Toggle label="Screen shake (quakes, impacts)" value={s.screenShake} onChange={(v) => set({ screenShake: v })} />
          <Toggle label="Crew dialogue" value={s.dialogue} onChange={(v) => set({ dialogue: v })} />
          <div className="flex items-center justify-between text-sm text-amber-50">
            <span>Game speed</span>
            <button type="button" onClick={onToggleSimSpeed} className="rounded-md border border-white/15 px-3 py-1 text-xs font-bold text-amber-100 hover:bg-white/10 cursor-pointer">
              {simSpeed}x
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onReplayTutorial}
          className="w-full rounded-lg border border-sky-500/40 bg-sky-950/40 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-900/50 cursor-pointer"
        >
          Show the tutorial again
        </button>
        <p className="text-[11px] text-amber-100/50">Settings are saved in this browser.</p>
      </div>
    </div>
  );
}
