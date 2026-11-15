// Main app component - handles game loop, keyboard inputs, and modals
import { useCallback, useEffect, useRef, useState } from 'react';
import { IntroSplash } from './components/IntroSplash';
import { GameModals } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { ScienceModal } from './components/ScienceModal';
import { RepairModal } from './components/RepairModal';
import { SuitDamageOverlay } from './components/SuitDamageOverlay';
import { DecisionModal } from './components/DecisionModal';
import { DialogueBox } from './components/DialogueBox';
import { SettingsModal } from './components/SettingsModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { getSettings, setTutorialDone, tutorialDone } from './game/settings';
import { LaunchCinematic } from './components/LaunchCinematic';
import { TouchControls } from './components/TouchControls';
import { sound } from './game/audio';
import { HP_MAX, getLmstFromElapsed } from './game/constants';
import { renderOutpostCanvas } from './game/renderOutpost';
import {
  CampaignMeta,
  loadMeta,
  peekRun,
  saveRun,
} from './game/save';
import { ScoreResult } from './game/score';
import { useGameActions } from './hooks/useGameActions';
import { createSimulation } from './game/engine/simulation';
import { createInitialEngineState } from './game/engine/state';
import { buildHudSnapshot } from './game/engine/selectors';
import { RepairSession } from './game/repairTasks';
import { EngineState, GamePhase, HudSnapshot } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchDirRef = useRef({ up: false, down: false, left: false, right: false });

  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');

  const releaseAllInput = useCallback(() => {
    keysRef.current = {};
    touchDirRef.current = { up: false, down: false, left: false, right: false };
  }, []);
  const [simSpeed, setSimSpeed] = useState<1 | 2>(1);
  const [muted, setMuted] = useState(false);
  const [showScienceModal, setShowScienceModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  // Any overlay that should freeze game time
  const overlayOpen = showScienceModal || showSettings || showTutorial;

  const soulMgRef = useRef<RepairSession | null>(null);
  // How the active repair session was opened (preventive check vs. full repair, part spent)
  const [meta, setMeta] = useState<CampaignMeta>(() => loadMeta());
  const [savedRun, setSavedRun] = useState(() => peekRun());
  const [finalScore, setFinalScore] = useState<ScoreResult | null>(null);
  const [newUnlock, setNewUnlock] = useState<{ name: string; desc: string } | null>(null);
  const [showCinematic, setShowCinematic] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const repairCtxRef = useRef<{ preventive: boolean; usedPart: boolean }>({
    preventive: false,
    usedPart: false,
  });
  const [activeSoulView, setActiveSoulView] = useState<RepairSession | null>(null);

  const engineRef = useRef<EngineState>(createInitialEngineState(1));
  const repairOpen = Boolean(activeSoulView);
  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(engineRef.current));

  const decisionId = hud.decision?.id ?? null;
  useEffect(() => {
    // Opening or closing a menu, a repair or a decision starts movement from a clean slate
    releaseAllInput();
  }, [phase, repairOpen, decisionId, releaseAllInput]);

  const syncHud = useCallback(() => {
    setHud(buildHudSnapshot(engineRef.current));
    const mg = soulMgRef.current;
    if (mg && mg.active) {
      setActiveSoulView({ ...mg });
    } else {
      setActiveSoulView(null);
    }
  }, []);

  const addLog = useCallback((text: string, tone: 'info' | 'warning' | 'success' = 'info') => {
    const eng = engineRef.current;
    const lmst = getLmstFromElapsed(eng.elapsedSolSec);
    eng.scienceLog = [{ time: lmst.formatted, text, tone }, ...eng.scienceLog.slice(0, 14)];
  }, []);

  const actions = useGameActions({
    engineRef, soulMgRef, repairCtxRef, setActiveSoulView, addLog, syncHud, phase, setPhase,
    setMeta, setSavedRun, setFinalScore, setNewUnlock, setShowCinematic, meta,
  });
  const {
    cycleModuleMode,
    cycleHeaterMode,
    upgradeInsulation,
    repairStageClear,
    repairFail,
    radarScan,
    printPart,
    toggleRover,
    toggleFuelPlant,
    abortSoulMinigame,
    handleBedSecondary,
    triggerInteract,
    startSolSimulation,
    continueRun,
    resetCampaign,
    finishRun,
    resolveDecision,
    skipMission,
    switchCrew,
    toggleBuddy,
  } = actions;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      const inMinigame = Boolean(soulMgRef.current?.active);

      if (e.code === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else if (showScienceModal) {
          setShowScienceModal(false);
        } else if (inMinigame) {
          abortSoulMinigame();
        } else if (phase === 'PLAYING') {
          setPhase('PAUSED');
        } else if (phase === 'PAUSED') {
          setPhase('PLAYING');
        }
        return;
      }

      if (phase === 'PLAYING' && !overlayOpen) {
        if (e.code === 'Digit1' && !inMinigame) cycleModuleMode('o2');
        else if (e.code === 'Digit2' && !inMinigame) cycleModuleMode('power');
        else if (e.code === 'Digit3' && !inMinigame) cycleModuleMode('food');
        else if (e.code === 'Digit4' && !inMinigame) cycleModuleMode('shield');
        else if (e.code === 'Digit5' && !inMinigame) cycleHeaterMode();
        else if (e.code === 'KeyU' && !inMinigame) upgradeInsulation();
        else if (e.code === 'KeyF' && !inMinigame) handleBedSecondary();
        else if (e.code === 'KeyR' && !inMinigame) radarScan();
        else if (e.code === 'KeyP' && !inMinigame) printPart();
        else if (e.code === 'KeyG' && !inMinigame) toggleFuelPlant();
        else if (e.code === 'KeyV' && !inMinigame) toggleRover();
        else if (e.code === 'KeyC' && !inMinigame) switchCrew();
        else if (e.code === 'KeyB' && !inMinigame) toggleBuddy();
        else if (e.code === 'KeyK' && !inMinigame) skipMission();
        else if ((e.code === 'KeyE' || e.code === 'Space') && !inMinigame) {
          e.preventDefault();
          triggerInteract();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    // If the page loses focus while a key is held (clicking outside the game, switching
    // tabs or windows), the browser never sends the key-up and the astronaut keeps walking.
    // Release everything whenever focus or visibility is lost.
    const onBlur = () => releaseAllInput();
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') releaseAllInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('contextmenu', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('contextmenu', onBlur);
    };
  }, [
    releaseAllInput,
    abortSoulMinigame,
    cycleHeaterMode,
    cycleModuleMode,
    handleBedSecondary,
    phase,
    printPart,
    radarScan,
    showScienceModal,
    showSettings,
    overlayOpen,
    toggleFuelPlant,
    toggleRover,
    switchCrew,
    toggleBuddy,
    skipMission,
    triggerInteract,
    upgradeInsulation,
  ]);

  useEffect(() => {
    const onResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;
    let saveTimer = 0;

    const updateSimulation = createSimulation({
      phase, keysRef, touchDirRef, soulMgRef, showScienceModal: overlayOpen, simSpeed, addLog, syncHud,
      setPhase, setActiveSoulView, finishRun,
    });

    const tick = (nowMs: number) => {
      const rawDt = Math.min((nowMs - lastTime) / 1000, 0.08);
      lastTime = nowMs;

      const eng = engineRef.current;
      updateSimulation(eng, rawDt);

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderOutpostCanvas(ctx, canvasRef.current.width, canvasRef.current.height, eng, nowMs);
        }
      }

      // Ambient music, wind and suit breathing follow what is happening
      if (phase === 'PLAYING') {
        const lm = getLmstFromElapsed(eng.elapsedSolSec);
        sound.updateAmbient({
          outside: eng.player.inEvaSuit,
          onFoot: eng.player.inEvaSuit && !eng.player.inRover,
          storm: eng.activeEvent.kind === 'DUST_STORM_2018',
          night: lm.isNight,
          danger: eng.resources.hp < HP_MAX * 0.35 || eng.cold > 70,
        });
        saveTimer += rawDt;
        if (saveTimer >= 4) {
          saveTimer = 0;
          saveRun(eng);
        }
      } else {
        sound.updateAmbient(null);
      }

      hudTimer += rawDt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        if (phase === 'PLAYING') {
          syncHud();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [addLog, finishRun, phase, overlayOpen, simSpeed, syncHud]);

  // Apply saved volume settings once
  useEffect(() => {
    sound.setVolumes(getSettings());
  }, []);

  // First time someone plays, show the short tutorial
  useEffect(() => {
    if (phase === 'PLAYING' && !tutorialDone()) setShowTutorial(true);
  }, [phase]);


  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a0a06] text-slate-100 select-none font-sans">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Critical Suit Damage: Foggy Condensation + Cracked Helmet Visor */}
      {phase === 'PLAYING' && (
        <SuitDamageOverlay
          hp={hud.inEvaSuit && !hud.inRover ? Math.min(hud.crew[hud.activeCrew]?.hp ?? 100, hud.suit) : 100}
        />
      )}

      {phase !== 'TITLE_MENU' && (
        <HudOverlay
          hud={hud}
          simSpeed={simSpeed}
          muted={muted}
          hasActiveMaintenance={Boolean(activeSoulView)}
          onToggleSimSpeed={() => setSimSpeed((s) => (s === 1 ? 2 : 1))}
          onOpenScience={() => setShowScienceModal(true)}
          onOpenSettings={() => setShowSettings(true)}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            sound.setMuted(next);
          }}
          onTogglePause={() => setPhase((p) => (p === 'PLAYING' ? 'PAUSED' : 'PLAYING'))}
          onCycleMode={cycleModuleMode}
          onCycleHeaterMode={cycleHeaterMode}
          onUpgradeInsulation={upgradeInsulation}
          onTriggerInteract={triggerInteract}
          onBedSecondaryAction={handleBedSecondary}
          onRadarScan={radarScan}
          onPrintPart={printPart}
          onToggleFuelPlant={toggleFuelPlant}
          onToggleRover={toggleRover}
          onSkipMission={skipMission}
          onSwitchCrew={switchCrew}
          onToggleBuddy={toggleBuddy}
        />
      )}

      {phase === 'PLAYING' && !activeSoulView && (
        <TouchControls
          canInteract={Boolean(hud.nearbyModule || hud.nearbyBed || hud.nearbySite || (hud.nearbyDeposit && hud.inEvaSuit))}
          onMoveDir={(dir, active) => {
            touchDirRef.current[dir] = active;
          }}
          onInteract={triggerInteract}
        />
      )}

      {phase === 'PLAYING' && activeSoulView && (
        <RepairModal
          session={activeSoulView}
          onStageClear={repairStageClear}
          onFail={repairFail}
          onAbort={abortSoulMinigame}
        />
      )}

      {phase === 'PLAYING' && hud.decision && !activeSoulView && (
        <DecisionModal decision={hud.decision} onChoose={resolveDecision} />
      )}

      {phase === 'PLAYING' && hud.dialogueLine && !activeSoulView && (
        <DialogueBox line={hud.dialogueLine} crew={hud.crew} />
      )}

      {showScienceModal && <ScienceModal onClose={() => setShowScienceModal(false)} />}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          simSpeed={simSpeed}
          onToggleSimSpeed={() => setSimSpeed((v) => (v === 1 ? 2 : 1))}
          onReplayTutorial={() => {
            setTutorialDone(false);
            setShowSettings(false);
            if (phase === 'PLAYING') setShowTutorial(true);
          }}
        />
      )}

      {showTutorial && phase === 'PLAYING' && (
        <TutorialOverlay
          onDone={() => {
            setTutorialDone(true);
            setShowTutorial(false);
          }}
        />
      )}

      {phase === 'VICTORY' && showCinematic && (
        <LaunchCinematic
          discoveries={hud.discoveries}
          science={hud.science}
          samples={hud.samplesCollected}
          onDone={() => setShowCinematic(false)}
        />
      )}

      <GameModals
        phase={phase === 'VICTORY' && showCinematic ? 'PLAYING' : phase}
        hud={hud}
        onStart={startSolSimulation}
        onContinue={continueRun}
        onResetCampaign={resetCampaign}
        savedRun={savedRun}
        meta={meta}
        score={finalScore}
        newUnlock={newUnlock}
        onResume={() => setPhase('PLAYING')}
        onRestart={startSolSimulation}
        onOpenSettings={() => setShowSettings(true)}
        onOpenScience={() => setShowScienceModal(true)}
      />

      {showSplash && <IntroSplash onDone={() => setShowSplash(false)} />}
    </div>
  );
}
