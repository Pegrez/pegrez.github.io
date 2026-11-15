// All player actions (repairs, scanning, drilling, crew, runs...) as stable callbacks.
import { useCallback } from 'react';
import { sound } from '../game/audio';
import {
  LAB_ANALYSIS_SECONDS,
  ROLE_INFO,
  UNLOCKS,
  SUIT_STATION,
  ROVER_BOARD_RADIUS,
  CROP_RIPE_WILT_SECONDS,
  DEEP_RIG_PART_COST,
  DRILL_POWER_KW,
  JURY_RIG_HEALTH,
  MAJOR_REPAIR_THRESHOLD,
  PREVENTIVE_THRESHOLD,
  PRINT_COOLDOWN_SECONDS,
  PRINT_POWER_COST,
  PRINT_SCRAP_COST,
  SABATIER_KW,
  SCAN_COOLDOWN_SECONDS,
  SCAN_POWER_COST,
  SCAN_RADIUS,
  INSULATION_MAX_LEVEL,
  INSULATION_UPGRADE_COST,
  NEXT_MODE,
  REPAIR_FAIL_DAMAGE,
  REPAIR_INVULNERABILITY_SECONDS,
  collidesWithWall,
  NPC_INTERACT_RADIUS,
  PANEL_FIELD,
} from '../game/constants';
import { missionAt } from '../game/missions';
import { sayConversation } from '../game/dialogue/director';
import { activeIs, buddyIs, changeMoraleAll } from '../game/crew';
import { getDecision } from '../game/decisions';
import { CampaignMeta, clearRun, loadMeta, loadRun, peekRun, saveMeta, saveRun } from '../game/save';
import { ScoreResult, computeScore } from '../game/score';
import { RepairSession, buildPanelQueue, buildRepairQueue } from '../game/repairTasks';
import { nearestNpc, takeControl } from '../game/engine/npcs';
import {
  EngineState,
  GamePhase,
  LogEntry,
  FieldSite,
  IceDeposit,
  ModuleId,
  ModuleState,
  PlantBed,
  PlantingMedium,
} from '../game/types';

import { QUALITY_LABEL, createInitialEngineState, registerFailureFn } from '../game/engine/state';
import { getNearbyDeposit, getNearbySite, getNearbyTarget, isNearLab, isNearPanels, isNearSuitStation } from '../game/engine/selectors';

type Ref<T> = { current: T };
type LogFn = (text: string, tone?: LogEntry['tone']) => void;

// Everything the actions need from the App component.
export interface GameActionsContext {
  engineRef: Ref<EngineState>;
  soulMgRef: Ref<RepairSession | null>;
  repairCtxRef: Ref<{ preventive: boolean; usedPart: boolean }>;
  setActiveSoulView: (v: RepairSession | null) => void;
  addLog: LogFn;
  syncHud: () => void;
  phase: GamePhase;
  setPhase: (p: GamePhase) => void;
  setMeta: (m: CampaignMeta) => void;
  setSavedRun: (r: { month: number; difficulty: number } | null) => void;
  setFinalScore: (s: ScoreResult | null) => void;
  setNewUnlock: (u: { name: string; desc: string } | null) => void;
  setShowCinematic: (b: boolean) => void;
  meta: CampaignMeta;
}

export function useGameActions(ctx: GameActionsContext) {
  const {
    engineRef, soulMgRef, repairCtxRef, setActiveSoulView, addLog, syncHud, phase, setPhase,
    setMeta, setSavedRun, setFinalScore, setNewUnlock, setShowCinematic, meta,
  } = ctx;

  const cycleModuleMode = useCallback(
    (id: ModuleId) => {
      const eng = engineRef.current;
      const mod = eng.modules.find((m) => m.id === id);
      if (!mod) return;
      mod.mode = NEXT_MODE[mod.mode];
      sound.playQuindarBeep();
      eng.floatingTexts.push({
        x: mod.x + mod.w / 2,
        y: mod.y - 10,
        text: `${mod.shortLabel}: ${mod.mode === 'OVERDRIVE' ? 'MAX' : mod.mode}`,
        color: mod.mode === 'OVERDRIVE' ? '#38bdf8' : mod.mode === 'ECO' ? '#cbd5e1' : '#34d399',
        life: 1.4,
        maxLife: 1.4,
      });
      addLog(
        `Configured ${mod.name} to ${mod.mode === 'OVERDRIVE' ? 'MAX (Overdrive)' : mod.mode} mode.`,
        'info'
      );
      syncHud();
    },
    [addLog, syncHud]
  );

  const cycleHeaterMode = useCallback(() => {
    const eng = engineRef.current;
    eng.heaterMode = NEXT_MODE[eng.heaterMode];
    sound.playQuindarBeep();
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 26,
      text: `HEATER: ${eng.heaterMode === 'OVERDRIVE' ? 'MAX' : eng.heaterMode}`,
      color: '#fb923c',
      life: 1.4,
      maxLife: 1.4,
    });
    addLog(
      `Set Habitat Thermal Heater to ${
        eng.heaterMode === 'OVERDRIVE' ? 'MAX' : eng.heaterMode
      }.`,
      'info'
    );
    syncHud();
  }, [addLog, syncHud]);

  const upgradeInsulation = useCallback(() => {
    const eng = engineRef.current;
    if (eng.insulationLevel >= INSULATION_MAX_LEVEL) return;
    if (eng.parts < INSULATION_UPGRADE_COST) {
      sound.playAlert();
      addLog(
        `Need ${INSULATION_UPGRADE_COST} Parts from supply crates to upgrade Insulation (have ${eng.parts}).`,
        'warning'
      );
      syncHud();
      return;
    }
    eng.parts -= INSULATION_UPGRADE_COST;
    eng.insulationLevel += 1;
    sound.playSuccess();
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 28,
      text: `INSULATION LV.${eng.insulationLevel}!`,
      color: '#fb923c',
      life: 1.8,
      maxLife: 1.8,
    });
    addLog(
      `Upgraded Habitat Insulation to Lv.${eng.insulationLevel}! Heat loss reduced by ${
        eng.insulationLevel * 22
      }%.`,
      'success'
    );
    syncHud();
  }, [addLog, syncHud]);

  const openSoulMinigame = useCallback(
    (mod: ModuleState) => {
      const eng = engineRef.current;
      sound.playQuindarBeep();
      const preventive = mod.health >= PREVENTIVE_THRESHOLD;
      const mg: RepairSession = {
        active: true,
        moduleId: mod.id,
        moduleName: mod.name,
        nasaSystem: mod.nasaSystem,
        queue: buildRepairQueue(mod.id, 4),
        stageIndex: 0,
      };
      let usedPart = false;
      if (!preventive && buddyIs(eng, 'ENGINEER') && mg.queue.length > 2) mg.queue = mg.queue.slice(0, mg.queue.length - 1);
      if (preventive) {
        // Scheduled inspection: a single quick check instead of the full 4-task repair
        mg.queue = mg.queue.slice(0, 1);
      } else if (activeIs(eng, 'ENGINEER')) {
        mg.queue = mg.queue.slice(0, 3); // the engineer knows the shortcuts
        addLog(
          `Preventive inspection on ${mod.name}: 1 quick check resets wear before it becomes a failure.`,
          'info'
        );
      } else {
        if (mod.health < MAJOR_REPAIR_THRESHOLD) {
          if (eng.parts > 0) {
            eng.parts -= 1;
            usedPart = true;
            addLog(
              `Major repair on ${mod.name}: installed 1 spare part (${eng.parts} left).`,
              'info'
            );
          } else {
            addLog(
              `No spare parts! ${mod.name} can only be jury-rigged to ${JURY_RIG_HEALTH}%. Print parts with [P].`,
              'warning'
            );
          }
        } else {
          usedPart = true; // minor repair: no part needed, full restore
          addLog(`Started 4 repair tasks on ${mod.name}. Base systems remain live!`, 'info');
        }
      }
      repairCtxRef.current = { preventive, usedPart };
      soulMgRef.current = mg;
      setActiveSoulView({ ...mg });
    },
    [addLog]
  );

  // ---------- Hands-on repair tasks ----------
  const repairStageClear = useCallback(() => {
    const eng = engineRef.current;
    const mg = soulMgRef.current;
    if (!mg) return;
    if (mg.stageIndex + 1 < mg.queue.length) {
      mg.stageIndex += 1;
      setActiveSoulView({ ...mg });
      return;
    }
    if (mg.purpose === 'PANELS') {
      const before = Math.round(eng.panelDust);
      eng.panelDust = 0;
      eng.panelsCleaned += 1;
      eng.floatingTexts.push({
        x: PANEL_FIELD.x + PANEL_FIELD.w / 2,
        y: PANEL_FIELD.y - 14,
        text: 'PANELS CLEAN · SOLAR 100%',
        color: '#fde047',
        life: 2,
        maxLife: 2,
      });
      addLog(`Brushed ${before}% dust off the solar array. Full solar output restored.`, 'success');
      sound.playSuccess();
      sayConversation(eng, 'PANELS_CLEANED');
      soulMgRef.current = null;
      setActiveSoulView(null);
      syncHud();
      return;
    }
      const mod = eng.modules.find((m) => m.id === mg.moduleId);
      const ctx = repairCtxRef.current;
      if (mod) {
        if (ctx.preventive) {
          mod.health = 100;
          mod.invulnerableTimer = REPAIR_INVULNERABILITY_SECONDS * 0.5;
          eng.preventiveDone += 1;
          eng.floatingTexts.push({
            x: mod.x + mod.w / 2,
            y: mod.y - 12,
            text: `${mod.shortLabel} INSPECTED · 100%`,
            color: '#34d399',
            life: 1.8,
            maxLife: 1.8,
          });
          addLog(`Preventive maintenance on ${mod.name} complete. Wear reset to 100%.`, 'success');
        } else {
          const target = ctx.usedPart ? 100 : JURY_RIG_HEALTH;
          mod.health = Math.max(mod.health, target);
          mod.invulnerableTimer = REPAIR_INVULNERABILITY_SECONDS;
          // Power repairs pay double: +48% battery and a longer impact shield
          const bonus = mod.id === 'power' ? 48 : 24;
          eng.resources[mod.id] = Math.min(100, eng.resources[mod.id] + bonus);
          if (mod.id === 'power') mod.invulnerableTimer = REPAIR_INVULNERABILITY_SECONDS * 2;
          eng.repairsCompleted += 1;
          eng.floatingTexts.push({
            x: mod.x + mod.w / 2,
            y: mod.y - 12,
            text: ctx.usedPart
              ? `${mod.shortLabel} 100% · 10s SHIELD`
              : `${mod.shortLabel} JURY-RIGGED ${JURY_RIG_HEALTH}%`,
            color: ctx.usedPart ? '#34d399' : '#facc15',
            life: 1.8,
            maxLife: 1.8,
          });
          addLog(
            ctx.usedPart
              ? `Repaired ${mod.name} to 100% + 10s impact shield.`
              : `Jury-rigged ${mod.name} to ${JURY_RIG_HEALTH}% without spare parts.`,
            'success'
          );
        }
      }
      sound.playSuccess();
      if (!repairCtxRef.current.preventive) sayConversation(eng, 'REPAIR_DONE');
      soulMgRef.current = null;
      setActiveSoulView(null);
      syncHud();
  }, [addLog, syncHud]);

  const repairFail = useCallback(() => {
    const eng = engineRef.current;
    const mg = soulMgRef.current;
    if (!mg) return;
    if (mg.purpose === 'PANELS') {
      // Scratched a cell: a bit less dust, but you have to try again
      eng.panelDust = Math.max(0, eng.panelDust - 15);
      eng.resources.power = Math.max(0, eng.resources.power - 4);
      sound.playSoulHit();
      addLog('Scratched a solar cell while brushing (-4% power). Some dust is gone; try again for a full clean.', 'warning');
      soulMgRef.current = null;
      setActiveSoulView(null);
      syncHud();
      return;
    }
      const mod = eng.modules.find((m) => m.id === mg.moduleId);
      if (mod) {
        mod.health = Math.max(10, mod.health - REPAIR_FAIL_DAMAGE);
        eng.repairFailures += 1;
        registerFailureFn(eng, mod, 'repair mistake', addLog);
        eng.screenShake = 0.35;
        eng.floatingTexts.push({
          x: mod.x + mod.w / 2,
          y: mod.y - 12,
          text: `TASK FAILED -${REPAIR_FAIL_DAMAGE}%`,
          color: '#ef4444',
          life: 1.6,
          maxLife: 1.6,
        });
        addLog(
          `Task failed on ${mod.name}! Station took -${REPAIR_FAIL_DAMAGE}% damage.`,
          'warning'
        );
      }
      sound.playSoulHit();
      sayConversation(eng, 'REPAIR_FAIL');
      soulMgRef.current = null;
      setActiveSoulView(null);
      syncHud();
  }, [addLog, syncHud]);

  const radarScan = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    if (!eng.player.inEvaSuit) {
      sound.playAlert();
      addLog('Ground-penetrating radar only works outside. Walk out through the Airlock first.', 'warning');
      syncHud();
      return;
    }
    if (eng.scanCooldown > 0) return;
    if (eng.resources.power < SCAN_POWER_COST + 1) {
      sound.playAlert();
      addLog('Not enough battery for a radar sweep.', 'warning');
      syncHud();
      return;
    }
    eng.resources.power -= SCAN_POWER_COST;
    eng.scanCooldown = SCAN_COOLDOWN_SECONDS;
    eng.scansCompleted += 1;
    let found = 0;
    for (const d of eng.iceDeposits) {
      if (
        d.scanLevel === 0 &&
        Math.hypot(eng.player.x - d.x, eng.player.y - d.y) < SCAN_RADIUS * (activeIs(eng, 'GEOLOGIST') ? 1.4 : 1) * (buddyIs(eng, 'GEOLOGIST') ? 1.25 : 1)
      ) {
        d.scanLevel = 1;
        found += 1;
      }
    }
    sound.playQuindarBeep();
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 30,
      text: found > 0 ? `RADAR: ${found} ICE ECHO${found > 1 ? 'ES' : ''}!` : 'RADAR: NO ICE ECHO',
      color: found > 0 ? '#7dd3fc' : '#cbd5e1',
      life: 1.6,
      maxLife: 1.6,
    });
    addLog(
      found > 0
        ? `Radar sweep found ${found} subsurface ice reflector(s). Walk to the blue ring and press [E] to take a core sample.`
        : 'Radar sweep: no ice reflectors within range. Try another spot.',
      found > 0 ? 'success' : 'info'
    );
    syncHud();
  }, [addLog, phase, syncHud]);

  const interactDeposit = useCallback(
    (d: IceDeposit) => {
      const eng = engineRef.current;
      if (!eng.player.inEvaSuit) return;
      if (d.scanLevel === 1) {
        d.scanLevel = 2;
        sound.playSuccess();
        eng.floatingTexts.push({
          x: d.x,
          y: d.y - d.r - 8,
          text: `${d.depth} · ${QUALITY_LABEL[d.quality].toUpperCase()}`,
          color: d.quality === 'PERCHLORATE' ? '#a3e635' : '#7dd3fc',
          life: 2.0,
          maxLife: 2.0,
        });
        addLog(
          `Core sample: ${QUALITY_LABEL[d.quality]}, ${d.depth === 'DEEP' ? 'deep (needs drill rig, 1 part)' : 'under ~1 m of regolith'}, ~${Math.round(d.amountKg)} kg. ${
            d.quality === 'PERCHLORATE' ? 'Brine will need reverse osmosis (50% yield).' : ''
          }`,
          'success'
        );
        syncHud();
        return;
      }
      if (eng.drillingId === d.id) {
        eng.drillingId = null;
        addLog('Drilling paused.', 'info');
        syncHud();
        return;
      }
      if (d.depth === 'DEEP' && !d.rigInstalled) {
        if (eng.parts < DEEP_RIG_PART_COST) {
          sound.playAlert();
          addLog(
            `Deep ice needs a Rodwell drill rig (${DEEP_RIG_PART_COST} part). Collect or print parts first.`,
            'warning'
          );
          syncHud();
          return;
        }
        eng.parts -= DEEP_RIG_PART_COST;
        d.rigInstalled = true;
        addLog(
          'Installed Rodwell rig: drills down, then pumps hot water to melt ice in place (NASA concept).',
          'success'
        );
      }
      eng.drillingId = d.id;
      sound.playQuindarBeep();
      addLog(`Drilling ice deposit #${d.id}. Stay nearby  -  the rig draws ${DRILL_POWER_KW} kWe.`, 'info');
      syncHud();
    },
    [addLog, syncHud]
  );

  const printPart = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    if (eng.player.inEvaSuit) {
      sound.playAlert();
      addLog('The 3D printer is inside the habitat.', 'warning');
      syncHud();
      return;
    }
    if (eng.printCooldown > 0) return;
    if (eng.scrap < PRINT_SCRAP_COST) {
      sound.playAlert();
      addLog(
        `Need ${PRINT_SCRAP_COST} kg recycled packaging to print (have ${eng.scrap.toFixed(1)}). Packaging builds up as the crew eats.`,
        'warning'
      );
      syncHud();
      return;
    }
    if (eng.resources.power < PRINT_POWER_COST + 5) {
      sound.playAlert();
      addLog('Not enough battery to run the 3D printer.', 'warning');
      syncHud();
      return;
    }
    eng.scrap -= PRINT_SCRAP_COST;
    eng.resources.power -= PRINT_POWER_COST;
    eng.parts += 1;
    eng.partsPrinted += 1;
    eng.printCooldown = PRINT_COOLDOWN_SECONDS;
    sound.playSuccess();
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 28,
      text: '+1 PRINTED PART',
      color: '#fb923c',
      life: 1.6,
      maxLife: 1.6,
    });
    addLog(
      `3D-printed a spare part from recycled packaging (like the ISS Refabricator). Parts: ${eng.parts}.`,
      'success'
    );
    syncHud();
  }, [addLog, phase, syncHud]);

  const repairSuit = useCallback(() => {
    const eng = engineRef.current;
    const dust = Math.round(eng.suitDust);
    eng.suit = 100;
    eng.suitDust = 0;
    eng.suitRepairs += 1;
    sound.playSuccess();
    eng.floatingTexts.push({
      x: SUIT_STATION.x,
      y: SUIT_STATION.y - 40,
      text: dust > 0 ? `SUIT CLEAN (-${dust}% DUST) · 100%` : 'SUIT 100% · SEALS & VISOR OK',
      color: '#7dd3fc',
      life: 1.8,
      maxLife: 1.8,
    });
    addLog(
      dust > 0
        ? `Suit station: vacuumed ${dust}% toxic dust off the suit, patched the seals and recharged the heater.`
        : 'Suit station: patched the seals and recharged the heater. Suit 100%.',
      'success'
    );
    syncHud();
  }, [addLog, syncHud]);

  const toggleRover = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    const p = eng.player;
    if (p.inRover) {
      p.inRover = false;
      // Step out beside the rover
      const ox = p.x + 40;
      if (!collidesWithWall(ox, p.y, p.radius)) p.x = ox;
      p.vx = 0;
      p.vy = 0;
      sound.playRoverStop();
      addLog('Parked the rover and stepped out in the EVA suit.', 'info');
    } else {
      if (!p.inEvaSuit) return;
      if (Math.hypot(p.x - eng.rover.x, p.y - eng.rover.y) > ROVER_BOARD_RADIUS) {
        sound.playAlert();
        addLog('The rover is too far away. Walk up to it and press [V].', 'warning');
        syncHud();
        return;
      }
      p.inRover = true;
      eng.roverBoarded = true;
      sayConversation(eng, 'ROVER');
      p.x = eng.rover.x;
      p.y = eng.rover.y;
      eng.drillingId = null;
      sound.playRoverStart();
      addLog(
        `Boarded the pressurized rover (battery ${Math.round(eng.rover.battery)}%). It is 2.3x faster and can reach the far corner zones.`,
        'success'
      );
    }
    syncHud();
  }, [addLog, phase, syncHud]);

  const collectSite = useCallback(
    (f: FieldSite) => {
      const eng = engineRef.current;
      f.collected = true;
      if (f.kind === 'SAMPLE') sound.playSampleCollect();
      else sound.playSuccess();
      let text = '';
      if (f.kind === 'SAMPLE') {
        eng.samplesCollected += 1;
        eng.sampleQueue.push(f.label);
        sayConversation(eng, 'SAMPLE');
        const bonus = buddyIs(eng, 'BOTANIST') ? 10 : 0;
        eng.science += 10 + bonus;
        text = `SAMPLE: ${f.label.toUpperCase()} (+${10 + bonus} SCIENCE)`;
        addLog(
          `Sealed a ${f.label} sample in a tube (${eng.samplesCollected}/6). Bring it to the lab inside the habitat to analyze it.`,
          'success'
        );
      } else if (f.label === 'Strange outcrop') {
        eng.parts += 2;
        eng.science += 60;
        text = '+2 PARTS · +60 SCIENCE';
        addLog('The strange outcrop is rich in sulfates and metals! +2 parts and +60 science.', 'success');
      } else if (f.kind === 'MINERAL') {
        eng.mineralsCollected += 1;
        eng.parts += 1;
        text = `+1 PART (${f.label.toUpperCase()})`;
        addLog(`Collected ${f.label} and sintered it into a spare part (+1 part).`, 'success');
      } else {
        eng.meteoritesCollected += 1;
        eng.scrap += 3;
        text = '+3 kg SCRAP METAL';
        addLog(
          'Recovered an iron meteorite, like Opportunity\'s "Heat Shield Rock". +3 kg printer feedstock.',
          'success'
        );
      }
      eng.floatingTexts.push({
        x: f.x,
        y: f.y - 20,
        text,
        color: '#fde68a',
        life: 1.8,
        maxLife: 1.8,
      });
      syncHud();
    },
    [addLog, syncHud]
  );

  const toggleFuelPlant = useCallback(() => {
    const eng = engineRef.current;
    eng.fuelPlantOn = !eng.fuelPlantOn;
    sound.playQuindarBeep();
    addLog(
      eng.fuelPlantOn
        ? `Sabatier fuel plant ON (CO₂ + 4H₂ → CH₄ + 2H₂O). Draws ${SABATIER_KW} kWe and water for hydrogen.`
        : 'Sabatier fuel plant OFF  -  saving power and water.',
      'info'
    );
    syncHud();
  }, [addLog, syncHud]);

  const abortSoulMinigame = useCallback(() => {
    if (!soulMgRef.current) return;
    soulMgRef.current = null;
    setActiveSoulView(null);
    syncHud();
  }, [syncHud]);

  const plantSeedInBed = useCallback(
    (bed: PlantBed, medium: PlantingMedium) => {
      const eng = engineRef.current;
      if (eng.seeds <= 0) {
        sound.playAlert();
        eng.floatingTexts.push({
          x: bed.x + bed.w / 2,
          y: bed.y - 10,
          text: 'NO SEEDS! COLLECT CRATES',
          color: '#f87171',
          life: 1.5,
          maxLife: 1.5,
        });
        addLog('Out of crop seeds! Collect Seed supply crates around the outpost.', 'warning');
        syncHud();
        return;
      }
      eng.seeds -= 1;
      eng.seedsPlanted += 1;
      bed.stage = 'SPROUT';
      bed.medium = medium;
      bed.growth = 5;
      bed.ripeTimer = CROP_RIPE_WILT_SECONDS;
      bed.perchlorateWashed = medium === 'WATER';
      sound.playSuccess();
      eng.floatingTexts.push({
        x: bed.x + bed.w / 2,
        y: bed.y - 10,
        text: medium === 'WATER' ? 'PLANTED (WATER)' : 'PLANTED (MARS SOIL)',
        color: medium === 'WATER' ? '#4ade80' : '#facc15',
        life: 1.6,
        maxLife: 1.6,
      });
      addLog(
        medium === 'WATER'
          ? `Planted seed in Hydroponic Bed ${bed.id} (Clean Water-Only).`
          : `Planted seed in Bed ${bed.id} (Martian Soil). Remember to wash toxic perchlorates [F]!`,
        medium === 'WATER' ? 'info' : 'warning'
      );
      syncHud();
    },
    [addLog, syncHud]
  );

  const handleBedPrimary = useCallback(
    (bed: PlantBed) => {
      const eng = engineRef.current;
      if (bed.stage === 'EMPTY') {
        plantSeedInBed(bed, 'WATER');
      } else if (bed.stage === 'RIPE') {
        const unwashed = bed.medium === 'MARS_SOIL' && !bed.perchlorateWashed;
        eng.resources.food = Math.min(100, eng.resources.food + 28);
        eng.cropsHarvested += 1;
        sayConversation(eng, 'HARVEST');
        changeMoraleAll(eng, 6);
        bed.stage = 'EMPTY';
        bed.growth = 0;
        bed.perchlorateWashed = true;

        if (unwashed) {
          eng.sickTimer = 26;
          sound.playSoulHit();
          eng.floatingTexts.push({
            x: bed.x + bed.w / 2,
            y: bed.y - 10,
            text: 'POISONED! UNWASHED SOIL!',
            color: '#a3e635',
            life: 2.0,
            maxLife: 2.0,
          });
          addLog(
            `Harvested Bed ${bed.id} WITHOUT washing perchlorates! Crew has ClO₄⁻ sickness (-Health)!`,
            'warning'
          );
        } else {
          sound.playSuccess();
          eng.floatingTexts.push({
            x: bed.x + bed.w / 2,
            y: bed.y - 10,
            text: '+28% FOOD HARVESTED!',
            color: '#4ade80',
            life: 1.6,
            maxLife: 1.6,
          });
          addLog(`Harvested fresh crop from Bed ${bed.id} (+28% Food)!`, 'success');
        }
        syncHud();
      } else if (bed.stage === 'WILTED') {
        bed.stage = 'EMPTY';
        bed.growth = 0;
        bed.perchlorateWashed = true;
        sound.playQuindarBeep();
        eng.floatingTexts.push({
          x: bed.x + bed.w / 2,
          y: bed.y - 10,
          text: 'BED CLEARED',
          color: '#cbd5e1',
          life: 1.2,
          maxLife: 1.2,
        });
        addLog(`Cleared wilted crop from Bed ${bed.id}. Ready to replant.`, 'info');
        syncHud();
      }
    },
    [addLog, plantSeedInBed, syncHud]
  );

  const handleBedSecondary = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    const { nearbyBed } = getNearbyTarget(eng);
    if (!nearbyBed) return;

    if (nearbyBed.stage === 'EMPTY') {
      plantSeedInBed(nearbyBed, 'MARS_SOIL');
      return;
    }

    if (
      nearbyBed.stage !== 'WILTED' &&
      nearbyBed.medium === 'MARS_SOIL' &&
      !nearbyBed.perchlorateWashed
    ) {
      if (eng.pipesFrozen) {
        sound.playAlert();
        eng.floatingTexts.push({
          x: nearbyBed.x + nearbyBed.w / 2,
          y: nearbyBed.y - 10,
          text: 'PIPES FROZEN! HEAT UP FIRST',
          color: '#38bdf8',
          life: 1.6,
          maxLife: 1.6,
        });
        addLog('Cannot wash perchlorates while water pipes are frozen (Heat < 30%)!', 'warning');
        syncHud();
        return;
      }
      if (eng.resources.water < 10) {
        sound.playAlert();
        addLog('Not enough water in tank (need 10%) to wash Martian soil!', 'warning');
        syncHud();
        return;
      }
      eng.resources.water -= 10;
      nearbyBed.perchlorateWashed = true;
      sound.playSuccess();
      eng.floatingTexts.push({
        x: nearbyBed.x + nearbyBed.w / 2,
        y: nearbyBed.y - 10,
        text: 'PERCHLORATES WASHED!',
        color: '#38bdf8',
        life: 1.6,
        maxLife: 1.6,
      });
      addLog(
        `Washed toxic perchlorates out of Bed ${nearbyBed.id} (-10% Water). Crop is now safe!`,
        'success'
      );
      syncHud();
    }
  }, [addLog, phase, plantSeedInBed, syncHud]);

  const startLab = useCallback(() => {
    const eng = engineRef.current;
    if (eng.labProgress !== null) {
      addLog(`The lab is still analyzing ${eng.labSample}.`, 'info');
      syncHud();
      return;
    }
    if (eng.sampleQueue.length === 0) {
      sound.playAlert();
      addLog('No samples to analyze. Collect rocks in the Crater Field first.', 'warning');
      syncHud();
      return;
    }
    eng.labSample = eng.sampleQueue.shift() ?? null;
    eng.labProgress = LAB_ANALYSIS_SECONDS;
    eng.resources.power = Math.max(0, eng.resources.power - 3);
    sound.playQuindarBeep();
    addLog(`Lab: analyzing the ${eng.labSample} sample (X-ray and spectrometer scans)...`, 'info');
    syncHud();
  }, [addLog, syncHud]);

  const triggerInteract = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    const { nearbyBed, nearbyModule } = getNearbyTarget(eng);
    const nearbyDeposit = getNearbyDeposit(eng);
    const nearbySite = eng.player.inEvaSuit ? getNearbySite(eng) : null;
    if (nearbyBed) {
      handleBedPrimary(nearbyBed);
    } else if (isNearSuitStation(eng)) {
      repairSuit();
    } else if (isNearLab(eng)) {
      startLab();
    } else if (isNearPanels(eng) && !eng.player.inRover && eng.panelDust >= 10) {
      const mg: RepairSession = {
        active: true,
        moduleId: 'power',
        moduleName: 'Solar array',
        nasaSystem: 'Photovoltaic panels · dust removal',
        queue: buildPanelQueue(),
        stageIndex: 0,
        purpose: 'PANELS',
      };
      soulMgRef.current = mg;
      setActiveSoulView({ ...mg });
      sound.playQuindarBeep();
    } else if (nearbySite) {
      collectSite(nearbySite);
    } else if (nearbyDeposit && eng.player.inEvaSuit) {
      interactDeposit(nearbyDeposit);
    } else if (nearbyModule) {
      if (eng.player.inRover) {
        sound.playAlert();
        eng.floatingTexts.push({
          x: eng.player.x,
          y: eng.player.y - 34,
          text: 'EXIT THE ROVER [V] TO REPAIR',
          color: '#fca5a5',
          life: 1.6,
          maxLife: 1.6,
        });
        addLog('Repairs need hands on the hardware: get out of the rover with [V] first.', 'warning');
        syncHud();
        return;
      }
      openSoulMinigame(nearbyModule);
    }
  }, [addLog, syncHud, collectSite, handleBedPrimary, interactDeposit, openSoulMinigame, phase, repairSuit, startLab]);

  const beginRun = useCallback(
    (eng: EngineState) => {
      engineRef.current = eng;
      if (eng.totalElapsedSec < 1) sayConversation(eng, 'START', true);
      soulMgRef.current = null;
      setActiveSoulView(null);
      setFinalScore(null);
      setNewUnlock(null);
      setShowCinematic(false);
      setPhase('PLAYING');
      sound.startAmbient();
      sound.playQuindarBeep();
      saveRun(eng);
      setSavedRun(peekRun());
      syncHud();
    },
    [syncHud]
  );

  // New run at the campaign's current difficulty, with all earned unlocks.
  const startSolSimulation = useCallback(() => {
    const m = loadMeta();
    setMeta(m);
    beginRun(createInitialEngineState(1, m.difficulty, m.unlocks));
  }, [beginRun]);

  const continueRun = useCallback(() => {
    const eng = loadRun();
    if (!eng) {
      startSolSimulation();
      return;
    }
    beginRun(eng);
  }, [beginRun, startSolSimulation]);

  const resetCampaign = useCallback(() => {
    const fresh: CampaignMeta = { difficulty: 0, unlocks: [], bestScore: meta.bestScore, expeditionsWon: 0 };
    saveMeta(fresh);
    clearRun();
    setMeta(fresh);
    setSavedRun(null);
  }, [meta.bestScore]);

  // Ends the run: score it, update the campaign, clear the saved run.
  const finishRun = useCallback((eng: EngineState, won: boolean) => {
    const score = computeScore(eng, won);
    const m = loadMeta();
    m.bestScore = Math.max(m.bestScore, score.total);
    let unlocked: { name: string; desc: string } | null = null;
    if (won) {
      m.expeditionsWon += 1;
      m.difficulty = eng.difficulty + 1;
      const next = UNLOCKS.find((u) => !m.unlocks.includes(u.id));
      if (next) {
        m.unlocks = [...m.unlocks, next.id];
        unlocked = { name: next.name, desc: next.desc };
      }
    }
    saveMeta(m);
    clearRun();
    setMeta(m);
    setSavedRun(null);
    setFinalScore(score);
    setNewUnlock(unlocked);
    if (won) {
      sound.playVictory();
      setShowCinematic(true);
    } else {
      sound.playDefeat();
    }
  }, []);

  const resolveDecision = useCallback(
    (choice: number) => {
      const eng = engineRef.current;
      const d = eng.pendingDecision;
      if (!d) return;
      const def = getDecision(d.id);
      const text = def ? def.resolve(eng, choice) : '';
      eng.pendingDecision = null;
      sound.playQuindarBeep();
      if (text) addLog(`${d.title}: ${text}`, 'info');
      syncHud();
    },
    [addLog, syncHud]
  );

  const skipMission = useCallback(() => {
    const eng = engineRef.current;
    const m = (eng.missionIndex < eng.missionPlan.length ? missionAt(eng, eng.missionIndex) : undefined);
    if (!m || !m.optional) return;
    addLog(`Skipped optional mission: ${m.title}.`, 'info');
    eng.missionIndex += 1;
    const next = (eng.missionIndex < eng.missionPlan.length ? missionAt(eng, eng.missionIndex) : undefined);
    if (next) addLog(`New mission: ${next.title}. ${next.desc}`, 'info');
    syncHud();
  }, [addLog, syncHud]);

  const switchCrew = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    if (eng.player.inEvaSuit) {
      sound.playAlert();
      addLog('You can only swap crew members inside the habitat.', 'warning');
      syncHud();
      return;
    }
    const npc = nearestNpc(eng, NPC_INTERACT_RADIUS);
    if (!npc) {
      sound.playAlert();
      addLog('Walk up to a crew member inside the base and press [C] to take over as them.', 'info');
      syncHud();
      return;
    }
    const target = eng.crew[npc.crewIndex];
    if (target.down) {
      sound.playAlert();
      addLog(`${target.name} is resting in the bunks and can't work right now.`, 'warning');
      syncHud();
      return;
    }
    const next = npc.crewIndex;
    takeControl(eng, next);
    const c = eng.crew[next];
    sayConversation(eng, `SWITCH_${c.role}` as 'SWITCH_ENGINEER');
    sound.playQuindarBeep();
    eng.floatingTexts.push({
      x: eng.player.x,
      y: eng.player.y - 30,
      text: `${c.name.toUpperCase()} · ${ROLE_INFO[c.role].label.toUpperCase()}`,
      color: '#fde68a',
      life: 1.6,
      maxLife: 1.6,
    });
    addLog(`${c.name} (${ROLE_INFO[c.role].label}) is now in control. ${ROLE_INFO[c.role].perk}`, 'info');
    syncHud();
  }, [addLog, phase, syncHud]);



  const toggleBuddy = useCallback(() => {
    const eng = engineRef.current;
    if (phase !== 'PLAYING' || soulMgRef.current?.active) return;
    if (eng.player.inEvaSuit) {
      if (eng.followerCrew !== null) {
        addLog(`${eng.crew[eng.followerCrew].name} is staying with you until you're back inside.`, 'info');
        syncHud();
      }
      return;
    }
    const npc = nearestNpc(eng, NPC_INTERACT_RADIUS);
    if (eng.followerCrew !== null && (!npc || npc.crewIndex === eng.followerCrew)) {
      const name = eng.crew[eng.followerCrew].name;
      const f = eng.npcs.find((n) => n.crewIndex === eng.followerCrew);
      if (f) {
        f.state = 'IDLE';
        f.timer = 1;
      }
      eng.followerCrew = null;
      addLog(`${name} went back to work.`, 'info');
      syncHud();
      return;
    }
    if (!npc) {
      sound.playAlert();
      addLog('Walk up to a crew member and press [B] to bring them outside as your EVA buddy.', 'info');
      syncHud();
      return;
    }
    const c = eng.crew[npc.crewIndex];
    if (c.down) {
      sound.playAlert();
      addLog(`${c.name} needs rest and can't go outside right now.`, 'warning');
      syncHud();
      return;
    }
    eng.followerCrew = npc.crewIndex;
    npc.state = 'FOLLOW';
    eng.breadcrumbs = [];
    sound.playQuindarBeep();
    eng.floatingTexts.push({ x: npc.x, y: npc.y - 30, text: `${c.name.split(' ')[0].toUpperCase()} IS COMING WITH YOU`, color: '#86efac', life: 1.6, maxLife: 1.6 });
    addLog(`${c.name} (${ROLE_INFO[c.role].label}) suits up as your EVA buddy. Buddy bonus: ${ROLE_INFO[c.role].buddy}`, 'info');
    syncHud();
  }, [addLog, phase, syncHud]);

  return {
    toggleBuddy,
    cycleModuleMode,
    cycleHeaterMode,
    upgradeInsulation,
    openSoulMinigame,
    repairStageClear,
    repairFail,
    radarScan,
    interactDeposit,
    printPart,
    repairSuit,
    toggleRover,
    collectSite,
    toggleFuelPlant,
    abortSoulMinigame,
    plantSeedInBed,
    handleBedPrimary,
    handleBedSecondary,
    startLab,
    triggerInteract,
    beginRun,
    startSolSimulation,
    continueRun,
    resetCampaign,
    finishRun,
    resolveDecision,
    skipMission,
    switchCrew,
  };
}
