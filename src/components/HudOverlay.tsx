import {
  AlertTriangle,
  BookOpen,
  Droplets,
  Flame,
  Fuel,
  Globe,
  Heart,
  Keyboard,
  Radio,
  Settings,
  Users,
  FlaskConical,
  MapPin,
  Pause,
  Printer,
  Radar,
  Radiation,
  ShieldPlus,
  Shirt,
  Snowflake,
  Sprout,
  Target,
  Truck,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  Zap,
  Sun,
} from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import {
  CAREER_DOSE_LIMIT_MSV,
  INSULATION_MAX_LEVEL,
  JURY_RIG_HEALTH,
  MAJOR_REPAIR_THRESHOLD,
  PREVENTIVE_THRESHOLD,
  PRINT_SCRAP_COST,
  ROLE_INFO,
  TOTAL_MISSION_MONTHS,
} from '../game/constants';
import { HudSnapshot, ModuleId, ModuleMode } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  simSpeed: 1 | 2;
  muted: boolean;
  hasActiveMaintenance: boolean;
  onToggleSimSpeed: () => void;
  onOpenScience: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onCycleMode: (id: ModuleId) => void;
  onCycleHeaterMode: () => void;
  onUpgradeInsulation: () => void;
  onTriggerInteract: () => void;
  onBedSecondaryAction: () => void;
  onRadarScan: () => void;
  onPrintPart: () => void;
  onToggleFuelPlant: () => void;
  onToggleRover: () => void;
  onSkipMission: () => void;
  onSwitchCrew: () => void;
  onToggleBuddy: () => void;
  onOpenSettings: () => void;
}

type Icon = ComponentType<{ className?: string }>;

const modeLetter = (m: ModuleMode) => (m === 'OVERDRIVE' ? 'MAX' : m === 'ECO' ? 'ECO' : 'NOM');

function Bar({
  icon: I,
  label,
  value,
  color,
  warnLow = true,
  invert = false,
  title,
  chip,
  onChip,
  display,
}: {
  icon: Icon;
  label: string;
  value: number;
  display?: string;
  color: string;
  warnLow?: boolean;
  invert?: boolean;
  title: string;
  chip?: string;
  onChip?: () => void;
}) {
  const bad = invert ? value > 60 : warnLow && value < 25;
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title}>
      <I className={`w-3 h-3 shrink-0 ${bad ? 'text-rose-400' : 'text-amber-100/70'}`} />
      <span className="text-[10px] text-amber-100/80 w-9 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-black/60 rounded-sm overflow-hidden min-w-[36px]">
        <div
          className={`h-full ${bad ? 'bg-rose-500' : color}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="font-mono-tabular text-[10px] text-white w-7 text-right shrink-0">
        {display ?? Math.round(value)}
      </span>
      {chip && (
        <button
          type="button"
          onClick={onChip}
          className="text-[8px] font-bold px-1 rounded border border-white/15 text-amber-100/80 hover:bg-white/10 cursor-pointer w-7 shrink-0"
        >
          {chip}
        </button>
      )}
    </div>
  );
}

function IconBtn({
  icon: I,
  k,
  title,
  onClick,
  active = false,
  disabled = false,
  badge,
}: {
  icon: Icon;
  k?: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`relative w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
        active
          ? 'bg-amber-500/25 border-amber-400/70 text-amber-200'
          : disabled
          ? 'bg-black/30 border-white/5 text-white/25 cursor-not-allowed'
          : 'bg-black/40 border-white/10 text-amber-100/90 hover:bg-white/10 cursor-pointer'
      }`}
    >
      <I className="w-4 h-4" />
      {k && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#160d0b] border border-white/15 rounded px-0.5 leading-tight text-amber-200">
          {k}
        </span>
      )}
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-amber-500 text-black rounded px-0.5 leading-tight">
          {badge}
        </span>
      )}
    </button>
  );
}

// Renders text with [X] key hints as visible keyboard chips.
function WithKeys({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <kbd
            key={i}
            className="inline-block mx-0.5 px-1.5 rounded bg-amber-300 text-slate-950 font-bold font-mono-tabular text-[11px] leading-[18px] align-middle"
          >
            {p.slice(1, -1)}
          </kbd>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

const CONTROLS: Array<[string, string]> = [
  ['WASD', 'Move / drive'],
  ['E', 'Use: repair, plant, harvest, drill, collect'],
  ['F', 'Plant in Mars soil / wash soil'],
  ['R', 'Radar scan for ice (outside)'],
  ['V', 'Get in / out of the rover'],
  ['C', 'Near a crew member: play as them'],
  ['B', 'Near a crew member: bring them outside as your EVA buddy'],
  ['K', 'Skip an optional mission'],
  ['G', 'Fuel plant on / off'],
  ['P', 'Print a spare part (inside)'],
  ['U', 'Insulate the habitat (2 parts)'],
  ['1-4', 'Power mode: O₂, reactor, grow lights, shield'],
  ['5', 'Heater mode'],
  ['H', 'Show / hide this help'],
  ['Esc', 'Pause'],
];

export function HudOverlay({
  hud,
  simSpeed,
  muted,
  hasActiveMaintenance,
  onToggleSimSpeed,
  onOpenScience,
  onToggleMute,
  onTogglePause,
  onCycleMode,
  onCycleHeaterMode,
  onUpgradeInsulation,
  onTriggerInteract,
  onBedSecondaryAction,
  onRadarScan,
  onPrintPart,
  onToggleFuelPlant,
  onToggleRover,
  onSkipMission,
  onSwitchCrew,
  onToggleBuddy,
  onOpenSettings,
}: HudOverlayProps) {
  const mod = (id: ModuleId) => hud.modules.find((m) => m.id === id)!;
  const r = hud.resources;
  const canUpgradeInsul =
    hud.insulationLevel < INSULATION_MAX_LEVEL && hud.parts >= hud.insulationCost;

  const nearbyBed = hud.nearbyBed;
  const bedNeedsWash =
    nearbyBed &&
    nearbyBed.stage !== 'EMPTY' &&
    nearbyBed.stage !== 'WILTED' &&
    nearbyBed.medium === 'MARS_SOIL' &&
    !nearbyBed.perchlorateWashed;

  // One short contextual prompt at the bottom of the screen
  let prompt: { text: string; onClick: () => void; secondary?: { text: string; onClick: () => void } } | null =
    null;
  if (!hasActiveMaintenance) {
    if (nearbyBed) {
      if (nearbyBed.stage === 'EMPTY')
        prompt = {
          text: `[E] Plant (water) · ${hud.seeds} seeds`,
          onClick: onTriggerInteract,
          secondary: { text: '[F] Plant in Mars soil', onClick: onBedSecondaryAction },
        };
      else if (bedNeedsWash) prompt = { text: '[F] Wash perchlorates (-10% water)', onClick: onBedSecondaryAction };
      else if (nearbyBed.stage === 'RIPE') prompt = { text: '[E] Harvest (+28% food)', onClick: onTriggerInteract };
      else if (nearbyBed.stage === 'WILTED') prompt = { text: '[E] Clear wilted bed', onClick: onTriggerInteract };
      else
        prompt = {
          text: `Growing ${Math.round(nearbyBed.growth)}%${hud.cropsPausedReason ? ` · paused: ${hud.cropsPausedReason}` : ''}`,
          onClick: () => {},
        };
    } else if (hud.nearLab) {
      prompt = {
        text:
          hud.labProgress !== null
            ? `Analyzing ${hud.labSample}…`
            : hud.samplesStored > 0
            ? `[E] Analyze a sample (${hud.samplesStored} waiting)`
            : 'Lab: no samples yet (collect them in the Crater Field)',
        onClick: onTriggerInteract,
      };
    } else if (hud.nearSuitStation) {
      prompt = {
        text:
          hud.suitDust > 1
            ? `[E] Clean & repair suit (dust ${Math.round(hud.suitDust)}%)`
            : `[E] Clean & repair suit (${Math.round(hud.suit)}%)`,
        onClick: onTriggerInteract,
      };
    } else if (hud.nearNpc && !hud.inEvaSuit) {
      const n = hud.nearNpc;
      const first = n.name.split(' ')[0];
      prompt = {
        text: `[C] Play as ${first} (${ROLE_INFO[n.role].label})`,
        onClick: onSwitchCrew,
        secondary: {
          text: n.following ? `[B] Leave ${first} inside` : `[B] Bring ${first} outside`,
          onClick: onToggleBuddy,
        },
      };
    } else if (hud.nearPanels && !hud.inRover) {
      prompt =
        hud.panelDust >= 10
          ? { text: `[E] Brush solar panels (${Math.round(hud.panelDust)}% dust)`, onClick: onTriggerInteract }
          : { text: 'Solar panels are clean', onClick: () => {} };
    } else if (hud.nearbySite) {
      prompt = { text: `[E] Collect ${hud.nearbySite.label}`, onClick: onTriggerInteract };
    } else if (hud.nearbyDeposit && hud.inEvaSuit) {
      const d = hud.nearbyDeposit;
      prompt = {
        text:
          d.scanLevel === 1
            ? '[E] Take core sample'
            : hud.drillingId === d.id
            ? `[E] Pause drill · ${Math.round(d.amountKg)} kg left`
            : d.depth === 'DEEP' && !d.rigInstalled
            ? `[E] Install drill rig (1 part, have ${hud.parts})`
            : `[E] Drill ice · ${Math.round(d.amountKg)} kg`,
        onClick: onTriggerInteract,
      };
    } else if (hud.nearbyModule && hud.inRover) {
      prompt = { text: `[V] Exit the rover to repair ${hud.nearbyModule.shortLabel}`, onClick: onToggleRover };
    } else if (hud.nearbyModule) {
      const m = hud.nearbyModule;
      prompt = {
        text:
          m.health >= PREVENTIVE_THRESHOLD
            ? `[E] Inspect ${m.shortLabel} (${Math.round(m.health)}%)`
            : m.health < MAJOR_REPAIR_THRESHOLD
            ? hud.parts > 0
              ? `[E] Major repair ${m.shortLabel} (1 part)`
              : `[E] Patch ${m.shortLabel} to ${JURY_RIG_HEALTH}% (no parts)`
            : `[E] Repair ${m.shortLabel} (${Math.round(m.health)}%)`,
        onClick: onTriggerInteract,
      };
    } else if (hud.nearRover && !hud.inRover) {
      prompt = { text: `[V] Board rover · ${Math.round(hud.roverBattery)}%`, onClick: onToggleRover };
    }
  }

  const [showHelp, setShowHelp] = useState(false);
  // The facts box opens when a new fact appears, then folds away to keep the screen calm
  const [factOpen, setFactOpen] = useState(true);
  useEffect(() => {
    setFactOpen(true);
    const t = setTimeout(() => setFactOpen(false), 12000);
    return () => clearTimeout(t);
  }, [hud.fact.title]);
  const [crewOpen, setCrewOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') setShowHelp((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Top-left: compact vitals + real Mars facts */}
      <div className="pointer-events-auto absolute top-2 left-2 z-20 w-60 space-y-1.5">
        <div className="bg-[#160d0b]/85 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 space-y-1">
          <Bar icon={Wind} label="O₂" value={r.o2} color="bg-cyan-400" title="Oxygen ([1] MOXIE mode)" chip={modeLetter(mod('o2').mode)} onChip={() => onCycleMode('o2')} />
          <Bar icon={Zap} label="Power" value={r.power} color="bg-amber-400" title={`Battery · net ${hud.netPowerKw.toFixed(1)} kW ([2] reactor mode)`} chip={modeLetter(mod('power').mode)} onChip={() => onCycleMode('power')} />
          <Bar icon={Flame} label="Heat" value={r.heat} color="bg-orange-400" title={`Habitat heat ${hud.baseTempC}°C ([5] heater)`} chip={modeLetter(hud.heaterMode)} onChip={onCycleHeaterMode} />
          <Bar icon={Sprout} label="Food" value={r.food} color="bg-emerald-400" title={`Food · ${hud.seeds} seeds ([3] grow lights)`} chip={modeLetter(mod('food').mode)} onChip={() => onCycleMode('food')} />
          <Bar icon={Droplets} label="Water" value={r.water} color="bg-sky-400" title={`Water · ice hopper ${Math.round(hud.iceKg)} kg`} />
          <Bar icon={Fuel} label="Fuel" value={r.fuel} color="bg-violet-400" warnLow={false} title="Return-rocket fuel ([G] fuel plant)" chip={hud.fuelPlantOn ? 'ON' : 'OFF'} onChip={onToggleFuelPlant} />
          <Bar icon={Radiation} label="Shield" value={r.shield} color="bg-indigo-400" title={`Radiation shield · dose ${Math.round(hud.doseMsv)}/${CAREER_DOSE_LIMIT_MSV} mSv ([4] mode)`} chip={modeLetter(mod('shield').mode)} onChip={() => onCycleMode('shield')} />
          <Bar icon={Heart} label="Health" value={(r.hp / hud.hpMax) * 100} display={`${Math.round(r.hp)}`} color="bg-rose-500" title={`Crew health (max ${hud.hpMax})`} />
          <Bar icon={Shirt} label="Suit" value={hud.suit} color="bg-slate-300" title="EVA suit integrity (repair at the suit station)" />
          <Bar icon={Sun} label="Panels" value={100 - hud.panelDust} display={`${Math.round(hud.solarEff * 100)}`} color="bg-yellow-300" title={`Solar panel output ${Math.round(hud.solarEff * 100)}% · dust ${Math.round(hud.panelDust)}% (brush them at the array, southeast)`} />
          <Bar icon={Wind} label="Dust" value={Math.max(hud.suitDust, hud.habDust)} color="bg-orange-300" warnLow={false} invert title={`Toxic dust · on suit ${Math.round(hud.suitDust)}% · in habitat ${Math.round(hud.habDust)}%. Clean your suit at the suit station every time you come in.`} />
          <Bar icon={Snowflake} label="Cold" value={hud.cold} color="bg-sky-200" warnLow={false} invert title="Body cold while outside. High = slower and frostbite risk" />
        </div>

        <button
          type="button"
          onClick={() => setFactOpen((v) => !v)}
          aria-expanded={factOpen}
          className="w-full text-left bg-[#160d0b]/80 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 cursor-pointer hover:border-sky-400/40"
        >
          <div className="text-[9px] uppercase tracking-wider text-sky-300 flex items-center gap-1">
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">Real Mars · {hud.fact.title}</span>
            <span className="ml-auto text-sky-300/70">{factOpen ? '▾' : '▸'}</span>
          </div>
          {factOpen && <p className="text-[10.5px] leading-snug text-slate-200 mt-0.5">{hud.fact.text}</p>}
        </button>

        <div className="bg-[#160d0b]/85 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5">
          <button
            type="button"
            onClick={() => setCrewOpen((v) => !v)}
            aria-expanded={crewOpen}
            className="w-full text-[9px] uppercase tracking-wider text-amber-300 flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> Crew · [C] switch {crewOpen ? '▾' : '▸'}
            </span>
            <span className="text-amber-100/70 normal-case tracking-normal">
              Kits {hud.medKits} · <FlaskConical className="inline w-3 h-3" /> {Math.round(hud.science)}
            </span>
          </button>
          {!crewOpen && (
            <div className="mt-1 grid grid-cols-4 gap-1">
              {hud.crew.map((c, i) => (
                <div
                  key={c.id}
                  title={`${c.name} · ${ROLE_INFO[c.role].label} · health ${Math.round(c.hp)} · morale ${Math.round(c.morale)}`}
                  className={`rounded px-1 py-0.5 ${i === hud.activeCrew ? 'bg-amber-400/20 ring-1 ring-amber-400/60' : 'bg-black/30'}`}
                >
                  <div className={`text-[9px] font-bold truncate ${c.down ? 'text-rose-300 line-through' : 'text-white'}`}>
                    {c.name.split(' ')[0]}
                  </div>
                  <div className="h-1 bg-black/60 rounded-sm overflow-hidden mt-0.5">
                    <div className={`h-full ${c.hp < 30 ? 'bg-rose-500' : 'bg-rose-400'}`} style={{ width: `${c.hp}%` }} />
                  </div>
                  <div className="h-1 bg-black/60 rounded-sm overflow-hidden mt-0.5">
                    <div className={`h-full ${c.morale < 25 ? 'bg-slate-500' : 'bg-sky-400'}`} style={{ width: `${c.morale}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {crewOpen && (
            <div className="mt-1 space-y-1">
              {hud.crew.map((c, i) => (
                <div key={c.id} className={`rounded px-1 py-0.5 ${i === hud.activeCrew ? 'bg-amber-400/15 ring-1 ring-amber-400/50' : ''}`}>
                  <div className={`text-[10px] ${c.down ? 'text-rose-300' : 'text-white'}`}>
                    {i === hud.activeCrew ? '▸ ' : ''}
                    <strong>{c.name}</strong> · {ROLE_INFO[c.role].label} · ❤ {Math.round(c.hp)} · ☺ {Math.round(c.morale)}
                    {c.down ? ' · medbay' : ''}
                  </div>
                  <div className="text-[9.5px] text-amber-100/60 leading-snug">{ROLE_INFO[c.role].perk}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-[9px] text-amber-100/50 mt-0.5">Red = health · Blue = morale</div>
        </div>
      </div>

      {/* Top-center: current mission (clear, large, screen-reader friendly) */}
      <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[44vw] space-y-1">
        <section
          role="status"
          aria-live="polite"
          aria-label="Current mission"
          className="bg-[#0f0806]/95 border-2 border-amber-400/70 rounded-xl px-3 py-2 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wider text-amber-300/90 font-bold flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              {hud.mission.done ? 'All missions done' : `Mission ${hud.mission.index} of ${hud.mission.total}`}
            </div>
            <div className="flex items-center gap-2">
              {hud.missionDistanceM !== null && (
                <span className="font-mono-tabular text-[11px] text-amber-100">
                  Follow the arrow · {hud.missionDistanceM} m
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-200 border border-amber-400/50 rounded px-1.5 py-0.5 hover:bg-amber-400/15 cursor-pointer"
                aria-expanded={showHelp}
              >
                <Keyboard className="w-3 h-3" /> Controls (H)
              </button>
            </div>
          </div>
          <div className="text-[15px] font-bold text-white leading-tight mt-0.5">{hud.mission.title}</div>
          <div className="text-[13px] text-amber-50 leading-snug mt-0.5">
            <WithKeys text={hud.mission.desc} />
          </div>
          {hud.mission.optional && (
            <button
              type="button"
              onClick={onSkipMission}
              className="mt-1 text-[10px] text-amber-200/80 hover:text-amber-100 underline cursor-pointer"
            >
              Optional mission · skip it [K]
            </button>
          )}
        </section>
        {showHelp && (
          <div className="bg-[#0f0806]/95 border border-amber-400/40 rounded-xl px-3 py-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px] text-amber-50">
            {CONTROLS.map(([k, d]) => (
              <Fragment key={k}>
                <kbd className="px-1.5 rounded bg-amber-300 text-slate-950 font-bold font-mono-tabular text-[11px] text-center">
                  {k}
                </kbd>
                <span>{d}</span>
              </Fragment>
            ))}
          </div>
        )}
        {hud.activeEvent.kind !== 'NONE' && (
          <div className="bg-amber-950/90 border border-amber-500/60 rounded-md px-2 py-1 text-[11.5px] text-amber-100 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <WithKeys text={hud.activeEvent.actionAdvice} />
            </span>
            <span className="font-mono-tabular ml-auto shrink-0">{hud.activeEvent.timeRemaining.toFixed(0)}s</span>
          </div>
        )}
        {hud.earthMessage && (
          <div className="bg-sky-950/90 border border-sky-500/50 rounded-md px-2 py-1 text-[11.5px] text-sky-50">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-sky-300 font-bold">
              <Radio className="w-3 h-3" /> Message from Earth · sent {hud.earthMessage.sentLabel.replace(' LMST', '')}
              {hud.earthMessage.outdated && <span className="text-emerald-300 normal-case tracking-normal">· already handled</span>}
            </div>
            <div className={hud.earthMessage.outdated ? 'opacity-60' : ''}>
              <WithKeys text={hud.earthMessage.text} />
            </div>
          </div>
        )}
        {hud.latestLog && !hud.earthMessage && (
          <div className="text-[10.5px] text-amber-50/70 px-1 truncate">{hud.latestLog.text}</div>
        )}
      </div>

      {/* Top-right: clock + compact icon buttons */}
      <div className="pointer-events-auto absolute top-2 right-2 z-20 flex flex-col items-end gap-1.5">
        <div className="bg-[#160d0b]/85 backdrop-blur border border-white/10 rounded-lg px-2 py-1 text-right">
          <div className="font-mono-tabular text-[12px] font-bold text-amber-300">
            Sol {hud.sol} of {hud.totalSols} · Month {hud.solNumber}/{TOTAL_MISSION_MONTHS}
          </div>
          <div
            className={`text-[10px] ${hud.stormSeason ? 'text-orange-300 font-bold' : 'text-amber-100/60'}`}
            title="Each day/night you see is a time-lapse of about 30 sols (1 sol = 24 h 39 min)."
          >
            {hud.season} · {hud.lmst.formatted.replace(' LMST', '')}
          </div>
          <div className={`text-[10px] ${hud.followerCrew !== null ? 'text-emerald-300' : hud.inEvaSuit ? 'text-rose-300 font-bold' : 'text-amber-100/50'}`}>
            {hud.followerCrew !== null
              ? `EVA buddy: ${hud.crew[hud.followerCrew]?.name.split(' ')[0]}`
              : hud.inEvaSuit
              ? 'SOLO EVA · no buddy'
              : 'No EVA buddy · [B] near crew'}
          </div>
          <div className="text-[10px] text-amber-100/70 flex items-center justify-end gap-1">
            <MapPin className="w-3 h-3" />
            {hud.currentZone.name} · {hud.lmst.isNight ? 'Night' : 'Day'} {hud.lmst.extTempC}°C
          </div>
          {hud.difficulty > 0 && (
            <div className="text-[10px] text-rose-300 font-bold" title={hud.challenges.map((c) => `${c.name}: ${c.desc}`).join('\n')}>
              Difficulty {hud.difficulty} · {hud.challenges.map((c) => c.name).join(', ')}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1 max-w-[380px]">
          <IconBtn icon={Radar} k="R" title={hud.inEvaSuit ? 'Radar scan for ice [R]' : 'Radar works outside only'} onClick={onRadarScan} disabled={!hud.inEvaSuit || hud.scanCooldown > 0} />
          <IconBtn icon={Truck} k="V" title={hud.inRover ? 'Exit rover [V]' : 'Board rover [V] (walk up to it)'} onClick={onToggleRover} active={hud.inRover} disabled={!hud.nearRover} badge={hud.inRover ? `${Math.round(hud.roverBattery)}` : undefined} />
          <IconBtn icon={Printer} k="P" title={`3D-print a part [P] · scrap ${hud.scrap.toFixed(1)}/${PRINT_SCRAP_COST} kg (inside only)`} onClick={onPrintPart} disabled={hud.inEvaSuit || hud.scrap < PRINT_SCRAP_COST || hud.printCooldown > 0} badge={`${hud.parts}`} />
          <IconBtn icon={ShieldPlus} k="U" title={`Upgrade insulation [U] · Lv ${hud.insulationLevel} · ${hud.insulationCost} parts`} onClick={onUpgradeInsulation} disabled={!canUpgradeInsul} />
          <IconBtn icon={Wrench} title="Repair: walk to a module and press [E]" onClick={onTriggerInteract} disabled={!hud.nearbyModule} />
          <IconBtn icon={BookOpen} title="Real NASA data" onClick={onOpenScience} />
          <button type="button" onClick={onToggleSimSpeed} title="Game speed" className="w-8 h-8 rounded-md border border-white/10 bg-black/40 text-[10px] font-bold text-amber-100 hover:bg-white/10 cursor-pointer">
            {simSpeed}x
          </button>
          <IconBtn icon={muted ? VolumeX : Volume2} title={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute} />
          <IconBtn icon={Settings} title="Settings" onClick={onOpenSettings} />
          <IconBtn icon={Pause} title="Pause [Esc]" onClick={onTogglePause} />
        </div>
        {hud.warnings.length > 0 && (
          <div role="alert" aria-live="assertive" className="w-[300px] space-y-1.5">
            {hud.warnings.map((w) => (
              <div
                key={w.title}
                className={`rounded-lg px-2.5 py-1.5 border-l-4 shadow-lg ${
                  w.level === 'critical'
                    ? 'bg-rose-950/95 border-rose-500 animate-pulse'
                    : 'bg-[#2a170f]/95 border-amber-400'
                }`}
              >
                <div className={`text-[12px] font-bold flex items-center gap-1 ${w.level === 'critical' ? 'text-rose-200' : 'text-amber-200'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {w.title}
                </div>
                <div className="text-[11.5px] text-white/90 leading-snug mt-0.5">
                  <span className="font-bold text-white">Fix: </span>
                  <WithKeys text={w.fix} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom-center: one contextual action */}
      {prompt && (
        <div className="pointer-events-auto absolute bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          <button
            type="button"
            onClick={prompt.onClick}
            className="bg-amber-400/95 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg cursor-pointer whitespace-nowrap"
          >
            {prompt.text}
          </button>
          {prompt.secondary && (
            <button
              type="button"
              onClick={prompt.secondary.onClick}
              className="bg-amber-700/95 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg cursor-pointer whitespace-nowrap"
            >
              {prompt.secondary.text}
            </button>
          )}
        </div>
      )}
    </>
  );
}
