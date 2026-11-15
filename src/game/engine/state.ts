// Engine state: creating a run, difficulty/unlock helpers and small shared utilities.
import { buildMissionPlan } from '../missions';
import { createNpcs } from './npcs';
import { sound } from '../audio';
import {
  CARGO_ZONE_POINTS,
  createCrew,
  CHALLENGES,
  DRAIN_MULT,
  HARSH_PER_LEVEL,
  HP_MAX,
  ROVER_SPEED_MULT,
  ROVER_START,
  createFieldSites,
  FAILURES_FOR_REDESIGN,
  MISSION_MONTHS,
  NOMINAL_EVENT,
  createInitialIceDeposits,
  createInitialModules,
  createInitialPlantBeds,
} from '../constants';
import {
  EngineState,
  IceQuality,
  ModuleState,
  SupplyCrateKind,
} from '../types';


export function hasChallenge(eng: EngineState, id: string): boolean {
  const idx = CHALLENGES.findIndex((c) => c.id === id);
  return idx >= 0 && eng.difficulty > idx;
}

// Drain multiplier: base +10%, plus +10% per level beyond the last challenge.
export function drainMult(eng: EngineState): number {
  return DRAIN_MULT * (1 + HARSH_PER_LEVEL * Math.max(0, eng.difficulty - CHALLENGES.length));
}

// Logs a hardware failure; after repeated failures engineers "redesign" the part (less wear).
export function registerFailureFn(
  eng: EngineState,
  mod: ModuleState,
  reason: string,
  addLog: (t: string, tone?: 'info' | 'warning' | 'success') => void
) {
  eng.moduleFailures[mod.id] += 1;
  const n = eng.moduleFailures[mod.id];
  if (n >= FAILURES_FOR_REDESIGN && !eng.upgradedModules.includes(mod.id)) {
    eng.upgradedModules.push(mod.id);
    sound.playSuccess();
    eng.floatingTexts.push({
      x: mod.x + mod.w / 2,
      y: mod.y - 26,
      text: `${mod.shortLabel} REDESIGNED · -30% WEAR`,
      color: '#c4b5fd',
      life: 2.2,
      maxLife: 2.2,
    });
    addLog(
      `Failure log for ${mod.name} (${n} anomalies) sent to Houston. Engineers uplinked a redesign: this module now wears 30% slower.`,
      'success'
    );
  } else {
    addLog(`Anomaly logged on ${mod.name} (${reason}). Failure reports: ${n}/${FAILURES_FOR_REDESIGN}.`, 'info');
  }
}

export function moveSpeedForFx(eng: EngineState): number {
  return eng.player.inRover ? eng.player.speed * ROVER_SPEED_MULT : eng.player.speed;
}

export function hasUnlock(eng: EngineState, id: string): boolean {
  return eng.unlocks.includes(id);
}

export function createInitialEngineState(solNumber = 1, difficulty = 0, unlocks: string[] = []): EngineState {
  const eng = buildEngineState(solNumber, difficulty);
  eng.unlocks = [...unlocks];
  if (hasUnlock(eng, 'HAB2')) eng.parts += 2;
  const has = (id: string) => hasChallenge(eng, id);
  if (has('SUPPLIES')) {
    eng.parts = Math.max(0, eng.parts - 1);
    eng.resources.water *= 0.8;
  }
  if (has('ICE')) {
    for (const d of eng.iceDeposits) {
      d.maxKg = Math.round(d.maxKg * 0.75);
      d.amountKg = d.maxKg;
    }
  }
  if (difficulty > 0) {
    const active = CHALLENGES.slice(0, difficulty).map((c) => c.name);
    eng.scienceLog.unshift({
      time: '06:00 LMST',
      text: `Expedition difficulty ${difficulty}. Active challenges: ${active.join(', ')}${
        difficulty > CHALLENGES.length ? ` + harsh Mars x${difficulty - CHALLENGES.length}` : ''
      }.`,
      tone: 'warning',
    });
  }
  return eng;
}

export function buildEngineState(solNumber: number, difficulty: number): EngineState {
  return {
    difficulty,
    missionPlan: buildMissionPlan(difficulty),
    npcs: createNpcs(0),
    followerCrew: null,
    breadcrumbs: [],
    soloWarned: false,
    releaseBuddy: false,
    suitDust: 0,
    habDust: 0,
    panelDust: 15,
    meteorsLeft: Math.random() < 0.6 ? 1 : 0,
    nextFaultTimer: 75,
    panelsCleaned: 0,
    unlocks: [],
    crew: createCrew(),
    activeCrew: 0,
    medKits: 2,
    pendingDecision: null,
    usedDecisions: [],
    nextDecisionTimer: 55,
    earthQueue: [],
    earthMessage: null,
    nextEarthTimer: 25,
    sampleQueue: [],
    labProgress: null,
    labSample: null,
    science: 0,
    scienceRewarded: 0,
    discoveries: 0,
    samplesAnalyzed: 0,
    dialogueQueue: [],
    dialogueLine: null,
    usedConversations: [],
    chatterTimer: 40,
    shabbatTimer: 70,
    dialogueSaid: [],
    footprints: [],
    trail: [],
    stepAccum: 0,
    walkPhase: 0,
    hopper: { q: 'PURE', kg: 0 },
    solNumber,
    elapsedSolSec: 0,
    totalElapsedSec: 0,
    nextEventTimer: 60,
    nextAsteroidTimer: 90,
    nextSupplyTimer: 14,
    crateSeq: 1,
    asteroidSeq: 1,
    screenShake: 0,
    repairsCompleted: 0,
    repairFailures: 0,
    evasCompleted: 0,
    cropsHarvested: 0,
    wasOutdoor: false,
    causeOfDeath: '',
    nasaDebriefTip: '',
    netPowerKw: 2.0,
    genPowerKw: 18.0,
    loadPowerKw: 16.0,
    heaterMode: 'NOMINAL',
    heaterKw: 3.0,
    insulationLevel: 0,
    parts: 2,
    seeds: 4,
    sickTimer: 0,
    pipesFrozen: false,
    cropsPausedReason: null,
    resources: {
      o2: 96,
      power: 92,
      food: 75,
      shield: 96,
      heat: 88,
      water: 70,
      hp: HP_MAX,
      fuel: 0,
    },
    beds: createInitialPlantBeds(),
    player: {
      x: 520,
      y: 500,
      radius: 18,
      speed: 265,
      facingAngle: 0,
      moving: false,
      inEvaSuit: false,
      inRover: false,
      vx: 0,
      vy: 0,
    },
    modules: createInitialModules(),
    asteroids: [],
    sparks: [],
    crates: CARGO_ZONE_POINTS.map((pt, i) => {
      const kinds: Array<{ kind: SupplyCrateKind; label: string; color: string }> = [
        { kind: 'parts', label: '+1 PARTS', color: '#fb923c' },
        { kind: 'seeds', label: '+2 SEEDS', color: '#4ade80' },
        { kind: 'water', label: '+25% H₂O', color: '#38bdf8' },
        { kind: 'parts', label: '+1 PARTS', color: '#fb923c' },
        { kind: 'o2', label: '+O₂ TANK', color: '#22d3ee' },
        { kind: 'parts', label: '+1 PARTS', color: '#fb923c' },
      ];
      return { id: 1000 + i, x: pt.x, y: pt.y, radius: 17, ...kinds[i % kinds.length] };
    }),
    particles: Array.from({ length: 120 }, () => ({
      x: 520 + (Math.random() - 0.5) * 2200,
      y: 500 + (Math.random() - 0.5) * 1400,
      size: Math.random() * 2.2 + 0.8,
      vx: Math.random() * 26 + 10,
      vy: Math.random() * 8 - 4,
      alpha: Math.random() * 0.25 + 0.1,
    })),
    floatingTexts: [],
    activeEvent: { ...NOMINAL_EVENT },
    scienceLog: [
      {
        time: '06:00 LMST',
        text: `${MISSION_MONTHS[0].title}: ${MISSION_MONTHS[0].summary}`,
        tone: 'info',
      },
      {
        time: '06:00 LMST',
        text: 'Mission goal: survive 6 months AND fill the ascent vehicle with CH₄/LOX fuel (Sabatier ISRU) before the launch window closes. Water comes from buried ice  -  scan [R] outside.',
        tone: 'info',
      },
    ],
    missionIndex: 0,
    missionTarget: null,
    seedsPlanted: 0,
    roverBoarded: false,
    cold: 0,
    suit: 85,
    suitRepairs: 0,
    frostFlash: 0,
    quakeShake: 0,
    rover: { x: ROVER_START.x, y: ROVER_START.y, facingAngle: Math.PI, battery: 100 },
    fieldSites: createFieldSites(),
    discoveredZones: ['BASE'],
    samplesCollected: 0,
    mineralsCollected: 0,
    meteoritesCollected: 0,
    gateWarnTimer: 0,
    iceDeposits: createInitialIceDeposits(),
    iceKg: 0,
    drillingId: null,
    scanCooldown: 0,
    scansCompleted: 0,
    iceMinedKg: 0,
    fuelPlantOn: true,
    isruLoadKw: 0,
    scrap: 3,
    printCooldown: 0,
    partsPrinted: 0,
    moduleFailures: { o2: 0, power: 0, food: 0, shield: 0 },
    upgradedModules: [],
    failLatch: { o2: false, power: false, food: false, shield: false },
    preventiveDone: 0,
    doseMsv: 0,
  };
}

export const QUALITY_RANK: Record<IceQuality, number> = { PURE: 0, DIRTY: 1, PERCHLORATE: 2 };

// Ice in the hopper is processed at the yield of its worst contaminant.
export function mixQuality(
  current: { q: IceQuality; kg: number },
  incoming: IceQuality,
  kg: number
): { q: IceQuality; kg: number } {
  const q = current.kg <= 0.01 || QUALITY_RANK[incoming] > QUALITY_RANK[current.q] ? incoming : current.q;
  return { q, kg: current.kg + kg };
}

export const QUALITY_LABEL: Record<IceQuality, string> = {
  PURE: 'Pure ice',
  DIRTY: 'Dusty ice',
  PERCHLORATE: 'Perchlorate brine ice',
};

