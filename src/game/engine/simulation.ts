// The per-frame simulation: movement, resources, events, crew, missions and effects.
import { sound } from '../audio';
import {
  CARGO_ZONE_POINTS,
  LAB_STATION,
  SCIENCE_PER_PART,
  GEN_MULT,
  HP_DAMAGE_MULT,
  POWER_DRAIN_MULT,
  POWER_GEN_MULT,
  COLD_FREEZE_START,
  COLD_GAIN_DAY,
  COLD_GAIN_NIGHT,
  COLD_RECOVER_INSIDE,
  COLD_RECOVER_ROVER,
  ROVER_DRAIN_PER_SEC,
  ROVER_RECHARGE_PER_SEC,
  ROVER_SPEED_MULT,
  getZoneAt,
  isPointInCave,
  CAREER_DOSE_LIMIT_MSV,
  CREW_NET_WATER_LOSS,
  CROP_RIPE_WILT_SECONDS,
  EASY_WEAR_MULT,
  DEPOSIT_INTERACTION_RADIUS,
  DOSE_DAYS_PER_SECOND,
  DRILL_POWER_KW,
  DRILL_RATE_DEEP,
  DRILL_RATE_SHALLOW,
  ELECTROLYSIS_KW,
  ICE_WATER_YIELD,
  LAUNCH_FUEL_REQUIRED,
  MAJOR_REPAIR_THRESHOLD,
  MELTER_KW,
  MELTER_RATE_KG,
  REDESIGN_WEAR_MULT,
  SABATIER_FUEL_RATE,
  SABATIER_KW,
  SABATIER_WATER_USE,
  HEAT_FREEZE_THRESHOLD,
  HEAT_HYPOTHERMIA_THRESHOLD,
  HISTORICAL_MARS_EVENTS,
  MISSION_MONTHS,
  NOMINAL_EVENT,
  SOL_DURATION_SECONDS,
  TOTAL_MISSION_MONTHS,
  collidesWithWall,
  createGlacierDeposit,
  getLmstFromElapsed,
  isPointInAirlock,
  isPointInsideHabitat,
  HAB_DUST_FILTER,
  HAB_DUST_FROM_SUIT,
  SUIT_DUST_RATE,
  seasonForMonth,
} from '../constants';
import { missionAt } from '../missions';
import { recordBreadcrumb, takeControl, updateNpcs } from './npcs';
import { appendConversation, sayConversation, sayOnce, updateDialogue } from '../dialogue/director';
import { DialogueTrigger } from '../dialogue/lines';
import { getSettings } from '../settings';
import { activeIs, activeMember, buddyIs, buddyOutside, changeMoraleAll, damageActive, damageAll, healAll, nextAbleCrew, roleActive, syncCrew } from '../crew';
import { pickDecision } from '../decisions';
import { EARTH_CONDITIONS, composeEarthMessage } from '../earth';
import { RepairSession } from '../repairTasks';
import {
  EngineState,
  GamePhase,
  HistoricalEventKind,
  LogEntry,
  ModuleId,
  ModuleState,
  SupplyCrateKind,
} from '../types';

import { drainMult, hasChallenge, hasUnlock, mixQuality, moveSpeedForFx, registerFailureFn } from './state';
import { getDoseRateMsvPerSol } from './selectors';

type Ref<T> = { current: T };

// Everything the per-frame update needs from the App component.
export interface SimulationDeps {
  phase: GamePhase;
  keysRef: Ref<Record<string, boolean>>;
  touchDirRef: Ref<{ up: boolean; down: boolean; left: boolean; right: boolean }>;
  soulMgRef: Ref<RepairSession | null>;
  showScienceModal: boolean;
  simSpeed: number;
  addLog: (text: string, tone?: LogEntry['tone']) => void;
  syncHud: () => void;
  setPhase: (p: GamePhase) => void;
  setActiveSoulView: (v: RepairSession | null) => void;
  finishRun: (eng: EngineState, won: boolean) => void;
}

export function createSimulation(deps: SimulationDeps) {
  const {
    phase, keysRef, touchDirRef, soulMgRef, showScienceModal, simSpeed, addLog, syncHud,
    setPhase, setActiveSoulView, finishRun,
  } = deps;

  const spawnSupplyDrop = (eng: EngineState) => {
    if (eng.crates.length >= 8) return;
    const points = [
      { x: 640, y: 260 },
      { x: 640, y: 720 },
      { x: 980, y: 500 },
      { x: 1340, y: 480 },
      { x: 520, y: 340 },
      ...CARGO_ZONE_POINTS,
    ];
    const pt = points[Math.floor(Math.random() * points.length)];
    const kinds: Array<{ kind: SupplyCrateKind; label: string; color: string }> = [
      { kind: 'seeds', label: '+2 SEEDS', color: '#4ade80' },
      { kind: 'parts', label: '+1 PARTS', color: '#fb923c' },
      { kind: 'water', label: '+25% H₂O', color: '#38bdf8' },
      { kind: 'o2', label: '+O₂ TANK', color: '#22d3ee' },
      { kind: 'power', label: '+FUEL CELL', color: '#fbbf24' },
      { kind: 'shield', label: '+H₂O SHIELD', color: '#818cf8' },
    ];
    const chosen = kinds[Math.floor(Math.random() * kinds.length)];
    eng.crates.push({
      id: eng.crateSeq++,
      x: pt.x,
      y: pt.y,
      radius: 17,
      ...chosen,
    });
  };

  const spawnAsteroid = (eng: EngineState) => {
    // MOXIE is rarely the target (weights: O₂ 10%, others 30%)
    const weights: Record<ModuleId, number> = { o2: 0.1, power: 0.3, food: 0.3, shield: 0.3 };
    let roll = Math.random();
    let target = eng.modules[0];
    for (const m of eng.modules) {
      roll -= weights[m.id];
      if (roll <= 0) {
        target = m;
        break;
      }
    }
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    eng.asteroids.push({
      id: eng.asteroidSeq++,
      startX: tx + (Math.random() * 340 - 170),
      startY: ty - 520,
      targetX: tx,
      targetY: ty,
      targetId: target.id,
      progress: 0,
      speed: 0.72 + (eng.solNumber - 1) * 0.05,
      damage: Math.floor(Math.random() * 8 + 10),
    });
    sound.playAlert();
  };

  const spawnSparks = (eng: EngineState, x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 65 + Math.random() * 120;
      eng.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45,
        maxLife: 0.45,
        color,
        size: 3,
      });
    }
  };

  // Logs a hardware failure; after repeated failures engineers "redesign" the part (less wear)
  const registerFailure = (eng: EngineState, mod: ModuleState, reason: string) =>
    registerFailureFn(eng, mod, reason, addLog);

  const applyMonthMilestoneEffects = (eng: EngineState, monthNum: number) => {
    const info = MISSION_MONTHS[Math.max(0, Math.min(MISSION_MONTHS.length - 1, monthNum - 1))];
    addLog(`${info.title}  -  ${info.summary}`, 'info');
    sayConversation(eng, `MONTH_${monthNum}` as DialogueTrigger, true);
    if (monthNum === 3) {
      addLog('Dust storm season begins: southern summer, Mars is closest to the Sun. Expect more and longer storms and dirtier solar panels.', 'warning');
      appendConversation(eng, 'SEASON_STORM');
    } else if (monthNum === 5) {
      addLog('Dust storm season is ending. The skies are clearing.', 'info');
      appendConversation(eng, 'SEASON_CLEAR');
    }
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 34,
      text: info.title.toUpperCase(),
      color: '#fbbf24',
      life: 2.2,
      maxLife: 2.2,
    });

    if (monthNum === 2) {
      addLog(
        'NEW IN MONTH 2: crew decisions appear, you can switch crew members with [C], and dust storms, flares, quakes and meteoroids can now happen.',
        'warning'
      );
      eng.seeds += 2;
      addLog('Month 2 crop supply: +2 seed packets delivered to hydroponics!', 'success');
    } else if (monthNum === 3) {
      eng.iceDeposits.push(createGlacierDeposit(eng.iceDeposits.length + 1));
      addLog(
        'Month 3: orbital SHARAD radar reveals a buried glacier of pure ice in the Crater Field (east). Large deep deposit, already core-sampled.',
        'success'
      );
    } else if (monthNum === 4) {
      damageAll(eng, 12);
      const mod = eng.modules.find((m) => m.id !== 'o2') ?? eng.modules[0];
      if (mod && mod.invulnerableTimer <= 0) mod.health = Math.max(30, mod.health - 18);
      addLog('Month 4 emergency drill: simulated suit leak and equipment fault!', 'warning');
    } else if (monthNum === 5) {
      eng.seeds += 2;
      healAll(eng, 15);
      changeMoraleAll(eng, 20);
      addLog('Month 5: crew celebration (+30 health) and a crop rotation (+2 seeds)!', 'success');
    }
  };

  const updateSimulation = (eng: EngineState, rawDt: number) => {
    const windMult =
      eng.activeEvent.kind === 'DUST_STORM_2018'
        ? 2.8
        : eng.activeEvent.kind === 'PERCHLORATE_DUST_2022'
        ? 1.8
        : 1;
    for (const p of eng.particles) {
      p.x += p.vx * windMult * rawDt;
      p.y += p.vy * windMult * rawDt;
      // Keep dust within a window around the player so it fills every zone
      const px = eng.player.x;
      const py = eng.player.y;
      if (p.x > px + 1100) p.x -= 2200;
      if (p.x < px - 1100) p.x += 2200;
      if (p.y > py + 700) p.y -= 1400;
      if (p.y < py - 700) p.y += 1400;
    }

    if (eng.screenShake > 0) {
      eng.screenShake = Math.max(0, eng.screenShake - rawDt * 2.4);
    }
    if (!getSettings().screenShake) eng.screenShake = 0;

    if (phase !== 'PLAYING') return;
    if (eng.pendingDecision) return; // the world waits while the crew decides

    const keys = keysRef.current;
    const touch = touchDirRef.current;
    const mg = soulMgRef.current;
    void keys;

    // 2. Astronaut world movement (locked only while inside the minigame box)
    if (!mg?.active && !showScienceModal) {
      let dx = 0;
      let dy = 0;
      if (keys['KeyW'] || keys['ArrowUp'] || touch.up) dy -= 1;
      if (keys['KeyS'] || keys['ArrowDown'] || touch.down) dy += 1;
      if (keys['KeyA'] || keys['ArrowLeft'] || touch.left) dx -= 1;
      if (keys['KeyD'] || keys['ArrowRight'] || touch.right) dx += 1;

      const inRover = eng.player.inRover;
      const roverDead = inRover && eng.rover.battery <= 0;
      const hasInput = (dx !== 0 || dy !== 0) && !roverDead;
      const moveSpeed = inRover
        ? eng.player.speed * ROVER_SPEED_MULT
        : eng.player.inEvaSuit
        ? eng.player.speed * 0.95 * (1 - (eng.cold / 100) * 0.55) // numb, stiff from cold
        : eng.player.speed;
      const moraleSlow = activeMember(eng).morale < 25 ? 0.88 : 1;

      // Smooth, frame-rate independent acceleration (delta time + exponential easing).
      // The rover is heavier, so it speeds up and slows down more gently.
      const len = Math.hypot(dx, dy) || 1;
      const targetVx = hasInput ? (dx / len) * moveSpeed * moraleSlow : 0;
      const targetVy = hasInput ? (dy / len) * moveSpeed * moraleSlow : 0;
      const accel = 1 - Math.exp(-(inRover ? 3.5 : 14) * rawDt);
      eng.player.vx += (targetVx - eng.player.vx) * accel;
      eng.player.vy += (targetVy - eng.player.vy) * accel;
      const speedNow = Math.hypot(eng.player.vx, eng.player.vy);
      eng.player.moving = speedNow > 12;

      // Turn toward the input direction gradually instead of snapping between the 8 directions
      if (hasInput) {
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - eng.player.facingAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        eng.player.facingAngle += diff * (1 - Math.exp(-(inRover ? 6 : 16) * rawDt));
      }

      if (speedNow > 0.5) {
        const stepX = eng.player.vx * rawDt;
        const stepY = eng.player.vy * rawDt;
        const radius = inRover ? 26 : eng.player.radius;
        // Far corner zones can only be reached by rover; the rover can't enter the habitat
        const blocked = (nx: number, ny: number) => {
          if (collidesWithWall(nx, ny, radius)) return true;
          if (inRover && (isPointInsideHabitat(nx, ny) || isPointInAirlock(nx, ny))) return true;
          if (!inRover && getZoneAt(nx, ny).roverOnly) {
            if (eng.gateWarnTimer <= 0) {
              eng.gateWarnTimer = 3;
              const z = getZoneAt(nx, ny);
              eng.floatingTexts.push({
                x: eng.player.x,
                y: eng.player.y - 30,
                text: `${z.name.toUpperCase()}: ROVER REQUIRED [V]`,
                color: '#fca5a5',
                life: 1.8,
                maxLife: 1.8,
              });
              addLog(`${z.name} is too far to walk safely. Board the rover with [V] (parked in the base yard).`, 'warning');
            }
            return true;
          }
          return false;
        };
        if (!blocked(eng.player.x + stepX, eng.player.y)) eng.player.x += stepX;
        else eng.player.vx = 0;
        if (!blocked(eng.player.x, eng.player.y + stepY)) eng.player.y += stepY;
        else eng.player.vy = 0;
        if (inRover && eng.player.moving) {
          const before = eng.rover.battery;
          const drain = ROVER_DRAIN_PER_SEC * drainMult(eng) * (hasUnlock(eng, 'ROVER_BATT') ? 0.6 : 1);
          eng.rover.battery = Math.max(0, eng.rover.battery - drain * rawDt);
          if (before > 0 && eng.rover.battery <= 0) {
            sound.playAlert();
            addLog('Rover battery EMPTY! Step out [V] and walk, or wait: the solar panel trickle-charges by day.', 'warning');
          }
        }
      }
      // Walk animation, footprints in the regolith, dust behind the rover
      if (eng.player.moving) {
        eng.walkPhase += rawDt * (inRover ? 0 : 10 * Math.min(1.2, speedNow / eng.player.speed));
        if (eng.player.inEvaSuit) {
          eng.stepAccum += moveSpeedForFx(eng) * rawDt;
          if (!inRover && eng.stepAccum > 26) {
            eng.stepAccum = 0;
            const side = eng.footprints.length % 2 === 0 ? 1 : -1;
            const a = eng.player.facingAngle;
            eng.footprints.push({
              x: eng.player.x + Math.cos(a + Math.PI / 2) * 6 * side,
              y: eng.player.y + Math.sin(a + Math.PI / 2) * 6 * side,
              a,
              life: 25,
            });
            if (eng.footprints.length > 140) eng.footprints.shift();
          }
          if (inRover && Math.random() < 0.9) {
            const a = eng.player.facingAngle + Math.PI;
            eng.trail.push({
              x: eng.player.x + Math.cos(a) * 34 + (Math.random() - 0.5) * 16,
              y: eng.player.y + Math.sin(a) * 34 + (Math.random() - 0.5) * 16,
              vx: Math.cos(a) * 20 + (Math.random() - 0.5) * 20,
              vy: Math.sin(a) * 20 + (Math.random() - 0.5) * 20 - 6,
              life: 1.2,
              size: 6 + Math.random() * 8,
            });
          }
        }
      }
      if (inRover) {
        eng.rover.x = eng.player.x;
        eng.rover.y = eng.player.y;
        eng.rover.facingAngle = eng.player.facingAngle;
      }
    } else {
      eng.player.moving = false;
      eng.player.vx = 0;
      eng.player.vy = 0;
    }
    eng.gateWarnTimer = Math.max(0, eng.gateWarnTimer - rawDt);

    // ---------- Crew moving around the habitat / following you ----------
    recordBreadcrumb(eng);
    updateNpcs(eng, rawDt);
    if (eng.releaseBuddy && eng.followerCrew !== null && !eng.player.inEvaSuit) {
      const buddyNpc = eng.npcs.find((n) => n.crewIndex === eng.followerCrew);
      if (!buddyNpc || isPointInsideHabitat(buddyNpc.x, buddyNpc.y)) {
        if (buddyNpc) {
          buddyNpc.state = 'IDLE';
          buddyNpc.timer = 1;
        }
        addLog(`${eng.crew[eng.followerCrew].name} took off the suit and went back to work.`, 'info');
        eng.followerCrew = null;
        eng.releaseBuddy = false;
      }
    }
    for (let i = eng.footprints.length - 1; i >= 0; i--) {
      eng.footprints[i].life -= rawDt;
      if (eng.footprints[i].life <= 0) eng.footprints.splice(i, 1);
    }
    for (let i = eng.trail.length - 1; i >= 0; i--) {
      const t = eng.trail[i];
      t.x += t.vx * rawDt;
      t.y += t.vy * rawDt;
      t.size += 14 * rawDt;
      t.life -= rawDt;
      if (t.life <= 0) eng.trail.splice(i, 1);
    }

    // Rover charging: fast in the home base yard, slow solar trickle elsewhere by day
    {
      const roverZone = getZoneAt(eng.rover.x, eng.rover.y);
      const lm = getLmstFromElapsed(eng.elapsedSolSec);
      const charging =
        roverZone.id === 'BASE'
          ? ROVER_RECHARGE_PER_SEC
          : !eng.player.moving || !eng.player.inRover
          ? 0.4 * lm.sunFactor
          : 0;
      eng.rover.battery = Math.min(100, eng.rover.battery + charging * rawDt);
    }

    // Zone discovery
    {
      const z = getZoneAt(eng.player.x, eng.player.y);
      if (!eng.discoveredZones.includes(z.id)) {
        eng.discoveredZones.push(z.id);
        sound.playQuindarBeep();
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 40,
          text: `NEW ZONE: ${z.name.toUpperCase()}`,
          color: '#fde68a',
          life: 2.4,
          maxLife: 2.4,
        });
        addLog(`Discovered ${z.name}: ${z.blurb}`, 'success');
      }
    }

    const nowOutdoor = !isPointInsideHabitat(eng.player.x, eng.player.y);
    if (nowOutdoor !== eng.wasOutdoor) {
      eng.wasOutdoor = nowOutdoor;
      eng.player.inEvaSuit = nowOutdoor;
      sound.playDoor(!nowOutdoor);
      if (nowOutdoor) {
        eng.evasCompleted += 1;
        eng.releaseBuddy = false;
        const buddy = eng.followerCrew !== null ? eng.crew[eng.followerCrew] : null;
        if (buddy) {
          addLog(`${buddy.name} is outside with you as your EVA buddy (NASA never sends anyone out alone).`, 'info');
          sayConversation(eng, 'BUDDY_OUT');
        } else {
          sound.playAlert();
          eng.floatingTexts.push({
            x: eng.player.x,
            y: eng.player.y - 44,
            text: 'SOLO EVA: NO BUDDY · COLD & RISK UP',
            color: '#fca5a5',
            life: 2.2,
            maxLife: 2.2,
          });
          addLog('You went outside alone. Real crews always go in pairs: walk up to a crew member and press [B] next time.', 'warning');
          sayConversation(eng, 'SOLO_EVA');
        }
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 24,
          text: 'AIRLOCK DEPRESSURIZED · xEMU SUIT ACTIVE',
          color: '#38bdf8',
          life: 1.6,
          maxLife: 1.6,
        });
        addLog(
          'Stepped through the airlock into Jezero Yard (6.1 mbar CO₂). EVA suit active.',
          'info'
        );
      } else {
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 24,
          text: 'AIRLOCK PRESSURIZED · HABITAT 21.3 kPa',
          color: '#34d399',
          life: 1.6,
          maxLife: 1.6,
        });
        addLog(
          eng.suitDust > 15
            ? 'Back inside. Your suit is covered in toxic dust: clean it at the suit station [E] right away.'
            : 'Back inside the pressurized habitat.',
          eng.suitDust > 15 ? 'warning' : 'info'
        );
        if (eng.followerCrew !== null) eng.releaseBuddy = true;
      }
    }

    // Supply Crate Pickup
    for (let i = eng.crates.length - 1; i >= 0; i--) {
      const c = eng.crates[i];
      if (Math.hypot(eng.player.x - c.x, eng.player.y - c.y) < eng.player.radius + c.radius + 8) {
        sound.playSuccess();
        if (c.kind === 'seeds') {
          eng.seeds += 2;
          addLog('Collected +2 Crop Seeds from supply crate! Plant in Hydroponic Beds.', 'success');
        } else if (c.kind === 'parts') {
          eng.parts += 1;
          addLog(
            `Recovered +1 spare part from a cargo-lander cache (${eng.parts} held). Use for major repairs, drill rigs or insulation [U].`,
            'success'
          );
        } else if (c.kind === 'water') {
          eng.resources.water = Math.min(100, eng.resources.water + 25);
          addLog('Collected +25% Water Tank reserves from supply crate.', 'success');
        } else {
          eng.resources[c.kind] = Math.min(100, eng.resources[c.kind] + 22);
        }
        eng.floatingTexts.push({
          x: c.x,
          y: c.y - 12,
          text: c.label,
          color: c.color,
          life: 1.5,
          maxLife: 1.5,
        });
        eng.crates.splice(i, 1);
      }
    }

    if (showScienceModal) return;

    const dt = rawDt * simSpeed;
    eng.elapsedSolSec += dt;
    eng.totalElapsedSec += dt;

    // Advance one month every SOL_DURATION_SECONDS
    if (eng.elapsedSolSec >= SOL_DURATION_SECONDS) {
      if (eng.solNumber >= TOTAL_MISSION_MONTHS) {
        eng.elapsedSolSec = SOL_DURATION_SECONDS;
        soulMgRef.current = null;
        setActiveSoulView(null);
        const won = eng.resources.fuel >= LAUNCH_FUEL_REQUIRED;
        finishRun(eng, won);
        if (!won) {
          eng.causeOfDeath = `Launch window missed: the ascent vehicle had only ${Math.round(
            eng.resources.fuel
          )}% of its CH₄/LOX propellant.`;
          eng.nasaDebriefTip =
            'NASA plans to make return propellant on Mars (Sabatier: CO₂ + 4H₂ → CH₄ + 2H₂O). Mine ice early, keep the fuel plant [G] running by day, and the next Earth–Mars window is ~26 months away.';
          sound.playAlert();
          setPhase('GAME_OVER');
        } else {
          sound.playSuccess();
          setPhase('VICTORY');
        }
        syncHud();
        return;
      }
      eng.elapsedSolSec -= SOL_DURATION_SECONDS;
      eng.solNumber += 1;
      sound.playQuindarBeep();
      applyMonthMilestoneEffects(eng, eng.solNumber);
    }

    // Module 10s Invulnerability Timers
    for (const m of eng.modules) {
      if (m.invulnerableTimer > 0) {
        m.invulnerableTimer = Math.max(0, m.invulnerableTimer - dt);
      }
    }

    eng.scanCooldown = Math.max(0, eng.scanCooldown - dt);

    // ---------- Crew dialogue (small box, never pauses the game) ----------
    updateDialogue(eng, dt);
    if (eng.resources.food < 30) sayOnce(eng, 'LOW_FOOD');
    if (eng.resources.water < 25) sayOnce(eng, 'LOW_WATER');
    if (eng.player.inEvaSuit && !eng.player.inRover && eng.cold > 55) sayOnce(eng, 'NIGHT_COLD');
    eng.printCooldown = Math.max(0, eng.printCooldown - dt);

    const lmst = getLmstFromElapsed(eng.elapsedSolSec);

    // ---------- Missions ----------
    if (eng.missionIndex < eng.missionPlan.length) {
      const m = missionAt(eng, eng.missionIndex);
      if (m.check(eng)) {
        const reward = m.reward ? m.reward(eng) : '';
        sound.playSuccess();
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 50,
          text: `MISSION COMPLETE: ${m.title.toUpperCase()}${reward ? ` (${reward})` : ''}`,
          color: '#fde047',
          life: 2.6,
          maxLife: 2.6,
        });
        addLog(`Mission complete: ${m.title}.${reward ? ` Reward: ${reward}.` : ''}`, 'success');
        eng.missionIndex += 1;
        changeMoraleAll(eng, 4);
        const next = (eng.missionIndex < eng.missionPlan.length ? missionAt(eng, eng.missionIndex) : undefined);
        if (next) addLog(`New mission: ${next.title}. ${next.desc}`, 'info');
      }
      const cur = missionAt(eng, eng.missionIndex);
      eng.missionTarget = cur.target(eng);
    } else {
      eng.missionTarget = null;
    }

    // ---------- Decision events ----------
    if (eng.solNumber >= 2 && !soulMgRef.current?.active && eng.activeEvent.kind === 'NONE') {
      eng.nextDecisionTimer -= dt;
      if (eng.nextDecisionTimer <= 0) {
        eng.nextDecisionTimer = 60 + Math.random() * 30;
        const d = pickDecision(eng);
        if (d) {
          eng.usedDecisions.push(d.id);
          eng.pendingDecision = { id: d.id, title: d.title, text: d.text, options: d.options };
          sound.playAlert();
          syncHud();
          return;
        }
      }
    }

    // ---------- Messages from Earth (written now, delivered later) ----------
    eng.nextEarthTimer -= dt;
    if (eng.nextEarthTimer <= 0) {
      eng.nextEarthTimer = 45 + Math.random() * 30;
      eng.earthQueue.push(composeEarthMessage(eng));
    }
    for (let i = eng.earthQueue.length - 1; i >= 0; i--) {
      const msg = eng.earthQueue[i];
      if (eng.totalElapsedSec >= msg.deliverAt) {
        eng.earthQueue.splice(i, 1);
        const outdated = msg.condKey ? !EARTH_CONDITIONS[msg.condKey](eng) : false;
        eng.earthMessage = {
          text: msg.text,
          sentLabel: msg.sentLabel,
          outdated,
          until: eng.totalElapsedSec + 12,
        };
        if (msg.moraleBoost) changeMoraleAll(eng, msg.moraleBoost);
        sound.playQuindarBeep();
        addLog(`Earth comms (sent ${msg.sentLabel}): ${msg.text}${outdated ? ' (Already handled.)' : ''}`, 'info');
      }
    }
    if (eng.earthMessage && eng.totalElapsedSec > eng.earthMessage.until) eng.earthMessage = null;

    // ---------- Sample lab ----------
    if (eng.labProgress !== null) {
      eng.labProgress -= dt;
      if (eng.labProgress <= 0) {
        const label = eng.labSample ?? 'rock';
        eng.labProgress = null;
        eng.labSample = null;
        eng.samplesAnalyzed += 1;
        const bioChance = label === 'Leopard-spot rock' ? 0.35 : 0.06;
        const roll = Math.random();
        if (roll < bioChance) {
          eng.science += 150;
          eng.discoveries += 1;
          changeMoraleAll(eng, 25);
          sound.playSuccess();
          eng.floatingTexts.push({
            x: LAB_STATION.x,
            y: LAB_STATION.y - 50,
            text: 'POSSIBLE BIOSIGNATURE! +150 SCIENCE',
            color: '#a7f3d0',
            life: 3,
            maxLife: 3,
          });
          sayConversation(eng, 'BIOSIGNATURE', true);
          addLog(
            `Lab result: the ${label} shows patterns that could have been made by ancient microbes! It will need labs on Earth to confirm. +150 science.`,
            'success'
          );
        } else if (roll < bioChance + 0.3) {
          eng.science += 40;
          addLog(`Lab result: the ${label} contains organic molecules (carbon compounds). Not proof of life, but exciting. +40 science.`, 'success');
        } else {
          eng.science += 15;
          addLog(`Lab result: the ${label} formed in water long ago. It shows Jezero once held a lake. +15 science.`, 'success');
        }
      }
    }
    while (eng.science - eng.scienceRewarded >= SCIENCE_PER_PART) {
      eng.scienceRewarded += SCIENCE_PER_PART;
      eng.parts += 1;
      addLog(`Science milestone (${eng.scienceRewarded}): Houston approves +1 spare part from the reserve.`, 'success');
    }

    // ---------- Cold exposure while outside on foot ----------
    const onFootOutside = eng.player.inEvaSuit && !eng.player.inRover;
    if (onFootOutside) {
      const inCave = isPointInCave(eng.player.x, eng.player.y);
      const stormMult = eng.activeEvent.kind === 'DUST_STORM_2018' ? 1.4 : 1;
      const suitMult = eng.suit < 30 ? 1.6 : 1;
      const gain =
        (lmst.isNight ? COLD_GAIN_NIGHT : COLD_GAIN_DAY) *
        stormMult *
        suitMult *
        (inCave ? 0.6 : 1) *
        (hasChallenge(eng, 'COLD') ? 1.3 : 1) *
        (hasUnlock(eng, 'SUITS') ? 0.85 : 1) *
        (buddyOutside(eng) ? (buddyIs(eng, 'DOCTOR') ? 0.85 : 1) : 1.25) * // solo EVAs are riskier
        drainMult(eng);
      eng.cold = Math.min(100, eng.cold + gain * dt);
    } else {
      const rec = eng.player.inRover ? COLD_RECOVER_ROVER : COLD_RECOVER_INSIDE;
      eng.cold = Math.max(0, eng.cold - rec * dt);
    }
    if (onFootOutside && eng.cold > COLD_FREEZE_START) {
      const chancePerSec =
        ((eng.cold - COLD_FREEZE_START) / (100 - COLD_FREEZE_START)) *
        0.3 *
        (buddyOutside(eng) ? (buddyIs(eng, 'DOCTOR') ? 0.5 : 1) : 1.5);
      if (Math.random() < chancePerSec * dt) {
        damageActive(eng, 7 * HP_DAMAGE_MULT);
        eng.frostFlash = 1;
        sound.playSoulHit();
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 30,
          text: 'FROSTBITE! -4 HP',
          color: '#7dd3fc',
          life: 1.6,
          maxLife: 1.6,
        });
        eng.causeOfDeath = 'Hypothermia on EVA: stayed outside too long in the Martian cold.';
        eng.nasaDebriefTip =
          'Watch the cold meter. Martian nights drop near −80 °C. Head back inside or into the heated rover before it fills up.';
      }
    }
    if (onFootOutside && eng.cold >= 100) {
      damageActive(eng, 2.5 * HP_DAMAGE_MULT * dt);
    }
    eng.frostFlash = Math.max(0, eng.frostFlash - rawDt * 1.5);

    // ---------- Dust: on the suit, tracked inside, and on the solar panels ----------
    const storming = eng.activeEvent.kind === 'DUST_STORM_2018' || eng.activeEvent.kind === 'PERCHLORATE_DUST_2022';
    if (onFootOutside) {
      const rate =
        SUIT_DUST_RATE *
        (eng.player.moving ? 1 : 0.3) *
        (storming ? 2.5 : 1) *
        (eng.drillingId !== null ? 1.5 : 1);
      eng.suitDust = Math.min(100, eng.suitDust + rate * dt);
    } else if (!eng.player.inEvaSuit && eng.suitDust > 0) {
      // A dirty suit inside sheds perchlorate dust into the air
      const shed = Math.min(eng.suitDust, 1.2 * dt);
      eng.suitDust -= shed;
      eng.habDust = Math.min(100, eng.habDust + shed * HAB_DUST_FROM_SUIT);
    }
    {
      const filters = (eng.modules.find((m) => m.id === 'o2')?.health ?? 100) / 100;
      eng.habDust = Math.max(0, eng.habDust - HAB_DUST_FILTER * filters * dt);
      if (eng.habDust > 40) {
        // Perchlorates irritate lungs and can affect the thyroid
        damageAll(eng, (eng.habDust > 70 ? 1.6 : 0.6) * HP_DAMAGE_MULT * dt);
        changeMoraleAll(eng, -0.15 * dt);
        eng.causeOfDeath = 'Toxic dust poisoning: perchlorate dust tracked in on suits filled the habitat.';
        eng.nasaDebriefTip =
          'Every time you come back inside, clean your suit at the suit station [E]. Martian dust contains toxic perchlorates, and the air filters can only remove it slowly.';
        sayOnce(eng, 'DUST_INSIDE');
      }
    }
    {
      const season = seasonForMonth(eng.solNumber);
      const panelRate = 0.12 * (storming ? 6 : 1) * (season.storms ? 1.6 : 1);
      const beforeDust = eng.panelDust;
      eng.panelDust = Math.min(100, eng.panelDust + panelRate * dt);
      if (beforeDust < 55 && eng.panelDust >= 55) sayConversation(eng, 'PANELS_DIRTY');
    }

    // ---------- Suit wear ----------
    if (onFootOutside) {
      const wear =
        0.08 *
        drainMult(eng) *
        (hasUnlock(eng, 'SUITS') ? 0.65 : 1) *
        (eng.activeEvent.kind === 'DUST_STORM_2018' || eng.activeEvent.kind === 'PERCHLORATE_DUST_2022'
          ? 2.5
          : 1) *
        (eng.player.moving ? 1.3 : 1);
      const before = eng.suit;
      eng.suit = Math.max(0, eng.suit - wear * dt);
      if (before >= 30 && eng.suit < 30) {
        sound.playAlert();
        addLog('Suit integrity below 30%: small leaks are wasting O₂. Repair it at the suit station.', 'warning');
      }
      if (eng.suit <= 0) damageActive(eng, 1.5 * HP_DAMAGE_MULT * dt);
    }

    // ---------- Marsquake shaking ----------
    if (eng.quakeShake > 0) {
      eng.quakeShake = Math.max(0, eng.quakeShake - rawDt);
      eng.screenShake = Math.max(eng.screenShake, 0.25 + Math.min(1, eng.quakeShake / 3) * 0.6);
    }

    // Historical NASA Mars Anomaly Scheduler
    if (eng.activeEvent.kind !== 'NONE') {
      eng.activeEvent.timeRemaining -= dt;
      if (eng.activeEvent.timeRemaining <= 0) {
        addLog(
          `Anomaly cleared: ${eng.activeEvent.title}. Returning to nominal telemetry.`,
          'success'
        );
        eng.activeEvent = { ...NOMINAL_EVENT };
      }
    } else if (eng.solNumber >= 2) {
      eng.nextEventTimer -= dt;
      if (eng.nextEventTimer <= 0) {
        const season = seasonForMonth(eng.solNumber);
        eng.nextEventTimer =
          (70 + Math.random() * 30) * (hasChallenge(eng, 'STORMS') ? 0.7 : 1) * (season.storms ? 0.7 : 1);
        // Dust storm season (southern summer, Mars near perihelion) makes storms far more likely
        const pool: Array<Exclude<HistoricalEventKind, 'NONE'>> = season.storms
          ? ['DUST_STORM_2018', 'DUST_STORM_2018', 'DUST_STORM_2018', 'PERCHLORATE_DUST_2022', 'SOLAR_FLARE_2024', 'INSIGHT_MARSQUAKE_2021']
          : ['SOLAR_FLARE_2024', 'PERCHLORATE_DUST_2022', 'INSIGHT_MARSQUAKE_2021', 'DUST_STORM_2018'];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const ev = HISTORICAL_MARS_EVENTS[pick];
        eng.activeEvent = { ...ev, timeRemaining: pick === 'DUST_STORM_2018' && season.storms ? 32 : 18 };
        sound.playAlert();
        addLog(`NASA HISTORICAL ALERT: ${ev.title}  -  ${ev.actionAdvice}`, 'warning');
        sayConversation(
          eng,
          pick === 'DUST_STORM_2018' || pick === 'PERCHLORATE_DUST_2022'
            ? 'STORM'
            : pick === 'SOLAR_FLARE_2024'
            ? 'FLARE'
            : 'QUAKE',
          true
        );

        if (pick === 'PERCHLORATE_DUST_2022' || pick === 'DUST_STORM_2018') {
          const pwr = eng.modules.find((m) => m.id === 'power');
          const mox = eng.modules.find((m) => m.id === 'o2');
          if (pwr && pwr.invulnerableTimer <= 0) pwr.health = Math.max(35, pwr.health - 12);
          if (mox && mox.invulnerableTimer <= 0) mox.health = Math.max(45, mox.health - 4);
          eng.panelDust = Math.min(100, eng.panelDust + (pick === 'PERCHLORATE_DUST_2022' ? 25 : 10));
        } else if (pick === 'INSIGHT_MARSQUAKE_2021') {
          // Marsquake: violent shaking, MOXIE oxygen plant badly damaged
          const mox = eng.modules.find((m) => m.id === 'o2');
          if (mox) {
            mox.health = Math.max(15, mox.health - 45);
            mox.invulnerableTimer = 0;
            eng.floatingTexts.push({
              x: mox.x + mox.w / 2,
              y: mox.y - 14,
              text: 'MARSQUAKE! MOXIE CRACKED -45%',
              color: '#ef4444',
              life: 2.4,
              maxLife: 2.4,
            });
          }
          eng.quakeShake = 5;
          if (eng.player.inEvaSuit && !eng.player.inRover) {
            eng.suit = Math.max(0, eng.suit - 12);
            damageActive(eng, 6 * HP_DAMAGE_MULT);
          }
          addLog('MARSQUAKE! The ground shook hard and the MOXIE oxygen plant is badly damaged. Repair it fast [E].', 'warning');
        } else if (pick === 'SOLAR_FLARE_2024') {
          const shd = eng.modules.find((m) => m.id === 'shield');
          if (shd && shd.invulnerableTimer <= 0) shd.health = Math.max(35, shd.health - 12);
        }
      }
    }

    // Asteroid Strikes Scheduler (frequency scales gently with Mission Month)
    // Meteoroid strikes on a base are extremely rare: at most one per expedition
    if (eng.solNumber >= 2 && eng.meteorsLeft > 0) eng.nextAsteroidTimer -= dt;
    if (eng.meteorsLeft > 0 && eng.nextAsteroidTimer <= 0) {
      eng.meteorsLeft -= 1;
      eng.nextAsteroidTimer = 9999;
      spawnAsteroid(eng);
    }
    // Instead, ordinary wear and tear: small realistic faults that need attention
    if (eng.solNumber >= 2) {
      eng.nextFaultTimer -= dt;
      if (eng.nextFaultTimer <= 0) {
        eng.nextFaultTimer = 70 + Math.random() * 40;
        const faults: Array<[ModuleId, string]> = [
          ['o2', 'A pump seal on MOXIE is wearing out'],
          ['o2', 'The CO₂ intake filter on MOXIE is clogging with dust'],
          ['power', 'A battery cell is drifting out of balance'],
          ['power', 'A cable connector to the solar array is corroding'],
          ['food', 'A grow-light driver is flickering'],
          ['food', 'The nutrient pump is making a grinding noise'],
          ['shield', 'A water-wall bladder valve is weeping'],
          ['shield', 'The radiation sensor is drifting off calibration'],
        ];
        const [id, text] = faults[Math.floor(Math.random() * faults.length)];
        const mod = eng.modules.find((m) => m.id === id);
        if (mod && mod.invulnerableTimer <= 0) {
          const dmg = 6 + Math.floor(Math.random() * 5);
          mod.health = Math.max(20, mod.health - dmg);
          eng.floatingTexts.push({ x: mod.x + mod.w / 2, y: mod.y - 12, text: `FAULT -${dmg}%`, color: '#fbbf24', life: 1.6, maxLife: 1.6 });
          addLog(`Wear and tear: ${text} (${mod.shortLabel} -${dmg}%). Inspect it with [E].`, 'warning');
          if (Math.random() < 0.4) sayConversation(eng, 'FAULT');
        }
      }
    }

    for (let i = eng.asteroids.length - 1; i >= 0; i--) {
      const a = eng.asteroids[i];
      a.progress += dt * a.speed;
      if (a.progress >= 1) {
        const mod = eng.modules.find((m) => m.id === a.targetId);
        if (mod) {
          if (mod.invulnerableTimer > 0) {
            sound.playDeflect();
            spawnSparks(eng, a.targetX, a.targetY, '#38bdf8', 14);
            eng.floatingTexts.push({
              x: mod.x + mod.w / 2,
              y: mod.y - 10,
              text: 'WHIPPLE SHIELD HELD!',
              color: '#38bdf8',
              life: 1.5,
              maxLife: 1.5,
            });
            addLog(
              `Fresh Whipple bumper on ${mod.name} absorbed a micrometeoroid impact.`,
              'success'
            );
          } else {
            sound.playImpact();
            sayConversation(eng, 'METEOR_HIT');
            eng.screenShake = 0.5;
            mod.health = Math.max(10, mod.health - a.damage);
            spawnSparks(eng, a.targetX, a.targetY, '#fb923c', 14);
            eng.floatingTexts.push({
              x: mod.x + mod.w / 2,
              y: mod.y - 10,
              text: `METEOROID HIT! -${a.damage}%`,
              color: '#ef4444',
              life: 1.6,
              maxLife: 1.6,
            });
            addLog(
              `Micrometeoroid struck ${mod.name} for -${a.damage}% efficiency! Mars's thin air (6 mbar) barely slows small impactors.`,
              'warning'
            );
          }
        }
        eng.asteroids.splice(i, 1);
      }
    }

    eng.nextSupplyTimer -= dt;
    if (eng.nextSupplyTimer <= 0) {
      // Pre-landed cargo caches are finite and scattered: rarer than before
      eng.nextSupplyTimer = 40 + Math.random() * 15;
      spawnSupplyDrop(eng);
    }

    // Module gradual wear: slightly increased & escalates over the 12 months
    const o2Mod = eng.modules.find((m) => m.id === 'o2')!;
    const powerMod = eng.modules.find((m) => m.id === 'power')!;
    const foodMod = eng.modules.find((m) => m.id === 'food')!;
    const shieldMod = eng.modules.find((m) => m.id === 'shield')!;

    const timeDamageMult = 1.12 + (eng.solNumber - 1) * 0.08 + lmst.progress * 0.15;
    const wearOf = (id: ModuleId) =>
      (eng.upgradedModules.includes(id) ? REDESIGN_WEAR_MULT : 1) *
      EASY_WEAR_MULT *
      (hasChallenge(eng, 'WEAR') ? 1.3 : 1) *
      (roleActive(eng, 'ENGINEER') ? 0.85 : 1) *
      drainMult(eng);
    const dustWearMult =
      eng.activeEvent.kind === 'DUST_STORM_2018' ||
      eng.activeEvent.kind === 'PERCHLORATE_DUST_2022'
        ? 2.0
        : 1.0;

    if (o2Mod.invulnerableTimer <= 0) {
      o2Mod.health = Math.max(
        15,
        o2Mod.health -
          (o2Mod.mode === 'OVERDRIVE' ? 0.48 : 0.21) * dustWearMult * timeDamageMult * wearOf('o2') * 0.25 * dt
      );
    }
    if (powerMod.invulnerableTimer <= 0) {
      powerMod.health = Math.max(
        15,
        powerMod.health -
          (powerMod.mode === 'OVERDRIVE' ? 0.45 : 0.2) * dustWearMult * timeDamageMult * wearOf('power') * dt
      );
    }
    if (foodMod.invulnerableTimer <= 0) {
      foodMod.health = Math.max(
        15,
        foodMod.health -
          (foodMod.mode === 'OVERDRIVE' ? 0.35 : 0.15) * timeDamageMult * wearOf('food') * dt
      );
    }
    if (shieldMod.invulnerableTimer <= 0) {
      shieldMod.health = Math.max(
        15,
        shieldMod.health -
          (shieldMod.mode === 'OVERDRIVE' ? 0.36 : 0.16) * timeDamageMult * wearOf('shield') * dt
      );
    }

    // Failure latch: crossing below the major-failure threshold files an anomaly report
    for (const m of eng.modules) {
      if (m.health < MAJOR_REPAIR_THRESHOLD && !eng.failLatch[m.id]) {
        eng.failLatch[m.id] = true;
        sound.playAlert();
        registerFailure(eng, m, 'dropped below 40%');
      } else if (m.health >= MAJOR_REPAIR_THRESHOLD + 10) {
        eng.failLatch[m.id] = false;
      }
    }

    const o2Eff = o2Mod.health / 100;
    const pwrEff = powerMod.health / 100;
    const foodEff = foodMod.health / 100;
    const shdEff = shieldMod.health / 100;

    const tauAttenuation =
      eng.activeEvent.kind === 'DUST_STORM_2018'
        ? 0.18
        : eng.activeEvent.kind === 'PERCHLORATE_DUST_2022'
        ? 0.58
        : 1.0;

    const panelEff = 1 - (eng.panelDust / 100) * 0.75;
    const solarKw = 18.0 * POWER_GEN_MULT * lmst.sunFactor * tauAttenuation * pwrEff * panelEff;
    const krustyKw =
      powerMod.mode === 'ECO'
        ? 0.0
        : powerMod.mode === 'NOMINAL'
        ? 6.5 * POWER_GEN_MULT * pwrEff
        : 15.5 * POWER_GEN_MULT * pwrEff;

    const totalGenKw = (solarKw + krustyKw) * GEN_MULT;

    const o2Kw = o2Mod.mode === 'ECO' ? 1.5 : o2Mod.mode === 'NOMINAL' ? 3.8 : 7.4;
    const foodKw = foodMod.mode === 'ECO' ? 0.8 : foodMod.mode === 'NOMINAL' ? 3.6 : 6.8;
    const shieldKw = shieldMod.mode === 'ECO' ? 0.8 : shieldMod.mode === 'NOMINAL' ? 3.0 : 6.6;

    // Heater draws peak power at -90°C night when solar is 0
    const heaterKw =
      eng.resources.power <= 0.5
        ? 0
        : lmst.isNight
        ? eng.heaterMode === 'ECO'
          ? 2.6
          : eng.heaterMode === 'NOMINAL'
          ? 5.8
          : 9.6
        : eng.heaterMode === 'ECO'
        ? 1.2
        : eng.heaterMode === 'NOMINAL'
        ? 2.8
        : 5.0;
    eng.heaterKw = heaterKw;

    // ---------- ISRU demand (decided before the power balance) ----------
    const drillDeposit =
      eng.drillingId !== null ? eng.iceDeposits.find((d) => d.id === eng.drillingId) ?? null : null;
    if (drillDeposit) {
      const dist = Math.hypot(eng.player.x - drillDeposit.x, eng.player.y - drillDeposit.y);
      if (!eng.player.inEvaSuit || dist > DEPOSIT_INTERACTION_RADIUS * 1.6 || drillDeposit.amountKg <= 0) {
        if (drillDeposit.amountKg <= 0) {
          addLog(`Ice deposit #${drillDeposit.id} is exhausted. Scan [R] for more.`, 'warning');
        } else {
          addLog('Drill stopped: an astronaut must stay with the rig.', 'info');
        }
        eng.drillingId = null;
      }
    }
    const hasPower = eng.resources.power > 0.5;
    const drillingNow = hasPower && eng.drillingId !== null;
    const meltingNow = hasPower && !eng.pipesFrozen && eng.iceKg > 0.01 && eng.resources.water < 99.5;
    const electrolysisNow =
      hasPower && !eng.pipesFrozen && eng.resources.o2 < 45 && o2Eff < 0.6 && eng.resources.water > 15;
    const sabatierNow =
      eng.fuelPlantOn &&
      !eng.pipesFrozen &&
      eng.resources.power > 15 &&
      eng.resources.water > 12 &&
      eng.resources.fuel < LAUNCH_FUEL_REQUIRED;
    const isruKw =
      (drillingNow ? DRILL_POWER_KW : 0) +
      (meltingNow ? MELTER_KW : 0) +
      (electrolysisNow ? ELECTROLYSIS_KW : 0) +
      (sabatierNow ? SABATIER_KW : 0);
    eng.isruLoadKw = isruKw;

    const totalLoadKw = (o2Kw + foodKw + shieldKw + heaterKw + isruKw) * drainMult(eng);
    const netKw = totalGenKw - totalLoadKw;

    eng.genPowerKw = totalGenKw;
    eng.loadPowerKw = totalLoadKw;
    eng.netPowerKw = netKw;

    // Battery: drains 4x slower than before, charges normally
    eng.resources.power += (netKw < 0 ? netKw * POWER_DRAIN_MULT : netKw) * 0.18 * dt;

    // Base Heat Simulation (drops slowly by day, faster at -90°C night or dust storm, mitigated by insulation)
    const insulMult = Math.max(0.28, 1 - eng.insulationLevel * 0.22);
    const envColdMult =
      (lmst.isNight ? 2.4 : 1.0) * (eng.activeEvent.kind === 'DUST_STORM_2018' ? 1.7 : 1.0);
    const heatLoss = 0.19 * envColdMult * insulMult * drainMult(eng) * (hasUnlock(eng, 'HAB2') ? 0.85 : 1);
    const heatGain =
      eng.resources.power <= 0.5
        ? 0
        : (eng.heaterMode === 'ECO' ? 0.45 : eng.heaterMode === 'NOMINAL' ? 1.35 : 2.65) * GEN_MULT;
    eng.resources.heat = Math.max(0, Math.min(100, eng.resources.heat + (heatGain - heatLoss) * dt));

    const wasFrozen = eng.pipesFrozen;
    eng.pipesFrozen = eng.resources.heat < HEAT_FREEZE_THRESHOLD;
    if (eng.pipesFrozen && !wasFrozen) {
      sound.playAlert();
      addLog(
        'FREEZE ALERT: Base Heat fell below 30%! Water pipes frozen and crop growth halted!',
        'warning'
      );
    } else if (!eng.pipesFrozen && wasFrozen) {
      addLog('Pipes thawed! Water flow and crop growth resumed.', 'success');
    }

    // ---------- ISRU chain: drill -> ice -> melter -> water -> O₂ / fuel ----------
    // There is no free water on Mars: the crew loses a little even with ~98% recycling
    eng.resources.water = Math.max(0, eng.resources.water - CREW_NET_WATER_LOSS * drainMult(eng) * dt);

    if (drillingNow && drillDeposit) {
      const rate =
        (drillDeposit.depth === 'DEEP' ? DRILL_RATE_DEEP : DRILL_RATE_SHALLOW) *
        (activeIs(eng, 'GEOLOGIST') ? 1.25 : 1) *
        (buddyIs(eng, 'GEOLOGIST') ? 1.25 : 1) *
        (hasUnlock(eng, 'DRILL') ? 1.3 : 1);
      const dustSlow = eng.activeEvent.kind === 'DUST_STORM_2018' ? 0.6 : 1;
      const mined = Math.min(drillDeposit.amountKg, rate * dustSlow * GEN_MULT * dt);
      drillDeposit.amountKg -= mined;
      eng.iceKg += mined;
      eng.iceMinedKg += mined;
      eng.hopper = mixQuality(eng.hopper, drillDeposit.quality, mined);
    }
    if (meltingNow) {
      const melt = Math.min(eng.iceKg, MELTER_RATE_KG * dt);
      eng.iceKg -= melt;
      const yieldPct = ICE_WATER_YIELD[eng.hopper.q];
      eng.resources.water = Math.min(100, eng.resources.water + melt * yieldPct * GEN_MULT);
      if (eng.iceKg <= 0.01) eng.hopper = { q: 'PURE', kg: 0 };
    }
    if (electrolysisNow) {
      eng.resources.water -= 0.35 * drainMult(eng) * dt;
      eng.resources.o2 += 0.55 * GEN_MULT * dt;
    }
    if (sabatierNow) {
      const fuelBefore = eng.resources.fuel;
      eng.resources.water -= SABATIER_WATER_USE * drainMult(eng) * dt;
      eng.resources.fuel = Math.min(
        LAUNCH_FUEL_REQUIRED,
        eng.resources.fuel +
          SABATIER_FUEL_RATE *
            GEN_MULT *
            (hasChallenge(eng, 'FUEL') ? 0.8 : 1) *
            (hasUnlock(eng, 'FUELPLANT') ? 1.2 : 1) *
            dt
      );
      if (eng.resources.fuel >= LAUNCH_FUEL_REQUIRED && fuelBefore < LAUNCH_FUEL_REQUIRED) {
        sound.playSuccess();
        addLog('Ascent vehicle propellant tanks FULL! Survive until the Month 6 launch window.', 'success');
      }
    }
    eng.resources.water = Math.max(0, Math.min(100, eng.resources.water));

    // 4 Hydroponic Planting Beds Growth
    if (eng.pipesFrozen) {
      eng.cropsPausedReason = 'PIPES FROZEN';
    } else if (eng.resources.water <= 0.5) {
      eng.cropsPausedReason = 'NO WATER';
    } else if (eng.resources.power <= 0.5) {
      eng.cropsPausedReason = 'NO POWER';
    } else if (foodMod.mode === 'ECO') {
      eng.cropsPausedReason = 'LIGHTS ECO';
    } else {
      eng.cropsPausedReason = null;
    }

    for (const bed of eng.beds) {
      if (bed.stage === 'SPROUT' || bed.stage === 'LEAFY') {
        if (!eng.cropsPausedReason) {
          const lightMult = foodMod.mode === 'OVERDRIVE' ? 1.45 : 1.0;
          const soilMult = bed.medium === 'MARS_SOIL' ? 1.25 : 1.0;
          const growRate =
            3.0 * lightMult * soilMult * foodEff * GEN_MULT * (roleActive(eng, 'BOTANIST') ? 1.3 : 1);
          bed.growth = Math.min(100, bed.growth + growRate * dt);

          // Hydroponic water mostly recirculates; only transpiration losses are counted
          const waterUse = (bed.medium === 'MARS_SOIL' ? 0.07 : 0.16) * drainMult(eng);
          eng.resources.water = Math.max(0, eng.resources.water - waterUse * dt);

          if (bed.growth >= 100) {
            bed.stage = 'RIPE';
            bed.ripeTimer = CROP_RIPE_WILT_SECONDS;
            addLog(`Crop in Bed ${bed.id} is RIPE! Harvest with [E] before it wilts.`, 'success');
          } else if (bed.growth >= 40) {
            bed.stage = 'LEAFY';
          }
        }
      } else if (bed.stage === 'RIPE') {
        bed.ripeTimer -= dt;
        if (bed.ripeTimer <= 0) {
          bed.stage = 'WILTED';
          bed.ripeTimer = 0;
          addLog(`Crop in Bed ${bed.id} WILTED! Clear and replant with [E].`, 'warning');
        }
      }
    }

    const evaO2Penalty = eng.player.inEvaSuit
      ? eng.player.inRover
        ? 1.0
        : eng.suit < 30
        ? 1.7 // leaking suit
        : 1.2
      : 1.0;
    const o2Prod =
      ((o2Mod.mode === 'ECO' ? 0.35 : o2Mod.mode === 'NOMINAL' ? 1.05 : 2.1) * o2Eff +
        (foodMod.mode === 'OVERDRIVE' ? 0.3 * foodEff : 0)) *
      GEN_MULT;
    const o2Use = 0.42 * evaO2Penalty * drainMult(eng);
    eng.resources.o2 += (o2Prod - o2Use) * dt;

    const foodUse = (eng.player.moving ? 0.36 : 0.3) * drainMult(eng);
    eng.resources.food -= foodUse * dt;
    // ~0.45 kg packaging per crew-day becomes printer feedstock (recycled polymer)
    eng.scrap = Math.min(12, eng.scrap + foodUse * 0.07 * dt);

    // Cumulative radiation dose (Curiosity RAD baseline 0.64 mSv/sol)
    eng.doseMsv += getDoseRateMsvPerSol(eng) * DOSE_DAYS_PER_SECOND * dt;

    const flareMult = eng.activeEvent.kind === 'SOLAR_FLARE_2024' ? 2.4 : 1.0;
    const outdoorExposure = eng.player.inEvaSuit ? 1.45 : 1.0;
    const krustyThermalRadLeak = powerMod.mode === 'OVERDRIVE' ? 0.3 : 0;
    const shieldProd =
      (shieldMod.mode === 'ECO' ? 0.25 : shieldMod.mode === 'NOMINAL' ? 1.0 : 2.35) * shdEff * GEN_MULT;
    const shieldLoss = (0.6 * flareMult * outdoorExposure + krustyThermalRadLeak) * drainMult(eng);
    eng.resources.shield += (shieldProd - shieldLoss) * dt;

    eng.resources.o2 = Math.max(0, Math.min(100, eng.resources.o2));
    eng.resources.power = Math.max(0, Math.min(100, eng.resources.power));
    eng.resources.food = Math.max(0, Math.min(100, eng.resources.food));
    eng.resources.shield = Math.max(0, Math.min(100, eng.resources.shield));

    if (eng.sickTimer > 0) {
      eng.sickTimer = Math.max(0, eng.sickTimer - dt * (roleActive(eng, 'DOCTOR') ? 2 : 1));
      damageAll(eng, 2.4 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath =
        'Perchlorate Toxicosis: Consumed unwashed crops grown in Martian regolith (ClO₄⁻).';
      eng.nasaDebriefTip =
        'Martian regolith contains toxic perchlorates (ClO₄⁻). Always press [F] to wash soil beds with water before harvesting!';
    }

    if (eng.resources.heat < HEAT_HYPOTHERMIA_THRESHOLD) {
      damageAll(eng, 4.2 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath = 'Severe Habitat Hypothermia (-90°C Martian Night Freeze).';
      eng.nasaDebriefTip =
        'Base Heat dropped below 18% - pipes froze and crew suffered hypothermia. Upgrade Insulation [U] with crate parts and keep Heater [5] + KRUSTY Nuclear [2] powered at night.';
    }

    const anyHazard =
      eng.resources.o2 <= 0 ||
      eng.resources.power <= 0 ||
      eng.resources.food <= 0 ||
      eng.resources.shield <= 0 ||
      eng.resources.heat < HEAT_HYPOTHERMIA_THRESHOLD ||
      eng.sickTimer > 0;

    if (!anyHazard) {
      healAll(eng, 2 * (roleActive(eng, 'DOCTOR') ? 1.5 : 1) * dt);
    }
    // Morale slowly wears down in isolation; faster when things go wrong
    changeMoraleAll(
      eng,
      -0.1 * (anyHazard ? 2.5 : 1) * (hasUnlock(eng, 'VETERANS') ? 0.6 : 1) * drainMult(eng) * dt
    );

    if (eng.resources.o2 <= 0) {
      damageAll(eng, 6.5 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath =
        'Cabin Hypoxia: Habitat O₂ partial pressure fell below NASA safe limit (11 kPa).';
      eng.nasaDebriefTip =
        'A 4-person crew breathes 3.36 kg of O₂ per Sol. Set MOXIE [1] to MAX and repair it outside.';
    }
    if (eng.resources.power <= 0) {
      damageAll(eng, 5.8 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath = 'Main Bus Brownout: Heaters and life-support lost electrical power.';
      eng.nasaDebriefTip =
        'At night (-90°C) or during Dust Storms (Tau = 10.8), solar drops near 0 kWe. Switch Power [2] to MAX (KRUSTY Nuclear) and shed non-critical loads.';
    }
    if (eng.resources.food <= 0) {
      damageAll(eng, 4.5 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath = 'Starvation: Hydroponic food reserves depleted.';
      eng.nasaDebriefTip =
        'Collect Seed crates, keep Water & Grow Lights active (Heat > 30%, Hydro [3] NOMINAL/MAX), and harvest ripe beds with [E] before they wilt!';
    }
    if (eng.resources.shield <= 0) {
      damageAll(eng, 6.0 * HP_DAMAGE_MULT * dt);
      eng.causeOfDeath = 'Acute Radiation Dose Exceeded NASA ALARA Career Limit.';
      eng.nasaDebriefTip =
        'During Solar Particle Events (8.1 mSv/day), stay INSIDE the habitat and set RAD Shield [4] to MAX.';
    }

    if (eng.doseMsv >= CAREER_DOSE_LIMIT_MSV) {
      for (const c of eng.crew) c.hp = 0;
      eng.causeOfDeath = `Career radiation limit exceeded (${Math.round(eng.doseMsv)} mSv). Flight surgeons ended the mission.`;
      eng.nasaDebriefTip =
        'NASA caps an astronaut career at 600 mSv. Mars has no magnetic field: limit EVA time, stay inside during solar particle events, and keep the water-wall RAD shield [4] healthy.';
    }

    // ---------- Crew bookkeeping ----------
    const sync = syncCrew(eng);
    for (const c of sync.newlyDown) {
      sound.playAlert();
      addLog(`${c.name} collapsed and was carried to the medbay. They can't work until they recover.`, 'warning');
    }
    for (const c of sync.recovered) {
      addLog(`${c.name} has recovered and is back on duty.`, 'success');
    }
    if (sync.activeWentDown && eng.resources.hp > 0) {
      // Rescue: the crew brings the injured astronaut home, someone else takes over
      const hadBuddy = buddyOutside(eng);
      const injured = eng.activeCrew;
      const next = nextAbleCrew(eng, eng.activeCrew);
      eng.player.inRover = false;
      eng.drillingId = null;
      eng.cold = 0;
      takeControl(eng, next);
      eng.player.x = 520;
      eng.player.y = 500;
      const injuredNpc = eng.npcs.find((n) => n.crewIndex === injured);
      if (injuredNpc) {
        injuredNpc.x = 560;
        injuredNpc.y = 560;
      }
      eng.followerCrew = null;
      eng.wasOutdoor = false;
      eng.player.inEvaSuit = false;
      if (hadBuddy) {
        addLog(`Rescue! The EVA buddy carried ${eng.crew[injured].name} back inside. ${activeMember(eng).name} takes over.`, 'warning');
      } else {
        changeMoraleAll(eng, -15);
        addLog(`${eng.crew[injured].name} collapsed outside ALONE. The crew had to suit up and search for them. Everyone is shaken (-15 morale).`, 'warning');
      }
    }
    if (eng.resources.hp <= 0) {
      finishRun(eng, false);
      soulMgRef.current = null;
      setActiveSoulView(null);
      sound.playAlert();
      setPhase('GAME_OVER');
      syncHud();
      return;
    }

    for (let i = eng.sparks.length - 1; i >= 0; i--) {
      const s = eng.sparks[i];
      s.x += s.vx * rawDt;
      s.y += s.vy * rawDt;
      s.life -= rawDt;
      if (s.life <= 0) eng.sparks.splice(i, 1);
    }

    for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
      const ft = eng.floatingTexts[i];
      ft.y -= 22 * rawDt;
      ft.life -= rawDt;
      if (ft.life <= 0) eng.floatingTexts.splice(i, 1);
    }
  };


  return updateSimulation;
}
