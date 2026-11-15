export type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type ModuleId = 'o2' | 'power' | 'food' | 'shield';
export type ModuleMode = 'ECO' | 'NOMINAL' | 'OVERDRIVE';
export type ModuleZone = 'INDOOR' | 'OUTDOOR';
export type SoulColor = 'RED' | 'BLUE' | 'GREEN' | 'PURPLE';

export type HistoricalEventKind =
  | 'NONE'
  | 'DUST_STORM_2018'
  | 'SOLAR_FLARE_2024'
  | 'PERCHLORATE_DUST_2022'
  | 'INSIGHT_MARSQUAKE_2021';

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ModuleState {
  id: ModuleId;
  name: string;
  nasaSystem: string;
  shortLabel: string;
  hotkey: string;
  zone: ModuleZone;
  soulColor: SoulColor;
  x: number;
  y: number;
  w: number;
  h: number;
  health: number;
  invulnerableTimer: number;
  color: string;
  mode: ModuleMode;
  description: string;
}

export interface MissionMonthInfo {
  month: number;
  title: string;
  summary: string;
}

export interface HistoricalEvent {
  kind: HistoricalEventKind;
  title: string;
  nasaFact: string;
  actionAdvice: string;
  tauOpacity: number;
  radDoseMsv: number;
  timeRemaining?: number;
}

export interface ActiveEventState extends HistoricalEvent {
  timeRemaining: number;
}

export interface Resources {
  o2: number;
  power: number;
  food: number;
  shield: number;
  heat: number;
  water: number;
  hp: number;
  fuel: number; // CH₄/LOX ascent propellant made by Sabatier ISRU (0-100%)
}

// ============================================================================
// SUBSURFACE WATER ICE (NASA SWIM project / SHARAD radar / Phoenix 2008)
// ============================================================================
export type IceQuality = 'PURE' | 'DIRTY' | 'PERCHLORATE';
export type IceDepth = 'SHALLOW' | 'DEEP';

export interface IceDeposit {
  id: number;
  x: number;
  y: number;
  r: number;
  depth: IceDepth;
  quality: IceQuality;
  amountKg: number; // remaining ice (game kg)
  maxKg: number;
  scanLevel: 0 | 1 | 2; // 0 hidden · 1 radar ping · 2 core-sampled (depth & quality known)
  rigInstalled: boolean; // deep deposits need a drill rig (1 part)
}

export type CropStage = 'EMPTY' | 'SPROUT' | 'LEAFY' | 'RIPE' | 'WILTED';
export type PlantingMedium = 'WATER' | 'MARS_SOIL';

export interface PlantBed {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  stage: CropStage;
  medium: PlantingMedium;
  growth: number;
  ripeTimer: number;
  perchlorateWashed: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  radius: number;
  speed: number;
  facingAngle: number;
  moving: boolean;
  inEvaSuit: boolean;
  inRover: boolean;
  vx: number; // current velocity (eased toward the input direction)
  vy: number;
}

// ============================================================================
// EXPLORATION WORLD (3x3 zones around the home base)
// ============================================================================
export type ZoneId =
  | 'BASE'
  | 'ICE_PLAINS'
  | 'CRATER_FIELD'
  | 'RIVER_DELTA'
  | 'LAVA_TUBES'
  | 'POLAR_CAP'
  | 'VOLCANO'
  | 'DUST_BASIN'
  | 'CARGO_ZONE';

export interface ZoneInfo {
  id: ZoneId;
  name: string;
  col: number; // -1..1
  row: number; // -1..1
  roverOnly: boolean;
  tint: string; // base regolith colour
  blurb: string;
}

export type FieldSiteKind = 'SAMPLE' | 'MINERAL' | 'METEORITE';

export interface FieldSite {
  id: number;
  x: number;
  y: number;
  kind: FieldSiteKind;
  label: string;
  collected: boolean;
}

export interface CaveShelter {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoverState {
  x: number;
  y: number;
  facingAngle: number;
  battery: number; // 0-100
}

export interface Asteroid {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetId: ModuleId;
  progress: number;
  speed: number;
  damage: number;
}

export interface ImpactSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type SupplyCrateKind = ModuleId | 'water' | 'parts' | 'seeds';

export interface SupplyCrate {
  id: number;
  x: number;
  y: number;
  radius: number;
  kind: SupplyCrateKind;
  label: string;
  color: string;
}

export interface DustParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LogEntry {
  time: string;
  text: string;
  tone: 'info' | 'warning' | 'success';
}

export interface LmstInfo {
  formatted: string;
  totalHours: number;
  isNight: boolean;
  sunFactor: number;
  extTempC: number;
  progress: number;
}

// ============================================================================
// CREW, DECISIONS, EARTH COMMS
// ============================================================================
export type CrewRole = 'ENGINEER' | 'BOTANIST' | 'GEOLOGIST' | 'DOCTOR';

export interface CrewMember {
  id: number;
  name: string;
  role: CrewRole;
  hp: number; // 0-100
  morale: number; // 0-100
  down: boolean; // incapacitated (in the medbay)
}

export interface DecisionView {
  id: string;
  title: string;
  text: string;
  options: Array<{ label: string; hint: string }>;
}

export interface EarthMessage {
  deliverAt: number; // totalElapsedSec when it arrives
  sentLabel: string; // LMST when it was sent
  text: string;
  condKey: string | null; // if set and no longer true on arrival, the advice is outdated
  moraleBoost: number;
}

export interface ShownEarthMessage {
  text: string;
  sentLabel: string;
  outdated: boolean;
  until: number;
}

export interface Footprint {
  x: number;
  y: number;
  a: number;
  life: number;
}

export interface TrailPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export type NpcState = 'WALK' | 'IDLE' | 'SLEEP' | 'FOLLOW' | 'IN_ROVER';

// A crew member who isn't being controlled: wanders the habitat, sleeps at night, or follows you.
export interface CrewNpc {
  crewIndex: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  via: { x: number; y: number } | null; // door between habitat wings
  facing: number;
  state: NpcState;
  timer: number;
  activity: string;
  walkPhase: number;
}

export interface EngineState {
  difficulty: number; // 0 = first expedition; +1 each new expedition
  missionPlan: string[]; // mission ids for this expedition (order and extras change with difficulty)
  // --- Crew in the habitat ---
  npcs: CrewNpc[];
  followerCrew: number | null; // crew index following you outside (EVA buddy)
  breadcrumbs: Array<{ x: number; y: number }>;
  soloWarned: boolean;
  releaseBuddy: boolean; // set when you come back inside; the buddy goes back to idling
  // --- Dust & solar ---
  suitDust: number; // 0-100 dust caked on the suit (outside)
  habDust: number; // 0-100 perchlorate dust tracked into the habitat
  panelDust: number; // 0-100 dust on the solar array
  meteorsLeft: number;
  panelsCleaned: number;
  nextFaultTimer: number;
  unlocks: string[];
  // --- Crew ---
  crew: CrewMember[];
  activeCrew: number; // index into crew: who is walking around
  medKits: number;
  // --- Decisions & comms ---
  pendingDecision: DecisionView | null;
  usedDecisions: string[];
  nextDecisionTimer: number;
  earthQueue: EarthMessage[];
  earthMessage: ShownEarthMessage | null;
  nextEarthTimer: number;
  // --- Lab & science ---
  sampleQueue: string[]; // collected, not yet analyzed
  labProgress: number | null; // seconds left
  labSample: string | null;
  science: number;
  scienceRewarded: number;
  discoveries: number;
  samplesAnalyzed: number;
  // --- Crew dialogue (never pauses the game) ---
  dialogueQueue: Array<{ who: CrewRole; text: string }>;
  dialogueLine: { who: CrewRole; text: string; until: number } | null;
  usedConversations: string[];
  chatterTimer: number;
  shabbatTimer: number;
  dialogueSaid: string[]; // one-shot triggers already used this run (e.g. LOW_FOOD)
  // --- Visual effects ---
  footprints: Footprint[];
  trail: TrailPuff[];
  stepAccum: number;
  walkPhase: number;
  hopper: { q: IceQuality; kg: number };
  solNumber: number; // 1..12 matching Month 1..12 (24 s each)
  elapsedSolSec: number;
  totalElapsedSec: number;
  nextEventTimer: number;
  nextAsteroidTimer: number;
  nextSupplyTimer: number;
  crateSeq: number;
  asteroidSeq: number;
  screenShake: number;
  repairsCompleted: number;
  repairFailures: number;
  evasCompleted: number;
  cropsHarvested: number;
  wasOutdoor: boolean;
  causeOfDeath: string;
  nasaDebriefTip: string;
  netPowerKw: number;
  genPowerKw: number;
  loadPowerKw: number;
  heaterMode: ModuleMode;
  heaterKw: number;
  insulationLevel: number;
  parts: number;
  seeds: number;
  sickTimer: number;
  pipesFrozen: boolean;
  cropsPausedReason: string | null;
  resources: Resources;
  beds: PlantBed[];
  player: PlayerState;
  modules: ModuleState[];
  asteroids: Asteroid[];
  sparks: ImpactSpark[];
  crates: SupplyCrate[];
  particles: DustParticle[];
  floatingTexts: FloatingText[];
  activeEvent: ActiveEventState;
  scienceLog: LogEntry[];
  // --- Missions ---
  missionIndex: number;
  missionTarget: { x: number; y: number } | null;
  seedsPlanted: number;
  roverBoarded: boolean;
  // --- Crew survival extras ---
  cold: number; // 0-100 body chill while outside
  suit: number; // 0-100 EVA suit integrity
  suitRepairs: number;
  frostFlash: number;
  quakeShake: number;
  // --- Exploration world ---
  rover: RoverState;
  fieldSites: FieldSite[];
  discoveredZones: ZoneId[];
  samplesCollected: number;
  mineralsCollected: number;
  meteoritesCollected: number;
  gateWarnTimer: number;
  // --- Ice prospecting & ISRU ---
  iceDeposits: IceDeposit[];
  iceKg: number;
  drillingId: number | null;
  scanCooldown: number;
  scansCompleted: number;
  iceMinedKg: number;
  fuelPlantOn: boolean;
  isruLoadKw: number;
  // --- Maintenance & fabrication ---
  scrap: number; // recycled food-packaging polymer for the 3D printer
  printCooldown: number;
  partsPrinted: number;
  moduleFailures: Record<ModuleId, number>;
  upgradedModules: ModuleId[];
  failLatch: Record<ModuleId, boolean>;
  preventiveDone: number;
  // --- Crew health realism ---
  doseMsv: number; // cumulative effective radiation dose (NASA career limit 600 mSv)
}

export interface HudSnapshot {
  solNumber: number;
  currentMonth: MissionMonthInfo;
  lmst: LmstInfo;
  resources: Resources;
  modules: ModuleState[];
  netPowerKw: number;
  genPowerKw: number;
  loadPowerKw: number;
  heaterMode: ModuleMode;
  heaterKw: number;
  insulationLevel: number;
  insulationCost: number;
  parts: number;
  seeds: number;
  sickTimer: number;
  pipesFrozen: boolean;
  cropsPausedReason: string | null;
  baseTempC: number;
  beds: PlantBed[];
  nearbyBed: PlantBed | null;
  inEvaSuit: boolean;
  nearbyModule: ModuleState | null;
  activeEvent: ActiveEventState;
  repairsCompleted: number;
  repairFailures: number;
  evasCompleted: number;
  cropsHarvested: number;
  causeOfDeath: string;
  nasaDebriefTip: string;
  scienceLog: LogEntry[];
  advisorTip: string;
  advisorUrgency: 'nominal' | 'info' | 'warning' | 'critical';
  iceKg: number;
  cold: number;
  suit: number;
  nearSuitStation: boolean;
  mission: { index: number; total: number; title: string; desc: string; optional: boolean; done: boolean };
  missionDistanceM: number | null;
  fact: { title: string; text: string };
  latestLog: LogEntry | null;
  warnings: Array<{ title: string; fix: string; level: 'warning' | 'critical' }>;
  hpMax: number;
  difficulty: number;
  unlocks: string[];
  crew: CrewMember[];
  activeCrew: number;
  medKits: number;
  decision: DecisionView | null;
  earthMessage: ShownEarthMessage | null;
  labProgress: number | null;
  labSample: string | null;
  samplesStored: number;
  science: number;
  discoveries: number;
  nearLab: boolean;
  nearNpc: { crewIndex: number; name: string; role: CrewRole; following: boolean } | null;
  followerCrew: number | null;
  suitDust: number;
  habDust: number;
  panelDust: number;
  nearPanels: boolean;
  solarEff: number;
  sol: number;
  totalSols: number;
  season: string;
  stormSeason: boolean;
  dialogueLine: { who: CrewRole; text: string } | null;
  challenges: Array<{ name: string; desc: string }>;
  nextChallenge: { name: string; desc: string } | null;
  nearbyDeposit: IceDeposit | null;
  nearbySite: FieldSite | null;
  nearRover: boolean;
  inRover: boolean;
  roverBattery: number;
  currentZone: ZoneInfo;
  inCave: boolean;
  samplesCollected: number;
  mineralsCollected: number;
  meteoritesCollected: number;
  discoveredZones: ZoneId[];
  drillingId: number | null;
  scanCooldown: number;
  scansCompleted: number;
  iceMinedKg: number;
  fuelPlantOn: boolean;
  isruLoadKw: number;
  scrap: number;
  printCooldown: number;
  partsPrinted: number;
  upgradedModules: ModuleId[];
  preventiveDone: number;
  doseMsv: number;
  doseRateMsvSol: number;
}

// ============================================================================
// AREA-RELATED 4x4 RANDOMIZED MINIGAME TYPES
// ============================================================================

export type CardinalDir = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

export type SubMinigameId =
  // Life Support (o2)  -  4 minigames
  | 'o2_soxe_plasma'
  | 'o2_pressure_vents'
  | 'o2_bubble_capture'
  | 'o2_hepa_scrub'
  // Power (power)  -  4 minigames
  | 'power_arc_hurdles'
  | 'power_fission_sparks'
  | 'power_solar_wipe'
  | 'power_bus_nodes'
  // Radiation Shielding (shield)  -  4 minigames
  | 'shield_cosmic_rays'
  | 'shield_solar_protons'
  | 'shield_sram_scrub'
  | 'shield_water_seals'
  // Food Production (food)  -  4 minigames
  | 'food_harvest_shears'
  | 'food_perchlorate_rinse'
  | 'food_grow_lamps'
  | 'food_nutrient_mix';

export type SubMinigameMovement = 'RED_8WAY' | 'BLUE_GRAVITY' | 'GREEN_SHIELD' | 'PURPLE_RAILS';

export interface SubMinigameSpec {
  id: SubMinigameId;
  title: string;
  hint: string;
  movement: SubMinigameMovement;
  goalType: 'SURVIVE' | 'TARGETS';
  targetCount: number;
  duration: number;
}

export interface SoulTargetNode {
  x: number;
  y: number;
  r: number;
  vy: number;
  color: string;
  label: string;
  collected: boolean;
}

export interface SoulBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind: 'orb' | 'blade' | 'droplet';
}

export interface SoulRectHazard {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  color: string;
  label?: string;
}

export interface SoulLaserHazard {
  axis: 'h' | 'v';
  pos: number;
  warningTimer: number;
  warningDuration: number;
  activeTimer: number;
  width: number;
  color: string;
}

export interface GreenRayHazard {
  lane: CardinalDir;
  dist: number;
  speed: number;
  reversed: boolean;
  flipped: boolean;
  color: string;
}

export interface SoulBlockSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface SoulMinigameState {
  active: boolean;
  moduleId: ModuleId;
  moduleName: string;
  nasaSystem: string;
  soulColor: SoulColor;
  queue: SubMinigameSpec[]; // 4 randomized minigames for this area
  stageIndex: number; // 0..3
  currentSpec: SubMinigameSpec;
  duration: number;
  timeRemaining: number;
  targetsCollected: number;
  targetsRequired: number;
  targets: SoulTargetNode[];
  px: number;
  py: number;
  vx: number;
  vy: number;
  grounded: boolean;
  jumpHeldPrev: boolean;
  shieldDir: CardinalDir;
  railIndex: number;
  railCooldown: number;
  patternTimer: number;
  subPatternTimer: number;
  laserTimer: number;
  waveIndex: number;
  bullets: SoulBullet[];
  rects: SoulRectHazard[];
  lasers: SoulLaserHazard[];
  greenRays: GreenRayHazard[];
  sparks: SoulBlockSpark[];
}
