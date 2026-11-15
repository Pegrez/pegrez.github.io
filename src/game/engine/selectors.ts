// Read-only views of the engine state: proximity checks, warnings and the HUD snapshot.
import {
  BED_INTERACTION_RADIUS,
  LAB_STATION,
  LAB_STATION_RADIUS,
  CHALLENGES,
  HP_MAX,
  SUIT_STATION,
  SUIT_STATION_RADIUS,
  ROVER_BOARD_RADIUS,
  getZoneAt,
  isPointInCave,
  CAREER_DOSE_LIMIT_MSV,
  DEPOSIT_INTERACTION_RADIUS,
  JURY_RIG_HEALTH,
  MAJOR_REPAIR_THRESHOLD,
  PRINT_SCRAP_COST,
  INSULATION_MAX_LEVEL,
  INSULATION_UPGRADE_COST,
  INTERACTION_RADIUS,
  MISSION_MONTHS,
  TOTAL_MISSION_MONTHS,
  getLmstFromElapsed,
  NPC_INTERACT_RADIUS,
  PANEL_FIELD,
  PANEL_INTERACT_RADIUS,
  SOL_DURATION_SECONDS,
  TOTAL_SOLS,
  seasonForMonth,
} from '../constants';
import { nearestNpc } from './npcs';
import { missionAt } from '../missions';
import { pickFact } from '../facts';
import {
  EngineState,
  HudSnapshot,
  FieldSite,
  IceDeposit,
  ModuleState,
  PlantBed,
} from '../types';


// Radiation exposure factor: EVA suit ≈ full surface dose; habitat water-wall cuts it.
export function getDoseRateMsvPerSol(eng: EngineState): number {
  const base = eng.activeEvent.radDoseMsv;
  const shieldMod = eng.modules.find((m) => m.id === 'shield');
  const shieldEff = shieldMod ? shieldMod.health / 100 : 1;
  const shieldPct = eng.resources.shield / 100;
  const modeMult = shieldMod?.mode === 'OVERDRIVE' ? 0.7 : shieldMod?.mode === 'ECO' ? 1.25 : 1;
  if (eng.player.inEvaSuit && isPointInCave(eng.player.x, eng.player.y)) {
    return base * 0.08; // tens of metres of basalt overhead
  }
  const exposure = eng.player.inEvaSuit
    ? eng.player.inRover
      ? 0.6
      : 1.0
    : Math.max(0.12, (0.62 - 0.4 * shieldPct * shieldEff) * modeMult);
  return base * exposure;
}

// Problems that need attention, each with a short "how to fix it". Most urgent first.
export function buildWarnings(eng: EngineState): HudSnapshot['warnings'] {
  const r = eng.resources;
  const out: HudSnapshot['warnings'] = [];
  const add = (cond: boolean, critical: boolean, title: string, fix: string) => {
    if (cond) out.push({ title, fix, level: critical ? 'critical' : 'warning' });
  };
  const outside = eng.player.inEvaSuit && !eng.player.inRover;
  add(r.o2 < 35, r.o2 < 15, `Oxygen low (${Math.round(r.o2)}%)`, 'Press [1] until MOXIE says MAX, then walk to MOXIE outside and press [E] to repair it.');
  add(r.hp < HP_MAX * 0.4, r.hp < HP_MAX * 0.2, `Crew health low (${Math.round(r.hp)}/${HP_MAX})`, 'Go inside and fix whatever is red. Health refills by itself when nothing is wrong.');
  add(outside && eng.cold > 60, eng.cold > 85, `Freezing (${Math.round(eng.cold)})`, 'Walk back through the airlock, or get in the rover [V], to warm up.');
  add(r.power < 30, r.power < 12, `Battery low (${Math.round(r.power)}%)`, 'Press [2] to set the reactor to MAX. Turn the fuel plant off with [G] and set the heater [5] to ECO.');
  add(r.heat < 40 || eng.pipesFrozen, r.heat < 25, eng.pipesFrozen ? 'Pipes frozen!' : `Habitat cold (${Math.round(r.heat)}%)`, 'Press [5] to set the heater to MAX. With 2 parts, press [U] to insulate.');
  add(r.food < 30, r.food < 12, `Food low (${Math.round(r.food)}%)`, 'Go to the plant beds (top left inside). [E] harvests ripe plants or plants seeds. Press [3] for MAX grow lights.');
  add(r.water < 25, r.water < 10, `Water low (${Math.round(r.water)}%)`, 'Go outside, press [R] to scan, then [E] on ice to sample and drill. Turn the fuel plant off with [G] to save water.');
  add(r.shield < 30, r.shield < 12, `Radiation shield low (${Math.round(r.shield)}%)`, 'Press [4] to set the shield to MAX, and repair the RAD module (bottom left inside) with [E].');
  add(eng.player.inEvaSuit && eng.suit < 30, eng.suit < 10, `Suit damaged (${Math.round(eng.suit)}%)`, 'Go inside and press [E] at the suit station next to the airlock.');
  add(eng.player.inRover && eng.rover.battery < 20, eng.rover.battery < 5, `Rover battery ${Math.round(eng.rover.battery)}%`, 'Drive back to the Home Base zone. The rover recharges there.');
  add(!eng.player.inEvaSuit && eng.suitDust > 15, eng.suitDust > 50, `Dusty suit inside (${Math.round(eng.suitDust)}%)`, 'Toxic dust is spreading. Walk to the suit station by the airlock and press [E] to clean it.');
  add(eng.habDust > 30, eng.habDust > 60, `Toxic dust in the habitat (${Math.round(eng.habDust)}%)`, 'Clean your suit at the suit station [E] every time you come in. Keep MOXIE healthy: its filters clear the air.');
  add(eng.panelDust > 55, eng.panelDust > 80, `Solar panels dusty (${Math.round(eng.panelDust)}%)`, 'Walk to the solar array southeast of the yard and press [E] to brush the panels.');
  const damaged = eng.modules.filter((m) => m.health < 40);
  add(damaged.length > 0, false, `${damaged.map((m) => m.shortLabel).join(', ')} badly damaged`, 'Walk to the module and press [E] to repair it. With a spare part it goes back to 100%.');
  out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1));
  return out.slice(0, 3);
}

export function getNearbyDeposit(eng: EngineState): IceDeposit | null {
  let best: IceDeposit | null = null;
  let bestD = DEPOSIT_INTERACTION_RADIUS;
  for (const d of eng.iceDeposits) {
    if (d.scanLevel === 0 || d.amountKg <= 0) continue;
    const dist = Math.hypot(eng.player.x - d.x, eng.player.y - d.y);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

// Sol number (1–178): each visible day/night is a time-lapse of about 30 sols.
export function currentSol(eng: EngineState): number {
  const months = eng.solNumber - 1 + Math.min(1, eng.elapsedSolSec / SOL_DURATION_SECONDS);
  return Math.min(TOTAL_SOLS, Math.floor((months / TOTAL_MISSION_MONTHS) * TOTAL_SOLS) + 1);
}

export function isNearPanels(eng: EngineState): boolean {
  if (!eng.player.inEvaSuit) return false;
  const cx = PANEL_FIELD.x + PANEL_FIELD.w / 2;
  const cy = PANEL_FIELD.y + PANEL_FIELD.h / 2;
  return Math.hypot(eng.player.x - cx, eng.player.y - cy) < PANEL_INTERACT_RADIUS;
}

export function isNearLab(eng: EngineState): boolean {
  return (
    !eng.player.inEvaSuit &&
    Math.hypot(eng.player.x - LAB_STATION.x, eng.player.y - LAB_STATION.y) < LAB_STATION_RADIUS
  );
}

export function isNearSuitStation(eng: EngineState): boolean {
  return (
    !eng.player.inEvaSuit &&
    Math.hypot(eng.player.x - SUIT_STATION.x, eng.player.y - SUIT_STATION.y) < SUIT_STATION_RADIUS
  );
}

export function getNearbySite(eng: EngineState): FieldSite | null {
  let best: FieldSite | null = null;
  let bestD = 70;
  for (const f of eng.fieldSites) {
    if (f.collected) continue;
    const d = Math.hypot(eng.player.x - f.x, eng.player.y - f.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function getNearbyTarget(eng: EngineState): {
  nearbyBed: PlantBed | null;
  nearbyModule: ModuleState | null;
} {
  let nearbyBed: PlantBed | null = null;
  let bestBedDist = BED_INTERACTION_RADIUS;
  for (const bed of eng.beds) {
    const d = Math.hypot(eng.player.x - (bed.x + bed.w / 2), eng.player.y - (bed.y + bed.h / 2));
    if (d < bestBedDist) {
      bestBedDist = d;
      nearbyBed = bed;
    }
  }

  let nearbyModule: ModuleState | null = null;
  let bestModDist = INTERACTION_RADIUS;
  for (const m of eng.modules) {
    const d = Math.hypot(eng.player.x - (m.x + m.w / 2), eng.player.y - (m.y + m.h / 2));
    if (d < bestModDist) {
      bestModDist = d;
      nearbyModule = m;
    }
  }

  if (nearbyBed) {
    return { nearbyBed, nearbyModule: null };
  }
  return { nearbyBed: null, nearbyModule };
}

export function buildHudSnapshot(eng: EngineState): HudSnapshot {
  const lmst = getLmstFromElapsed(eng.elapsedSolSec);
  const { nearbyBed, nearbyModule } = getNearbyTarget(eng);
  const baseTempC = Math.round(-18 + (eng.resources.heat / 100) * 40);
  const monthIdx = Math.max(0, Math.min(MISSION_MONTHS.length - 1, eng.solNumber - 1));
  const currentMonth = MISSION_MONTHS[monthIdx];

  let advisorTip =
    '';
  let advisorUrgency: HudSnapshot['advisorUrgency'] = 'nominal';

  const damagedMod = eng.modules.find((m) => m.health < 78);
  const ripeBed = eng.beds.find((b) => b.stage === 'RIPE');
  const unwashedBed = eng.beds.find(
    (b) =>
      b.stage !== 'EMPTY' &&
      b.stage !== 'WILTED' &&
      b.medium === 'MARS_SOIL' &&
      !b.perchlorateWashed
  );

  const monthsLeft = TOTAL_MISSION_MONTHS - eng.solNumber;
  const fuelBehind = eng.resources.fuel < (eng.solNumber / TOTAL_MISSION_MONTHS) * 80 - 10;

  if (eng.player.inEvaSuit && eng.cold > 70) {
    advisorTip = 'Freezing! Get back inside (or into the rover) to warm up.';
    advisorUrgency = 'critical';
  } else if (eng.player.inEvaSuit && eng.suit < 25) {
    advisorTip = 'Suit damaged: it leaks O₂ and lets the cold in. Repair it at the suit station by the airlock.';
    advisorUrgency = 'warning';
  } else if (eng.doseMsv > CAREER_DOSE_LIMIT_MSV * 0.8) {
    advisorTip = `RADIATION: ${Math.round(eng.doseMsv)} / ${CAREER_DOSE_LIMIT_MSV} mSv career limit! Minimize EVAs and keep RAD Shield [4] repaired.`;
    advisorUrgency = 'critical';
  } else if (eng.resources.hp <= HP_MAX * 0.38) {
    advisorTip =
      'CRITICAL SUIT / BIO ALERT! Check Heat, O₂, Radiation, or Perchlorate poisoning immediately!';
    advisorUrgency = 'critical';
  } else if (eng.pipesFrozen) {
    advisorTip =
      'PIPES FROZEN (Heat < 30%)! Water flow & crop growth halted! Raise Heater [5] to MAX and boost Power [2] to MAX!';
    advisorUrgency = 'critical';
  } else if (eng.sickTimer > 0) {
    advisorTip =
      'PERCHLORATE POISONING! Unwashed Martian-soil food is draining health. Always press [F] to wash soil crops before eating!';
    advisorUrgency = 'warning';
  } else if (
    eng.activeEvent.kind === 'SOLAR_FLARE_2024' &&
    eng.player.inEvaSuit &&
    !isPointInCave(eng.player.x, eng.player.y) &&
    getZoneAt(eng.player.x, eng.player.y).id === 'LAVA_TUBES'
  ) {
    advisorTip = 'SOLAR FLARE! You are near the Lava Tube Caves: walk into a dark cave mouth to block ~90% of the radiation.';
    advisorUrgency = 'critical';
  } else if (eng.activeEvent.kind === 'SOLAR_FLARE_2024' && eng.player.inEvaSuit && !isPointInCave(eng.player.x, eng.player.y)) {
    advisorTip =
      'SOLAR PARTICLE EVENT (8.1 mSv/sol)! Walk LEFT through the Airlock into the Habitat and set RAD Shield [4] to MAX!';
    advisorUrgency = 'critical';
  } else if (lmst.isNight && eng.resources.heat < 52) {
    advisorTip =
      'Martian Night (-90°C): Base Heat is dropping fast! Press [5] to boost Heater & [2] for KRUSTY Nuclear, or [U] to Insulate.';
    advisorUrgency = 'warning';
  } else if (eng.resources.water < 25 && eng.iceKg <= 0) {
    advisorTip =
      'WATER LOW! No free water on Mars: suit up, scan for buried ice with [R], core-sample [E], then drill [E] and bring it home.';
    advisorUrgency = 'warning';
  } else if (fuelBehind && monthsLeft <= 6) {
    advisorTip = `Ascent fuel only ${Math.round(eng.resources.fuel)}% with ${monthsLeft} months left! Keep the Sabatier plant [G] ON and feed it water from mined ice.`;
    advisorUrgency = 'warning';
  } else if (ripeBed) {
    advisorTip = `Bed ${ripeBed.id} is RIPE! Walk to the Hydroponics Bay and press [E] to harvest before it wilts!`;
    advisorUrgency = 'info';
  } else if (unwashedBed) {
    advisorTip = `Bed ${unwashedBed.id} uses Martian soil with toxic perchlorates! Walk up and press [F] to wash it before harvesting.`;
    advisorUrgency = 'info';
  } else if (damagedMod) {
    advisorTip = `${damagedMod.name} efficiency is down to ${Math.round(
      damagedMod.health
    )}% (${damagedMod.zone}). ${
      damagedMod.health < MAJOR_REPAIR_THRESHOLD
        ? `Major failure  -  a full repair uses ${1} Part (or only patches to ${JURY_RIG_HEALTH}%).`
        : 'Walk to it and press [E] for 4 repair tasks.'
    }`;
    advisorUrgency = damagedMod.health < MAJOR_REPAIR_THRESHOLD ? 'warning' : 'info';
  } else if (eng.player.inRover && eng.rover.battery < 20) {
    advisorTip = `Rover battery ${Math.round(eng.rover.battery)}%! Drive back to the Home Base zone to recharge.`;
    advisorUrgency = 'warning';
  } else if (eng.scansCompleted === 0 && eng.solNumber <= 3) {
    advisorTip =
      'Prospect for water: walk out the Airlock and press [R] to sweep ground-penetrating radar for buried ice.';
    advisorUrgency = 'info';
  } else if (eng.solNumber >= 3 && eng.samplesCollected === 0 && !eng.player.inRover) {
    advisorTip =
      'Explore! Walk south out of the yard to the Ancient River Delta and press [E] on rock outcrops to collect samples. Board the rover [V] for far zones.';
    advisorUrgency = 'info';
  } else if (eng.scrap >= PRINT_SCRAP_COST && eng.parts < 2 && !eng.player.inEvaSuit) {
    advisorTip = `You have ${eng.scrap} kg of recycled packaging. Press [P] inside the habitat to 3D-print a spare part.`;
    advisorUrgency = 'info';
  } else if (eng.insulationLevel < INSULATION_MAX_LEVEL && eng.parts >= INSULATION_UPGRADE_COST) {
    advisorTip = `You have ${eng.parts} Parts! Press [U] (or click Insulate on top HUD) to upgrade Base Insulation to Lv.${
      eng.insulationLevel + 1
    }.`;
    advisorUrgency = 'info';
  }

  return {
    solNumber: eng.solNumber,
    currentMonth,
    lmst,
    resources: { ...eng.resources },
    modules: eng.modules.map((m) => ({ ...m })),
    netPowerKw: eng.netPowerKw,
    genPowerKw: eng.genPowerKw,
    loadPowerKw: eng.loadPowerKw,
    heaterMode: eng.heaterMode,
    heaterKw: eng.heaterKw,
    insulationLevel: eng.insulationLevel,
    insulationCost: INSULATION_UPGRADE_COST,
    parts: eng.parts,
    seeds: eng.seeds,
    sickTimer: eng.sickTimer,
    pipesFrozen: eng.pipesFrozen,
    cropsPausedReason: eng.cropsPausedReason,
    baseTempC,
    beds: eng.beds.map((b) => ({ ...b })),
    nearbyBed: nearbyBed ? { ...nearbyBed } : null,
    inEvaSuit: eng.player.inEvaSuit,
    nearbyModule: nearbyModule ? { ...nearbyModule } : null,
    activeEvent: { ...eng.activeEvent },
    repairsCompleted: eng.repairsCompleted,
    repairFailures: eng.repairFailures,
    evasCompleted: eng.evasCompleted,
    cropsHarvested: eng.cropsHarvested,
    causeOfDeath: eng.causeOfDeath,
    nasaDebriefTip: eng.nasaDebriefTip,
    scienceLog: eng.scienceLog.slice(0, 6),
    advisorTip,
    advisorUrgency,
    hpMax: HP_MAX,
    unlocks: [...eng.unlocks],
    crew: eng.crew.map((c) => ({ ...c })),
    activeCrew: eng.activeCrew,
    medKits: eng.medKits,
    decision: eng.pendingDecision,
    earthMessage: eng.earthMessage,
    labProgress: eng.labProgress,
    labSample: eng.labSample,
    samplesStored: eng.sampleQueue.length,
    science: eng.science,
    discoveries: eng.discoveries,
    nearLab: isNearLab(eng),
    nearNpc: (() => {
      const n = nearestNpc(eng, NPC_INTERACT_RADIUS);
      if (!n) return null;
      const c = eng.crew[n.crewIndex];
      return { crewIndex: n.crewIndex, name: c.name, role: c.role, following: eng.followerCrew === n.crewIndex };
    })(),
    followerCrew: eng.followerCrew,
    suitDust: eng.suitDust,
    habDust: eng.habDust,
    panelDust: eng.panelDust,
    nearPanels: isNearPanels(eng),
    solarEff: 1 - (eng.panelDust / 100) * 0.75,
    sol: currentSol(eng),
    totalSols: TOTAL_SOLS,
    season: seasonForMonth(eng.solNumber).name,
    stormSeason: seasonForMonth(eng.solNumber).storms,
    dialogueLine: eng.dialogueLine ? { who: eng.dialogueLine.who, text: eng.dialogueLine.text } : null,
    difficulty: eng.difficulty,
    challenges: CHALLENGES.slice(0, eng.difficulty).map(({ name, desc }) => ({ name, desc })),
    nextChallenge:
      eng.difficulty < CHALLENGES.length
        ? { name: CHALLENGES[eng.difficulty].name, desc: CHALLENGES[eng.difficulty].desc }
        : { name: 'Harsher Mars', desc: 'Everything drains another 10% faster.' },
    warnings: buildWarnings(eng),
    iceKg: eng.iceKg,
    cold: eng.cold,
    suit: eng.suit,
    nearSuitStation: isNearSuitStation(eng),
    mission: (() => {
      const i = Math.min(eng.missionIndex, eng.missionPlan.length - 1);
      const m = missionAt(eng, i);
      return {
        index: i + 1,
        total: eng.missionPlan.length,
        title: m.title,
        desc: m.desc,
        optional: Boolean(m.optional) && eng.missionIndex < eng.missionPlan.length,
        done: eng.missionIndex >= eng.missionPlan.length,
      };
    })(),
    missionDistanceM: eng.missionTarget
      ? Math.round(
          Math.hypot(eng.missionTarget.x - eng.player.x, eng.missionTarget.y - eng.player.y) / 10
        )
      : null,
    fact: pickFact(eng),
    latestLog: eng.scienceLog[0] ?? null,
    nearbySite: (() => {
      const f = eng.player.inEvaSuit ? getNearbySite(eng) : null;
      return f ? { ...f } : null;
    })(),
    nearRover:
      eng.player.inRover ||
      (eng.player.inEvaSuit &&
        Math.hypot(eng.player.x - eng.rover.x, eng.player.y - eng.rover.y) < ROVER_BOARD_RADIUS),
    inRover: eng.player.inRover,
    roverBattery: eng.rover.battery,
    currentZone: getZoneAt(eng.player.x, eng.player.y),
    inCave: eng.player.inEvaSuit && isPointInCave(eng.player.x, eng.player.y),
    samplesCollected: eng.samplesCollected,
    mineralsCollected: eng.mineralsCollected,
    meteoritesCollected: eng.meteoritesCollected,
    discoveredZones: [...eng.discoveredZones],
    nearbyDeposit: (() => {
      const d = getNearbyDeposit(eng);
      return d ? { ...d } : null;
    })(),
    drillingId: eng.drillingId,
    scanCooldown: eng.scanCooldown,
    scansCompleted: eng.scansCompleted,
    iceMinedKg: eng.iceMinedKg,
    fuelPlantOn: eng.fuelPlantOn,
    isruLoadKw: eng.isruLoadKw,
    scrap: eng.scrap,
    printCooldown: eng.printCooldown,
    partsPrinted: eng.partsPrinted,
    upgradedModules: [...eng.upgradedModules],
    preventiveDone: eng.preventiveDone,
    doseMsv: eng.doseMsv,
    doseRateMsvSol: getDoseRateMsvPerSol(eng),
  };
}


