import { AIRLOCK_BOUNDS, CAVE_SHELTERS, LAB_STATION, PANEL_FIELD, SUIT_STATION, getZoneAt, isPointInCave } from './constants';
import { EngineState, FieldSiteKind, IceDeposit } from './types';

export interface Mission {
  id: string;
  // When it can appear in a shuffled plan: 1 early … 4 late.
  stage: number;
  title: string;
  optional?: boolean;
  desc: string;
  check: (eng: EngineState) => boolean;
  target: (eng: EngineState) => { x: number; y: number } | null;
  reward?: (eng: EngineState) => string;
}

function nearest<T extends { x: number; y: number }>(eng: EngineState, list: T[]): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const it of list) {
    const d = Math.hypot(eng.player.x - it.x, eng.player.y - it.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

function nearestSite(eng: EngineState, kind: FieldSiteKind) {
  return nearest(
    eng,
    eng.fieldSites.filter((f) => f.kind === kind && !f.collected)
  );
}

function nearestDeposit(eng: EngineState, filter: (d: IceDeposit) => boolean) {
  return nearest(eng, eng.iceDeposits.filter((d) => d.amountKg > 0 && filter(d)));
}

const AIRLOCK = { x: AIRLOCK_BOUNDS.x + AIRLOCK_BOUNDS.w / 2, y: AIRLOCK_BOUNDS.y + AIRLOCK_BOUNDS.h / 2 };
const YARD_ICE = { x: 1330, y: 400 };
const PANEL_CENTER = { x: PANEL_FIELD.x + PANEL_FIELD.w / 2, y: PANEL_FIELD.y + PANEL_FIELD.h / 2 };

const part = (eng: EngineState) => {
  eng.parts += 1;
  return '+1 spare part';
};

// Every mission in the game. Each expedition builds its own plan from these (see buildMissionPlan).
export const MISSION_CATALOG: Mission[] = [
  // ------------------------------------------------------------ first-expedition introduction
  {
    id: 'step_outside',
    stage: 0,
    title: 'Step outside',
    desc: 'Walk out through the airlock (right side of the habitat).',
    check: (e) => e.player.inEvaSuit,
    target: () => AIRLOCK,
  },
  {
    id: 'find_ice',
    stage: 0,
    title: 'Find buried ice',
    desc: 'Walk to the marker and press [R] to scan with radar.',
    check: (e) => e.iceDeposits.some((d) => d.scanLevel >= 1),
    target: () => YARD_ICE,
  },
  {
    id: 'core_sample',
    stage: 0,
    title: 'Take a core sample',
    desc: 'Walk onto a blue radar echo and press [E].',
    check: (e) => e.iceDeposits.some((d) => d.scanLevel === 2),
    target: (e) => nearestDeposit(e, (d) => d.scanLevel === 1) ?? YARD_ICE,
  },
  {
    id: 'drill_20',
    stage: 0,
    title: 'Drill 20 kg of ice',
    desc: 'Press [E] on the sampled ice and stay next to the drill.',
    check: (e) => e.iceMinedKg >= 20,
    target: (e) =>
      nearestDeposit(e, (d) => d.scanLevel === 2 && d.depth === 'SHALLOW') ??
      nearestDeposit(e, (d) => d.scanLevel === 2),
    reward: part,
  },
  {
    id: 'clean_suit',
    stage: 0,
    title: 'Clean your suit',
    desc: 'Back inside, press [E] at the suit station by the airlock. Do this every time you come in.',
    check: (e) => e.suitRepairs >= 1,
    target: () => SUIT_STATION,
  },
  {
    id: 'grow_food',
    stage: 0,
    title: 'Grow food',
    desc: 'Press [E] on an empty plant bed (top left of the habitat).',
    check: (e) => e.seedsPlanted >= 1,
    target: (e) => {
      const b = e.beds.find((x) => x.stage === 'EMPTY') ?? e.beds[0];
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    },
    reward: (e) => {
      e.seeds += 2;
      return '+2 seeds';
    },
  },
  {
    id: 'bring_buddy',
    stage: 0,
    title: 'Step outside with a buddy',
    desc: 'NASA never sends anyone out alone. Walk up to a crewmate, press [B], then go out through the airlock together.',
    check: (e) => e.followerCrew !== null && e.player.inEvaSuit,
    target: (e) => {
      if (e.followerCrew !== null) return AIRLOCK;
      const n = nearest(e, e.npcs.filter((n) => n.state !== 'SLEEP'));
      return n ? { x: n.x, y: n.y } : null;
    },
  },
  // ------------------------------------------------------------ core missions (every expedition)
  {
    id: 'clean_panels',
    stage: 1,
    title: 'Brush the solar panels',
    desc: 'Dust cuts solar power. Go to the solar array (southeast of the yard) and press [E].',
    check: (e) => e.panelsCleaned >= 1,
    target: () => PANEL_CENTER,
  },
  {
    id: 'collect_samples',
    stage: 2,
    title: 'Collect 2 lakebed samples',
    desc: 'Walk east to the Crater Field and press [E] on glowing rocks.',
    check: (e) => e.samplesCollected >= 2,
    target: (e) => nearestSite(e, 'SAMPLE'),
    reward: part,
  },
  {
    id: 'analyze',
    stage: 3,
    title: 'Analyze a sample',
    desc: 'Bring your samples home and press [E] at the lab (west side of the habitat).',
    check: (e) => e.samplesAnalyzed >= 1,
    target: () => LAB_STATION,
    reward: (e) => {
      e.science += 20;
      return '+20 science';
    },
  },
  {
    id: 'drive_rover',
    stage: 2,
    title: 'Drive the rover',
    desc: 'Walk to the rover in the yard and press [V].',
    check: (e) => e.roverBoarded,
    target: (e) => (e.player.inRover ? null : { x: e.rover.x, y: e.rover.y }),
  },
  {
    id: 'fuel_50',
    stage: 4,
    title: 'Fuel tank to 50%',
    desc: 'Keep the fuel plant [G] on and keep water above 15%.',
    check: (e) => e.resources.fuel >= 50,
    target: (e) => (e.resources.water < 40 ? nearestDeposit(e, (d) => d.scanLevel >= 1) : null),
  },
  // ------------------------------------------------------------ optional classics
  {
    id: 'volcano',
    stage: 3,
    optional: true,
    title: 'Volcano minerals',
    desc: 'Drive northeast to the Volcano Slope and collect a mineral [E].',
    check: (e) => e.mineralsCollected >= 1,
    target: (e) => nearestSite(e, 'MINERAL'),
    reward: part,
  },
  {
    id: 'polar',
    stage: 3,
    optional: true,
    title: 'Polar ice run',
    desc: 'Drive to the Polar Ice Cap (northwest) and mine 100 kg in total.',
    check: (e) => e.iceMinedKg >= 100,
    target: (e) =>
      nearestDeposit(e, (d) => getZoneAt(d.x, d.y).id === 'POLAR_CAP') ?? nearestDeposit(e, () => true),
    reward: part,
  },
  // ------------------------------------------------------------ extra missions for harder expeditions
  {
    id: 'meteorites',
    stage: 1,
    title: 'Hunt for meteorites',
    desc: 'Collect 2 iron meteorites on the Ice Plains (north) with [E].',
    check: (e) => e.meteoritesCollected >= 2,
    target: (e) => nearestSite(e, 'METEORITE'),
    reward: (e) => {
      e.scrap += 3;
      return '+3 kg scrap';
    },
  },
  {
    id: 'cave_test',
    stage: 1,
    title: 'Scout a radiation shelter',
    desc: 'Walk west to the Lava Tube Caves and step inside a cave mouth.',
    check: (e) => e.player.inEvaSuit && isPointInCave(e.player.x, e.player.y),
    target: () => ({ x: CAVE_SHELTERS[1].x + CAVE_SHELTERS[1].w / 2, y: CAVE_SHELTERS[1].y + CAVE_SHELTERS[1].h / 2 }),
  },
  {
    id: 'print_part',
    stage: 1,
    title: 'Make your own spare part',
    desc: 'Inside the habitat, press [P] to 3D-print a part from recycled packaging.',
    check: (e) => e.partsPrinted >= 1,
    target: () => null,
  },
  {
    id: 'insulate',
    stage: 1,
    title: 'Insulate the habitat',
    desc: 'Spend 2 parts with [U] so the habitat keeps its heat at night.',
    check: (e) => e.insulationLevel >= 1,
    target: () => null,
  },
  {
    id: 'deep_ice',
    stage: 2,
    title: 'Tap a deep ice deposit',
    desc: 'Install a drill rig (1 part) on a deep deposit and drill it with [E].',
    check: (e) => e.iceDeposits.some((d) => d.depth === 'DEEP' && d.rigInstalled && d.amountKg < d.maxKg),
    target: (e) => nearestDeposit(e, (d) => d.depth === 'DEEP'),
  },
  {
    id: 'analyze_3',
    stage: 3,
    title: 'Run three lab analyses',
    desc: 'Collect more samples and analyze 3 in total at the lab [E].',
    check: (e) => e.samplesAnalyzed >= 3,
    target: (e) => (e.sampleQueue.length > 0 ? LAB_STATION : nearestSite(e, 'SAMPLE')),
    reward: part,
  },
  {
    id: 'explore_all',
    stage: 3,
    title: 'Map every zone',
    desc: 'Visit all 6 zones (the far corners need the rover).',
    check: (e) => e.discoveredZones.length >= 6,
    target: () => null,
    reward: (e) => {
      e.science += 40;
      return '+40 science';
    },
  },
  {
    id: 'glacier',
    stage: 3,
    title: 'Mine the buried glacier',
    desc: 'After Sol 60 a glacier is found in the Crater Field. Drill 50 kg from it.',
    check: (e) => e.iceDeposits.some((d) => d.x === 2400 && d.maxKg - d.amountKg >= 50),
    target: (e) => nearestDeposit(e, (d) => d.x === 2400),
  },
  {
    id: 'science_200',
    stage: 3,
    title: 'Reach 200 science points',
    desc: 'Samples, lab results, experiments and exploring all add science.',
    check: (e) => e.science >= 200,
    target: () => null,
  },
  {
    id: 'biosignature',
    stage: 3,
    optional: true,
    title: 'Search for ancient life',
    desc: 'Analyze lakebed rocks until the lab finds a possible biosignature. The leopard-spot rock is your best bet.',
    check: (e) => e.discoveries >= 1,
    target: (e) => (e.sampleQueue.length > 0 ? LAB_STATION : nearestSite(e, 'SAMPLE')),
    reward: (e) => {
      e.science += 50;
      return '+50 science';
    },
  },
  // ------------------------------------------------------------ the finale (always last)
  {
    id: 'fuel_100',
    stage: 5,
    title: 'Fill the fuel tank',
    desc: 'Reach 100% fuel for the ascent vehicle.',
    check: (e) => e.resources.fuel >= 100,
    target: (e) => (e.resources.water < 40 ? nearestDeposit(e, (d) => d.scanLevel >= 1) : null),
  },
  {
    id: 'survive',
    stage: 6,
    title: 'Survive to launch',
    desc: 'Keep the crew alive until the launch window on Sol 178.',
    check: () => false,
    target: () => null,
  },
];

const BY_ID = new Map(MISSION_CATALOG.map((m) => [m.id, m]));

export function getMission(id: string): Mission {
  return BY_ID.get(id) ?? BY_ID.get('survive')!;
}

// The mission at a position in this expedition's plan.
export function missionAt(eng: EngineState, index: number): Mission {
  return getMission(eng.missionPlan[Math.min(index, eng.missionPlan.length - 1)]);
}

const INTRO = ['bring_buddy', 'find_ice', 'core_sample', 'drill_20', 'clean_suit', 'grow_food'];
const CORE = ['clean_panels', 'collect_samples', 'drive_rover', 'analyze', 'fuel_50'];
const OPTIONAL = ['volcano', 'polar'];
const EXTRAS = ['meteorites', 'cave_test', 'print_part', 'insulate', 'deep_ice', 'analyze_3', 'explore_all', 'glacier', 'science_200', 'biosignature'];

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * First expedition: a fixed teaching order. Every harder expedition skips the basics,
 * shuffles the order (within early/mid/late stages) and adds new missions from the extras pool.
 */
export function buildMissionPlan(difficulty: number): string[] {
  if (difficulty <= 0) return [...INTRO, ...CORE, ...OPTIONAL, 'fuel_100', 'survive'];
  const extras = shuffle(EXTRAS).slice(0, Math.min(EXTRAS.length, 1 + difficulty));
  const pool = shuffle([...CORE, ...OPTIONAL, ...extras]);
  // Stable sort by stage keeps the shuffled order inside each stage
  pool.sort((a, b) => getMission(a).stage - getMission(b).stage);
  // analyze must come after collect_samples
  const ci = pool.indexOf('collect_samples');
  const ai = pool.indexOf('analyze');
  if (ci > ai && ai >= 0) {
    pool.splice(ai, 1);
    pool.splice(pool.indexOf('collect_samples') + 1, 0, 'analyze');
  }
  return ['bring_buddy', ...pool, 'fuel_100', 'survive'];
}

// Kept for older code paths: the first expedition's plan.
export const MISSIONS: Mission[] = buildMissionPlan(0).map(getMission);
