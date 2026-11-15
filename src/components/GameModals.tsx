import { useState } from 'react';
import { BookOpen, Play, RotateCcw, Settings, Star, Trophy } from 'lucide-react';
import { CHALLENGES, ROLE_INFO, SOL_IN_EARTH_DAYS, UNLOCKS, solsToEarthMonths } from '../game/constants';
import { CampaignMeta } from '../game/save';
import { ScoreResult } from '../game/score';
import { GamePhase, HudSnapshot } from '../game/types';

interface GameModalsProps {
  phase: GamePhase;
  hud: HudSnapshot;
  meta: CampaignMeta;
  savedRun: { month: number; difficulty: number } | null;
  score: ScoreResult | null;
  newUnlock: { name: string; desc: string } | null;
  onStart: () => void;
  onContinue: () => void;
  onResetCampaign: () => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenScience: () => void;
  onOpenSettings: () => void;
}

const CONTROLS: Array<[string, string]> = [
  ['WASD', 'Move / drive'],
  ['E', 'Use: repair, plant, drill, collect, analyze'],
  ['R', 'Radar scan for ice (outside)'],
  ['V', 'Rover in / out'],
  ['C', 'Switch crew member (inside)'],
  ['G', 'Fuel plant on / off'],
  ['P', 'Print a spare part'],
  ['U', 'Insulate the habitat'],
  ['1–5', 'Power modes (O₂, reactor, lights, shield, heater)'],
  ['H', 'Controls help'],
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-1" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`w-7 h-7 ${i < n ? 'text-amber-400 fill-amber-400' : 'text-white/20'}`} />
      ))}
    </div>
  );
}

function ScoreCard({ score }: { score: ScoreResult }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Stars n={score.stars} />
        <div className="text-right">
          <div className="text-[10px] uppercase text-amber-200/70">Score</div>
          <div className="font-display text-3xl font-bold text-amber-300 font-mono-tabular">{score.total}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono-tabular">
        {score.lines.map((l) => (
          <div key={l.label} className="flex justify-between text-amber-50/85">
            <span>{l.label}</span>
            <span className="text-white">{l.points}</span>
          </div>
        ))}
        {score.multiplier > 1 && (
          <div className="flex justify-between text-rose-200 col-span-2">
            <span>Difficulty bonus</span>
            <span>×{score.multiplier.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function GameModals({
  phase,
  hud,
  meta,
  savedRun,
  score,
  newUnlock,
  onStart,
  onContinue,
  onResetCampaign,
  onResume,
  onRestart,
  onOpenScience,
  onOpenSettings,
}: GameModalsProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  if (phase === 'PLAYING') return null;

  const unlocked = UNLOCKS.filter((u) => meta.unlocks.includes(u.id));
  const challenges = CHALLENGES.slice(0, meta.difficulty);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full bg-[#160d0b] border border-[#613122] rounded-2xl p-6 sm:p-8 shadow-2xl">
        {phase === 'TITLE_MENU' && (
          <div className="space-y-4">
            <div className="text-xs text-amber-400 font-medium tracking-wide uppercase">
              Inspired by NASA's CHAPEA year-long Mars simulation
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight">
              Mars Outpost
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed">
              Lead a crew of four through <strong>178 sols</strong> (about 6 months) on Mars. Keep the habitat alive, grow
              food, mine buried ice, study ancient lakebed rocks, and make enough rocket fuel to launch
              home. Follow the <strong>yellow arrow</strong> and the mission card to learn as you play.
            </p>

            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(ROLE_INFO).map(([role, info]) => (
                <div key={role} className="p-2.5 rounded-lg bg-[#1f1310] border border-[#4d261b]">
                  <div className="font-bold text-amber-300">{info.label}</div>
                  <div className="text-slate-300">{info.perk}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-amber-50/90 p-3 rounded-lg bg-black/25 border border-white/5">
              {CONTROLS.map(([k, d]) => (
                <div key={k} className="contents">
                  <kbd className="px-1.5 rounded bg-amber-300 text-slate-950 font-bold font-mono-tabular text-[11px] text-center">{k}</kbd>
                  <span>{d}</span>
                </div>
              ))}
            </div>

            {(meta.difficulty > 0 || unlocked.length > 0 || meta.bestScore > 0) && (
              <div className="text-xs p-3 rounded-lg bg-amber-950/30 border border-amber-600/40 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> Campaign · expeditions won: {meta.expeditionsWon} · best score {meta.bestScore}
                </div>
                {meta.difficulty > 0 && (
                  <div className="text-rose-200">
                    Difficulty {meta.difficulty}: {challenges.map((c) => c.name).join(', ')}
                    {meta.difficulty > CHALLENGES.length ? ` + harsher Mars ×${meta.difficulty - CHALLENGES.length}` : ''}
                  </div>
                )}
                {unlocked.length > 0 && (
                  <div className="text-emerald-200">Upgrades: {unlocked.map((u) => u.name).join(', ')}</div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {savedRun && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="flex-1 py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Continue (Month {savedRun.month})
                </button>
              )}
              <button
                type="button"
                onClick={onStart}
                className="flex-1 py-3.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base rounded-xl shadow-lg cursor-pointer"
              >
                {savedRun ? 'New expedition' : 'Start Mission'}
              </button>
              <button
                type="button"
                onClick={onOpenScience}
                className="py-3.5 px-4 bg-[#211411] hover:bg-[#2f1d18] text-cyan-300 border border-cyan-500/40 font-semibold text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" /> NASA data
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Settings"
                className="py-3.5 px-4 bg-[#211411] hover:bg-[#2f1d18] text-amber-200 border border-amber-500/30 font-semibold text-sm rounded-xl cursor-pointer flex items-center justify-center"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            {(meta.difficulty > 0 || unlocked.length > 0) && (
              <button
                type="button"
                onClick={onResetCampaign}
                className="text-[11px] text-amber-100/60 hover:text-amber-100 underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset campaign (difficulty 0, no upgrades)
              </button>
            )}
            <p className="text-[11px] text-amber-100/50">Progress saves automatically in this browser.</p>
          </div>
        )}

        {phase === 'PAUSED' && (
          <div className="space-y-4">
            <div className="text-xs text-amber-400 font-mono-tabular">
              {hud.currentMonth.title} · {hud.lmst.formatted}
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Paused</h2>
            <p className="text-sm text-slate-200">{hud.currentMonth.summary}</p>
            <div className="text-sm text-amber-100">
              <span className="font-bold text-amber-300">Current mission:</span> {hud.mission.title}. {hud.mission.desc}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {hud.crew.map((c) => (
                <div key={c.id} className="p-2 rounded-lg bg-[#1f1310] border border-[#4d261b]">
                  <div className="font-bold text-white">
                    {c.name} <span className="text-amber-300">· {ROLE_INFO[c.role].label}</span>
                  </div>
                  <div className="text-amber-100/80">
                    Health {Math.round(c.hp)} · Morale {Math.round(c.morale)}
                    {c.down ? ' · in medbay' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setConfirmRestart(false);
                  onResume();
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold rounded-xl cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestart(true)}
                className="py-3 px-5 bg-[#211411] hover:bg-[#2f1d18] text-rose-200 font-semibold rounded-xl border border-rose-500/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Restart
              </button>
              <button
                type="button"
                onClick={onOpenScience}
                className="py-3 px-5 bg-[#211411] hover:bg-[#2f1d18] text-cyan-300 font-semibold rounded-xl border border-cyan-500/40 cursor-pointer"
              >
                NASA data
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="py-3 px-5 bg-[#211411] hover:bg-[#2f1d18] text-amber-200 font-semibold rounded-xl border border-amber-500/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
            </div>
            {confirmRestart && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 text-sm text-rose-100 space-y-2" role="alertdialog">
                <div>
                  Restart this expedition from Month 1? Your current progress in this run will be lost.
                  Campaign upgrades and difficulty stay the same.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRestart(false);
                      onRestart();
                    }}
                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg cursor-pointer"
                  >
                    Yes, restart
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestart(false)}
                    className="flex-1 py-2 bg-[#211411] hover:bg-[#2f1d18] text-slate-100 font-semibold rounded-lg border border-[#54291c] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-amber-100/50">Your run is saved. You can close the page and continue later.</p>
          </div>
        )}

        {phase === 'VICTORY' && (
          <div className="space-y-4">
            <div className="text-xs text-emerald-400 font-mono-tabular uppercase">
              Expedition complete · difficulty {hud.difficulty}
            </div>
            <h2 className="font-display text-3xl font-bold text-emerald-400">Launch! Heading home.</h2>
            <p className="text-sm text-slate-200">
              Your crew survived <strong>178 sols</strong> on Mars (about {solsToEarthMonths(178).toFixed(1)} Earth months, or{' '}
              {Math.round(178 * SOL_IN_EARTH_DAYS)} Earth days), made the fuel for the trip home, and launched with{' '}
              {hud.samplesCollected} sample tubes and {Math.round(hud.science)} science points on board.
              {hud.discoveries > 0 && (
                <strong className="text-emerald-300"> You found {hud.discoveries} possible sign(s) of ancient life!</strong>
              )}
            </p>
            <TimeNote />
            {score && <ScoreCard score={score} />}
            {newUnlock && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-sm text-emerald-100">
                <span className="font-bold text-emerald-300">Upgrade unlocked: {newUnlock.name}.</span> {newUnlock.desc}
              </div>
            )}
            {hud.nextChallenge && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-100">
                <span className="font-bold text-amber-300">Next expedition adds: {hud.nextChallenge.name}.</span>{' '}
                {hud.nextChallenge.desc}
              </div>
            )}
            <button
              type="button"
              onClick={onStart}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold rounded-xl cursor-pointer"
            >
              Launch next expedition (difficulty {meta.difficulty})
            </button>
          </div>
        )}

        {phase === 'GAME_OVER' && (
          <div className="space-y-4">
            <div className="text-xs text-rose-400 font-mono-tabular uppercase">
              {hud.currentMonth.title} · mission ended on Sol {hud.sol}
            </div>
            <p className="text-xs text-slate-300">
              Your crew lasted {hud.sol} sols on Mars: about {Math.round(hud.sol * SOL_IN_EARTH_DAYS)} Earth days
              ({solsToEarthMonths(hud.sol).toFixed(1)} months). A sol is 24 h 39 min, a little longer than an Earth day.
            </p>
            <h2 className="font-display text-3xl font-bold text-rose-400">Mission lost</h2>
            <p className="text-sm font-semibold text-white">{hud.causeOfDeath || 'The crew could not continue.'}</p>
            {hud.nasaDebriefTip && (
              <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-500/40 text-xs text-slate-200 space-y-1">
                <div className="font-bold text-amber-300">Flight director's advice for next time:</div>
                <p>{hud.nasaDebriefTip}</p>
              </div>
            )}
            {score && <ScoreCard score={score} />}
            <button
              type="button"
              onClick={onStart}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-display font-bold rounded-xl cursor-pointer"
            >
              Try again (difficulty {meta.difficulty})
            </button>
            {meta.difficulty > 0 && (
              <button
                type="button"
                onClick={onResetCampaign}
                className="w-full py-2.5 bg-[#211411] hover:bg-[#2f1d18] text-slate-100 font-semibold rounded-xl border border-[#54291c] cursor-pointer"
              >
                Reset campaign to difficulty 0
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Explains that the 6-month stay is a game design choice, not a real mission length.
function TimeNote() {
  return (
    <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/40 text-xs text-sky-100 space-y-1">
      <div className="font-bold text-sky-300">About the time on Mars</div>
      <p>
        Six months is a game design choice. A real crew would stay on the surface for about{' '}
        <strong>500 days (roughly 490 sols)</strong>, because Earth and Mars only line up for a launch every 26 months.
        With a 6 to 9-month trip each way, a real mission like this would last 2.5 to 3 years.
      </p>
    </div>
  );
}
