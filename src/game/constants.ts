// Game map, zones, crew stats, and NASA event numbers
// Note: used AI to help get the NASA mission numbers and day/night sine wave math
import {
  ActiveEventState,
  CrewMember,
  CaveShelter,
  FieldSite,
  IceDeposit,
  ZoneId,
  ZoneInfo,
  HistoricalEvent,
  HistoricalEventKind,
  LmstInfo,
  MissionMonthInfo,
  ModuleMode,
  ModuleState,
  PlantBed,
  WallRect,
} from './types';

// One zone = 1600 x 1000. The home base zone spans (0,0)-(1600,1000);
// the explorable world is a 3x3 grid of zones around it.
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1000;
export const ZONE_W = MAP_WIDTH;
export const ZONE_H = MAP_HEIGHT;
export const WORLD = { minX: -ZONE_W, minY: -ZONE_H, maxX: ZONE_W * 2, maxY: ZONE_H };

export const ZONES: ZoneInfo[] = [
  { id: 'POLAR_CAP', name: 'Polar Ice Cap', col: -1, row: -1, roverOnly: true, tint: '#b9a9a0', blurb: 'Huge pure ice sheets. Rover only.' },
  { id: 'ICE_PLAINS', name: 'Ice Plains', col: 0, row: -1, roverOnly: false, tint: '#a5543a', blurb: 'Shallow ice and meteorites on the surface.' },
  { id: 'VOLCANO', name: 'Volcano Slope', col: 1, row: -1, roverOnly: true, tint: '#4b2a22', blurb: 'Basalt minerals for spare parts. Rover only.' },
  { id: 'LAVA_TUBES', name: 'Lava Tube Caves', col: -1, row: 0, roverOnly: false, tint: '#7a2f1c', blurb: 'Caves block radiation. Shelter during flares.' },
  { id: 'BASE', name: 'Home Base · Jezero Yard', col: 0, row: 0, roverOnly: false, tint: '#9a3418', blurb: 'Your habitat and life-support modules.' },
  { id: 'CRATER_FIELD', name: 'Crater Field', col: 1, row: 0, roverOnly: false, tint: '#8c3a1e', blurb: 'Deep ice, old lakebed rocks and a cargo pad.' },
];

export function getZoneAt(x: number, y: number): ZoneInfo {
  const col = Math.max(-1, Math.min(1, Math.floor(x / ZONE_W)));
  const row = Math.max(-1, Math.min(0, Math.floor(y / ZONE_H)));
  return ZONES.find((z) => z.col === col && z.row === row)!;
}

export function getZoneById(id: ZoneId): ZoneInfo {
  return ZONES.find((z) => z.id === id)!;
}

export const CAVE_SHELTERS: CaveShelter[] = [
  { x: -1250, y: 220, w: 280, h: 160 },
  { x: -620, y: 620, w: 300, h: 170 },
  { x: -1400, y: 720, w: 240, h: 150 },
];

export function isPointInCave(x: number, y: number): boolean {
  return CAVE_SHELTERS.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
}

// --- Suit repair station (inside the habitat, next to the airlock) ---
export const SUIT_STATION = { x: 735, y: 650 };
export const SUIT_STATION_RADIUS = 75;

// --- Sample lab (inside the habitat, west side) ---
export const LAB_STATION = { x: 270, y: 500 };
export const LAB_STATION_RADIUS = 75;
export const LAB_ANALYSIS_SECONDS = 8;
export const SCIENCE_PER_PART = 100; // every 100 science, Houston approves a spare part

export function createCrew(): CrewMember[] {
  return [
    { id: 0, name: 'Mateo Sheinbaum', role: 'ENGINEER', hp: 100, morale: 85, down: false },
    { id: 1, name: 'Xavier Netanyahu', role: 'GEOLOGIST', hp: 100, morale: 85, down: false },
    { id: 2, name: 'Grace Arpeba', role: 'BOTANIST', hp: 100, morale: 85, down: false },
    { id: 3, name: 'Adrian Salido', role: 'DOCTOR', hp: 100, morale: 85, down: false },
  ];
}

export const ROLE_INFO: Record<CrewMember['role'], { label: string; perk: string; buddy: string }> = {
  ENGINEER: { label: 'Engineer', perk: 'Repairs need 3 tasks instead of 4 when he does them; modules wear 15% slower.', buddy: 'outdoor repairs need one task fewer.' },
  GEOLOGIST: { label: 'Geologist', perk: 'When he is outside: radar reaches 40% farther and drilling is 25% faster.', buddy: 'drilling and radar are 25% better.' },
  BOTANIST: { label: 'Botanist', perk: 'Crops grow 30% faster while she is healthy and happy.', buddy: '+10 science for every sample (she spots the interesting ones).' },
  DOCTOR: { label: 'Doctor', perk: 'Crew heals 50% faster and sickness ends twice as fast.', buddy: 'you get cold 15% slower and frostbite risk is halved.' },
};

// --- Campaign unlocks: one per completed expedition ---
export const UNLOCKS: Array<{ id: string; name: string; desc: string }> = [
  { id: 'ROVER_BATT', name: 'Long-range rover batteries', desc: 'Rover battery drains 40% slower.' },
  { id: 'DRILL', name: 'Diamond drill bits', desc: 'Drilling ice is 30% faster.' },
  { id: 'HAB2', name: 'Second habitat module', desc: 'Start with +2 parts; the habitat loses 15% less heat.' },
  { id: 'SUITS', name: 'Next-gen suits', desc: 'Suits wear 35% slower and the cold builds 15% slower.' },
  { id: 'FUELPLANT', name: 'Bigger fuel plant', desc: 'Fuel fills 20% faster.' },
  { id: 'VETERANS', name: 'Veteran crew', desc: 'Morale drops 40% slower.' },
];

// --- Crew living in the habitat ---
/** Crew quarters (decoration + where crew sleep at night): 4 bunks in the right wing. */
export const QUARTERS = { x: 466, y: 588, w: 190, h: 196 };
export const BUNKS = [
  { x: 488, y: 606 },
  { x: 568, y: 606 },
  { x: 488, y: 694 },
  { x: 568, y: 694 },
];
/** Places crew members wander to when idle, with what they appear to be doing. */
export const CREW_SPOTS: Array<{ x: number; y: number; activity: string }> = [
  { x: 330, y: 380, activity: 'checking the plants' },
  { x: 270, y: 562, activity: 'working in the lab' },
  { x: 600, y: 215, activity: 'at the computer' },
  { x: 690, y: 215, activity: 'reading telemetry' },
  { x: 600, y: 790, activity: 'at the workbench' },
  { x: 520, y: 430, activity: 'stretching' },
  { x: 735, y: 560, activity: 'checking the suits' },
  { x: 200, y: 420, activity: 'checking food stores' },
  { x: 360, y: 600, activity: 'on the exercise bike' },
];
/** The opening between the habitat's left and right wings. */
export const WING_DOOR = { x: 439, y: 500 };
export const NPC_INTERACT_RADIUS = 64;

// --- Solar array (gets dusty; brush it clean) ---
export const PANEL_FIELD = { x: 1290, y: 850, w: 260, h: 100 };
export const PANEL_INTERACT_RADIUS = 120;

// --- Dust tracked inside (perchlorates) ---
export const SUIT_DUST_RATE = 0.8; // per second walking outside
export const HAB_DUST_FROM_SUIT = 0.9; // share of the dust shed by a dirty suit that ends up in the habitat air
export const HAB_DUST_FILTER = 0.35; // per second removed by air filters (scaled by MOXIE health)

// --- Time on Mars ---
/** 6 Earth months ≈ 182.6 Earth days ≈ 177.7 sols (a sol is 24 h 39 min 35 s). */
export const SOL_IN_EARTH_DAYS = 1.0275;
export const TOTAL_SOLS = 178;
export function solsToEarthMonths(sols: number): number {
  return (sols * SOL_IN_EARTH_DAYS) / 30.44;
}
/** Dust-storm season: Mars near perihelion, southern spring/summer (months 3–4 of this mission). */
export function seasonForMonth(month: number): { name: string; storms: boolean } {
  if (month <= 2) return { name: 'Northern spring · calm', storms: false };
  if (month <= 4) return { name: 'Southern summer · dust storm season', storms: true };
  return { name: 'Southern autumn · clearing', storms: false };
}

// --- Cold exposure (EVA) ---
export const COLD_GAIN_DAY = 0.5; // per second outside by day
export const COLD_GAIN_NIGHT = 1.8; // per second outside at night
export const COLD_RECOVER_INSIDE = 3.5; // per second inside the habitat
export const COLD_RECOVER_ROVER = 1.5; // heated rover cabin
export const COLD_FREEZE_START = 60; // above this, frostbite becomes possible

// --- Rover ---
export const ROVER_START = { x: 1365, y: 780 };
export const ROVER_SPEED_MULT = 2.3;
export const ROVER_BOARD_RADIUS = 90;
export const ROVER_DRAIN_PER_SEC = 0.45; // % battery while driving
export const ROVER_RECHARGE_PER_SEC = 6; // % while parked in the home base zone

export function createFieldSites(): FieldSite[] {
  const list: Array<Omit<FieldSite, 'id' | 'collected'>> = [
    // Crater Field: old lakebed rocks (Jezero itself is an ancient crater lake)
    { x: 1850, y: 160, kind: 'SAMPLE', label: 'Mudstone' },
    { x: 2350, y: 220, kind: 'SAMPLE', label: 'Clay layer' },
    { x: 2620, y: 460, kind: 'SAMPLE', label: 'Carbonate rim' },
    { x: 1950, y: 620, kind: 'SAMPLE', label: 'Leopard-spot rock' },
    { x: 3050, y: 420, kind: 'SAMPLE', label: 'Lake sandstone' },
    { x: 2250, y: 880, kind: 'SAMPLE', label: 'Fine silt' },
    // Volcano slope: basalt minerals (sintered into spare parts)
    { x: 1900, y: -300, kind: 'MINERAL', label: 'Basalt' },
    { x: 2300, y: -700, kind: 'MINERAL', label: 'Olivine' },
    { x: 2700, y: -420, kind: 'MINERAL', label: 'Pyroxene' },
    { x: 3000, y: -800, kind: 'MINERAL', label: 'Basalt' },
    { x: 2500, y: -160, kind: 'MINERAL', label: 'Iron oxide' },
    // Ice Plains: iron meteorites (like Opportunity's "Heat Shield Rock")
    { x: 250, y: -520, kind: 'METEORITE', label: 'Iron meteorite' },
    { x: 1150, y: -800, kind: 'METEORITE', label: 'Iron meteorite' },
    { x: 1450, y: -480, kind: 'METEORITE', label: 'Iron meteorite' },
  ];
  return list.map((s, i) => ({ ...s, id: i + 1, collected: false }));
}

// Cargo landing pad in the east of the Crater Field
export const CARGO_ZONE_POINTS = [
  { x: 2850, y: 760 },
  { x: 3000, y: 860 },
  { x: 2700, y: 900 },
];
export const HAB_BOUNDS = { x: 80, y: 120, w: 740, h: 760 };
export const AIRLOCK_BOUNDS = { x: 820, y: 430, w: 110, h: 140 };
export const INTERACTION_RADIUS = 128;
export const BED_INTERACTION_RADIUS = 72;

export const REPAIR_INVULNERABILITY_SECONDS = 10;
export const HP_MAX = 200; // doubled crew health
export const HP_DAMAGE_MULT = 0.5; // health drops at half speed
export const POWER_DRAIN_MULT = 0.25; // battery lasts 4x longer
export const POWER_GEN_MULT = 2; // solar + reactor produce twice as much
export const REPAIR_FAIL_DAMAGE = 8;

export const INSULATION_MAX_LEVEL = 3;
export const INSULATION_UPGRADE_COST = 2; // parts per insulation upgrade level
export const HEAT_FREEZE_THRESHOLD = 30; // below 30%, pipes freeze & crops halt
export const HEAT_HYPOTHERMIA_THRESHOLD = 18; // below 18%, crew health drops
export const CROP_RIPE_WILT_SECONDS = 70; // seconds a ripe crop lasts before wilting

// --- Ice prospecting (NASA Subsurface Water Ice Mapping / MRO SHARAD radar) ---
export const SCAN_RADIUS = 450; // ground-penetrating radar reach (px)
export const SCAN_COOLDOWN_SECONDS = 3;
export const SCAN_POWER_COST = 1; // % of battery per radar sweep
export const DEPOSIT_INTERACTION_RADIUS = 80;
export const DRILL_RATE_SHALLOW = 6.0; // kg/s for ice under ~1 m of regolith
export const DRILL_RATE_DEEP = 3.5; // kg/s via Rodwell (melt-in-place) once a rig is installed
export const DRILL_POWER_KW = 2.0;
export const DEEP_RIG_PART_COST = 1;

// --- ISRU chain ---
export const MELTER_RATE_KG = 2.0; // kg of ice melted per second
export const MELTER_KW = 1.5;
export const ICE_WATER_YIELD: Record<'PURE' | 'DIRTY' | 'PERCHLORATE', number> = {
  PURE: 0.9,
  DIRTY: 0.7,
  PERCHLORATE: 0.5, // reverse-osmosis brine reject removes ClO₄⁻ but wastes water
};
export const CREW_NET_WATER_LOSS = 0.025; // %/s lost after ISS-style ~98% water recovery
export const ELECTROLYSIS_KW = 2.0; // OGA-style water electrolysis backup
export const SABATIER_KW = 2.5;
export const SABATIER_FUEL_RATE = 0.7; // %/s of ascent propellant
export const SABATIER_WATER_USE = 0.75; // %/s water split for H₂: a full tank needs ~150 kg of mined ice
export const LAUNCH_FUEL_REQUIRED = 100;

// Global balance: everything drains 10% faster, every generator makes 10% less
export const DRAIN_MULT = 1.1;
export const GEN_MULT = 0.9;

// Expedition difficulty: each new expedition adds one challenge (cumulative)
export const CHALLENGES: Array<{ id: string; name: string; desc: string }> = [
  { id: 'SUPPLIES', name: 'Thin supplies', desc: 'Start with 1 fewer spare part and 20% less water.' },
  { id: 'STORMS', name: 'Stormy season', desc: 'Dust storms, flares and quakes come 30% more often.' },
  { id: 'WEAR', name: 'Aging hardware', desc: 'Modules wear out 30% faster.' },
  { id: 'COLD', name: 'Bitter nights', desc: 'The cold meter rises 30% faster outside.' },
  { id: 'ICE', name: 'Thin ice', desc: 'Every ice deposit holds 25% less.' },
  { id: 'FUEL', name: 'Heavy rocket', desc: 'The fuel plant fills the tank 20% slower.' },
];
export const HARSH_PER_LEVEL = 0.1; // past the last challenge, +10% drain per level

// --- Maintenance & fabrication ---
export const PREVENTIVE_THRESHOLD = 78; // above this, inspection is a 1-task check
export const MAJOR_REPAIR_THRESHOLD = 40; // below this, a full repair consumes 1 part
export const JURY_RIG_HEALTH = 70; // repair without parts only restores this much
export const PRINT_SCRAP_COST = 2;
export const PRINT_POWER_COST = 12; // % battery per printed part
export const PRINT_COOLDOWN_SECONDS = 5;
export const FAILURES_FOR_REDESIGN = 3;
export const REDESIGN_WEAR_MULT = 0.7;

// --- Radiation (Curiosity RAD / NASA 2022 career standard) ---
export const CAREER_DOSE_LIMIT_MSV = 600;
// 1 game second ≈ 1.25 Earth days of surface exposure (one "Mes" = 24 s ≈ 30 days)
export const DOSE_DAYS_PER_SECOND = 0.4;

// Easy-mode tuning
export const EASY_WEAR_MULT = 0.4;

export function createInitialIceDeposits(): IceDeposit[] {
  const spots: Array<Pick<IceDeposit, 'x' | 'y' | 'depth' | 'quality' | 'maxKg'>> = [
    // Home base yard (easy starters)
    { x: 985, y: 300, depth: 'SHALLOW', quality: 'DIRTY', maxKg: 30 },
    { x: 1430, y: 290, depth: 'SHALLOW', quality: 'PURE', maxKg: 30 },
    { x: 1500, y: 700, depth: 'SHALLOW', quality: 'DIRTY', maxKg: 26 },
    // Ice plains (north)
    { x: 400, y: -300, depth: 'SHALLOW', quality: 'PURE', maxKg: 40 },
    { x: 900, y: -620, depth: 'SHALLOW', quality: 'PURE', maxKg: 40 },
    { x: 1300, y: -250, depth: 'SHALLOW', quality: 'DIRTY', maxKg: 36 },
    { x: 600, y: -820, depth: 'SHALLOW', quality: 'PURE', maxKg: 44 },
    // Crater field (east)
    { x: 2100, y: 300, depth: 'DEEP', quality: 'PURE', maxKg: 80 },
    { x: 2700, y: 720, depth: 'DEEP', quality: 'DIRTY', maxKg: 70 },
    { x: 2900, y: 250, depth: 'SHALLOW', quality: 'PERCHLORATE', maxKg: 34 },
    // Lava tube caves (west): ice preserved in cold caves
    { x: -820, y: 330, depth: 'SHALLOW', quality: 'PURE', maxKg: 30 },
    // Polar cap (rover only): huge pure ice
    { x: -900, y: -500, depth: 'DEEP', quality: 'PURE', maxKg: 160 },
    { x: -420, y: -760, depth: 'SHALLOW', quality: 'PURE', maxKg: 120 },
  ];
  return spots.map((s, i) => ({
    id: i + 1,
    r: s.depth === 'DEEP' ? 34 : 24,
    amountKg: s.maxKg,
    scanLevel: 0,
    rigInstalled: false,
    ...s,
    quality:
      Math.random() < 0.2
        ? (['PURE', 'DIRTY', 'PERCHLORATE'] as const)[Math.floor(Math.random() * 3)]
        : s.quality,
  }));
}

// Month 8 "ancient glacier" deposit discovered by orbital SHARAD reprocessing
export function createGlacierDeposit(id: number): IceDeposit {
  return {
    id,
    x: 2400,
    y: 560,
    r: 42,
    depth: 'DEEP',
    quality: 'PURE',
    amountKg: 110,
    maxKg: 110,
    scanLevel: 2,
    rigInstalled: false,
  };
}

// "Every second an hour": 1 real second = 1 Martian LMST hour -> 24 seconds = 1 full Sol / Month
export const SOL_DURATION_SECONDS = 48;
export const TOTAL_MISSION_MONTHS = 6;

export const MISSION_MONTHS: MissionMonthInfo[] = [
  {
    month: 1,
    title: 'Sols 1–29: Arrival & adaptation',
    summary:
      'Check every habitat system, take your first Marswalk, scan the yard for buried ice and plant the first crops.',
  },
  {
    month: 2,
    title: 'Sols 30–59: Routines & nearby exploration',
    summary:
      'Grow food, drill ice for water and fuel, and explore the Ice Plains and Crater Field on foot.',
  },
  {
    month: 3,
    title: 'Sols 60–89: Advanced science',
    summary:
      'Collect lakebed samples in the Crater Field. Orbital radar reveals a buried glacier of pure ice there.',
  },
  {
    month: 4,
    title: 'Sols 90–118: Emergency drills',
    summary:
      'Equipment failures, suit problems and medical emergencies. Practice solving problems without help from Earth.',
  },
  {
    month: 5,
    title: 'Sols 119–148: Long expeditions',
    summary:
      'Take the rover to the Polar Ice Cap and Volcano Slope for big resources. Keep the fuel plant running.',
  },
  {
    month: 6,
    title: 'Sols 149–178: Getting ready to go home',
    summary:
      'Pack samples and fill the ascent vehicle to 100% CH₄/LOX fuel before the launch window closes on Sol 178.',
  },
];

export const WALLS: WallRect[] = [
  // Habitat Top, Bottom, Left Walls
  { x: 80, y: 120, w: 740, h: 24 },
  { x: 80, y: 856, w: 740, h: 24 },
  { x: 80, y: 120, w: 24, h: 760 },
  // Habitat Right Wall with Airlock Doorway Opening (y: 440 to 560 is open)
  { x: 800, y: 120, w: 24, h: 320 },
  { x: 800, y: 560, w: 24, h: 320 },
  // Airlock North & South Guide Walls
  { x: 820, y: 416, w: 110, h: 16 },
  { x: 820, y: 568, w: 110, h: 16 },
  // Interior Partial Dividers (Wide open, easy to walk around)
  { x: 430, y: 144, w: 18, h: 210 },
  { x: 430, y: 646, w: 18, h: 210 },
];

// Invisible outer boundary of the whole 3x3 world
export const WORLD_WALLS: WallRect[] = [
  { x: WORLD.minX, y: WORLD.minY, w: WORLD.maxX - WORLD.minX, h: 16 },
  { x: WORLD.minX, y: WORLD.maxY - 16, w: WORLD.maxX - WORLD.minX, h: 16 },
  { x: WORLD.minX, y: WORLD.minY, w: 16, h: WORLD.maxY - WORLD.minY },
  { x: WORLD.maxX - 16, y: WORLD.minY, w: 16, h: WORLD.maxY - WORLD.minY },
];

export function createInitialPlantBeds(): PlantBed[] {
  return [
    {
      id: 1,
      x: 246,
      y: 178,
      w: 76,
      h: 64,
      stage: 'LEAFY',
      medium: 'WATER',
      growth: 58,
      ripeTimer: CROP_RIPE_WILT_SECONDS,
      perchlorateWashed: true,
    },
    {
      id: 2,
      x: 338,
      y: 178,
      w: 76,
      h: 64,
      stage: 'SPROUT',
      medium: 'WATER',
      growth: 18,
      ripeTimer: CROP_RIPE_WILT_SECONDS,
      perchlorateWashed: true,
    },
    {
      id: 3,
      x: 246,
      y: 278,
      w: 76,
      h: 64,
      stage: 'EMPTY',
      medium: 'WATER',
      growth: 0,
      ripeTimer: CROP_RIPE_WILT_SECONDS,
      perchlorateWashed: true,
    },
    {
      id: 4,
      x: 338,
      y: 278,
      w: 76,
      h: 64,
      stage: 'EMPTY',
      medium: 'WATER',
      growth: 0,
      ripeTimer: CROP_RIPE_WILT_SECONDS,
      perchlorateWashed: true,
    },
  ];
}

export function createInitialModules(): ModuleState[] {
  return [
    {
      id: 'food',
      name: 'Food Production (APH Hydroponics)',
      nasaSystem: 'CHAPEA Bioregenerative Crop Bay',
      shortLabel: 'FOOD',
      hotkey: '3',
      zone: 'INDOOR',
      soulColor: 'PURPLE',
      x: 122,
      y: 196,
      w: 106,
      h: 124,
      health: 100,
      invulnerableTimer: 0,
      color: '#34d399',
      mode: 'NOMINAL',
      description:
        'Powers grow lights & water pumps for your 4 Planting Beds. Crops pause if power or water runs out, or if ECO dims the grow lamps.',
    },
    {
      id: 'shield',
      name: 'Radiation Shielding (RAD)',
      nasaSystem: 'Curiosity RAD Dosimeter + Water-Wall',
      shortLabel: 'RAD',
      hotkey: '4',
      zone: 'INDOOR',
      soulColor: 'GREEN',
      x: 170,
      y: 650,
      w: 155,
      h: 130,
      health: 100,
      invulnerableTimer: 0,
      color: '#818cf8',
      mode: 'NOMINAL',
      description:
        'Blocks Galactic Cosmic Rays (0.64 mSv/sol baseline) and Solar Particle Events. Must be set to MAX during X-class solar flares.',
    },
    {
      id: 'o2',
      name: 'Life Support (MOXIE O₂ ISRU)',
      nasaSystem: 'Perseverance 800°C Solid-Oxide Electrolysis',
      shortLabel: 'LIFE O₂',
      hotkey: '1',
      zone: 'OUTDOOR',
      soulColor: 'RED',
      x: 1080,
      y: 210,
      w: 165,
      h: 135,
      health: 100,
      invulnerableTimer: 0,
      color: '#22d3ee',
      mode: 'NOMINAL',
      description:
        'Splits Martian atmospheric CO₂ into breathable O₂ at 800°C. Crew of 4 breathes 3.36 kg O₂/sol. Susceptible to outdoor perchlorate dust & asteroid impacts.',
    },
    {
      id: 'power',
      name: 'Power Grid (ROSA + KRUSTY 10kWe)',
      nasaSystem: 'Roll-Out Solar Array + Kilopower Fission',
      shortLabel: 'POWER',
      hotkey: '2',
      zone: 'OUTDOOR',
      soulColor: 'BLUE',
      x: 1080,
      y: 645,
      w: 165,
      h: 135,
      health: 100,
      invulnerableTimer: 0,
      color: '#fbbf24',
      mode: 'NOMINAL',
      description:
        'Solar array generates power by day (blocked by dust Tau). Set to MAX to engage full 10 kWe KRUSTY nuclear fission during -90°C Night or Dust Storms.',
    },
  ];
}

export const HISTORICAL_MARS_EVENTS: Record<
  Exclude<HistoricalEventKind, 'NONE'>,
  HistoricalEvent
> = {
  DUST_STORM_2018: {
    kind: 'DUST_STORM_2018',
    title: 'Opportunity Sol 5111 Global Dust Storm (June 2018)',
    nasaFact:
      'In June 2018, a planet-encircling dust storm spiked atmospheric optical depth (Tau) to 10.8, blocking 99% of direct sunlight and rapidly chilling the habitat.',
    actionAdvice:
      'Dust storm: solar power down 80%. Set Power [2] to MAX and stay close to base.',
    tauOpacity: 10.8,
    radDoseMsv: 0.64,
  },
  SOLAR_FLARE_2024: {
    kind: 'SOLAR_FLARE_2024',
    title: 'Curiosity Sol 4190 X12 Solar Particle Event (May 20, 2024)',
    nasaFact:
      'Active region AR3664 unleashed an X12 flare toward Mars. Curiosity's RAD instrument measured 8,100 µGy (8.1 mSv) in 24 hours - about 30 chest X-rays.',
    actionAdvice:
      'Solar flare! Get inside, into a lava tube cave, or set Shield [4] to MAX.',
    tauOpacity: 0.6,
    radDoseMsv: 8.1,
  },
  PERCHLORATE_DUST_2022: {
    kind: 'PERCHLORATE_DUST_2022',
    title: 'InSight Electrostatic Perchlorate Dust Caking (May 2022)',
    nasaFact:
      'Fine 2-micron Martian dust rich in electrostatic perchlorates (ClO₄⁻) accumulated on InSight's solar arrays and Perseverance's MOXIE HEPA filters.',
    actionAdvice:
      'Dust is coating MOXIE and the solar panels. Repair them outside [E].',
    tauOpacity: 2.9,
    radDoseMsv: 0.64,
  },
  INSIGHT_MARSQUAKE_2021: {
    kind: 'INSIGHT_MARSQUAKE_2021',
    title: 'InSight Sol 1094 Bolide Seismic Wave (Dec 24, 2021)',
    nasaFact:
      'A meteoroid impact in Amazonis Planitia excavated a 150m crater and sent a Magnitude 4.0 seismic surface wave across Mars, recorded by InSight's SEIS seismometer.',
    actionAdvice:
      'Marsquake! MOXIE (oxygen) is badly damaged. Walk to it and repair [E].',
    tauOpacity: 0.7,
    radDoseMsv: 0.64,
  },
};

export const NOMINAL_EVENT: ActiveEventState = {
  kind: 'NONE',
  title: 'Nominal Jezero Crater Telemetry',
  nasaFact:
    'Curiosity RAD measures 0.64 mSv/sol baseline Galactic Cosmic Rays. Mars atmospheric pressure is 6.1 mbar (95% CO₂).',
  actionAdvice: 'Monitor day/night heat & power balance, and keep crop beds watered, lit, and harvested.',
  tauOpacity: 0.5,
  radDoseMsv: 0.64,
  timeRemaining: 0,
};

export const NEXT_MODE: Record<ModuleMode, ModuleMode> = {
  NOMINAL: 'OVERDRIVE',
  OVERDRIVE: 'ECO',
  ECO: 'NOMINAL',
};

export function getLmstFromElapsed(elapsedSec: number): LmstInfo {
  const progress = Math.max(0, Math.min(1, elapsedSec / SOL_DURATION_SECONDS));
  const totalHours = (6 + progress * 24) % 24;
  const hours = Math.floor(totalHours);
  const mins = Math.floor((totalHours % 1) * 60);
  const isNight = totalHours >= 18 || totalHours < 6;
  const sunFactor = isNight ? 0 : Math.sin(((totalHours - 6) / 12) * Math.PI);
  // Night temperature drops to around -90°C; midday warms to ~ -18°C
  const nightCurve = isNight
    ? Math.sin(((totalHours >= 18 ? totalHours - 18 : totalHours + 6) / 12) * Math.PI)
    : 0;
  const extTempC = isNight ? -74 - nightCurve * 18 : -54 + sunFactor * 36;

  return {
    formatted: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} LMST`,
    totalHours,
    isNight,
    sunFactor,
    extTempC: Math.round(extTempC),
    progress,
  };
}

export function isPointInsideHabitat(x: number, y: number): boolean {
  return (
    x >= HAB_BOUNDS.x &&
    x <= HAB_BOUNDS.x + HAB_BOUNDS.w &&
    y >= HAB_BOUNDS.y &&
    y <= HAB_BOUNDS.y + HAB_BOUNDS.h
  );
}

export function isPointInAirlock(x: number, y: number): boolean {
  return (
    x >= AIRLOCK_BOUNDS.x - 15 &&
    x <= AIRLOCK_BOUNDS.x + AIRLOCK_BOUNDS.w + 15 &&
    y >= AIRLOCK_BOUNDS.y &&
    y <= AIRLOCK_BOUNDS.y + AIRLOCK_BOUNDS.h
  );
}

export function collidesWithWall(x: number, y: number, r: number): boolean {
  for (const w of WALLS) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) {
      return true;
    }
  }
  for (const w of WORLD_WALLS) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) {
      return true;
    }
  }
  return false;
}
