import { useCallback, useEffect, useRef, useState } from 'react';
import { BlueprintPlanner } from './components/BlueprintPlanner';
import { CharacterGallery3D } from './components/CharacterGallery3D';
import { CityMap3D } from './components/CityMap3D';
import { GameHud, type MinimapPlayerPose } from './components/GameHud';
import { GameStage3D } from './components/GameStage3D';
import { HeistCityMapModal } from './components/HeistCityMapModal';
import { StatusModals } from './components/StatusModals';
import { TitleCityStage3D } from './components/TitleCityStage3D';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import type { CharacterId3D } from './game/characters3d';
import type { CityMapFootprint } from './game/cityMap2d';
import { getLevelCityAnchor } from './game/cityMapData';
import {
  createLevelRuntime,
  extractHudSnapshot,
  stepSimulation,
  type InputState,
} from './game/engine';
import {
  canDeployLevel,
  clampHighestUnlocked,
  clampRequestedLevel,
  getUnlockedLevelAfterCompletion,
} from './game/progression';
import type {
  AppScreenState,
  CrewId,
  HudSnapshot,
  LevelRuntime,
  RoleAssignment,
} from './game/types';

const PROGRESS_KEY = 'shadows_gears_highest_level_v1';

function loadHighestLevel(): number {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? parseInt(raw, 10) : 1;
    return clampHighestUnlocked(parsed);
  } catch {
    return 1;
  }
}

const VALID_CHARACTERS_3D: CharacterId3D[] = [
  'roman',
  'john',
  'brock',
  'randy',
  'shasha',
  'pablo',
  'shamus',
];

const VALID_CREW_IDS: CrewId[] = ['roman', 'brock', 'john', 'randy'];

function getInitialCharacter3D(): CharacterId3D {
  const raw = new URLSearchParams(window.location.search).get('character')?.toLowerCase();
  return VALID_CHARACTERS_3D.includes(raw as CharacterId3D) ? (raw as CharacterId3D) : 'john';
}

function getInitialLeadCrew(): CrewId {
  const raw = new URLSearchParams(window.location.search).get('crew')?.toLowerCase();
  return VALID_CREW_IDS.includes(raw as CrewId) ? (raw as CrewId) : 'roman';
}

export default function App() {
  const [showCharacters3D, setShowCharacters3D] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'characters';
  });
  const [showCityMap, setShowCityMap] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'map';
  });
  const [initialCharacter3D] = useState<CharacterId3D>(() => getInitialCharacter3D());
  const [leadCrew, setLeadCrew] = useState<CrewId>(() => getInitialLeadCrew());

  const [screenState, setScreenState] = useState<AppScreenState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });

  const initialUnlocked = loadHighestLevel();
  const [highestUnlocked, setHighestUnlocked] = useState<number>(initialUnlocked);
  const highestUnlockedRef = useRef<number>(initialUnlocked);
  const [muted, setMuted] = useState(false);
  const [cameraMode, setCameraMode] = useState<'3d' | 'top'>('3d');
  const cameraModeRef = useRef<'3d' | 'top'>('3d');
  cameraModeRef.current = cameraMode;
  const cameraYawRef = useRef<number>(0);
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [roleAssignment, setRoleAssignment] = useState<RoleAssignment>({
    plateA: 'roman',
    plateB: 'brock',
    driver: 'randy',
  });

  const initialLevelId = (() => {
    const params = new URLSearchParams(window.location.search);
    const lvl = parseInt(params.get('level') || '1', 10);
    return clampRequestedLevel(lvl, initialUnlocked);
  })();

  const [titleFocusedLevel, setTitleFocusedLevel] = useState<number>(initialLevelId);
  const [titleCityNight, setTitleCityNight] = useState<boolean>(
    () => getLevelCityAnchor(initialLevelId).defaultNight
  );
  const [cityMapStartLocId, setCityMapStartLocId] = useState<number>(
    () => getLevelCityAnchor(initialLevelId).locationId
  );

  const [cityNight, setCityNight] = useState<boolean>(
    () => getLevelCityAnchor(initialLevelId).defaultNight
  );
  const [showHeistMapModal, setShowHeistMapModal] = useState(false);
  const [cityMapFromHeist, setCityMapFromHeist] = useState(false);
  const [cityFootprints, setCityFootprints] = useState<CityMapFootprint[] | null>(null);

  const runtimeRef = useRef<LevelRuntime>(
    createLevelRuntime(initialLevelId, roleAssignment, getInitialLeadCrew())
  );

  const [hud, setHud] = useState<HudSnapshot>(() =>
    extractHudSnapshot(runtimeRef.current)
  );

  const screenStateRef = useRef<AppScreenState>(screenState);
  screenStateRef.current = screenState;

  const showCharacters3DRef = useRef<boolean>(showCharacters3D);
  showCharacters3DRef.current = showCharacters3D;

  const showCityMapRef = useRef<boolean>(showCityMap);
  showCityMapRef.current = showCityMap;

  const showHeistMapModalRef = useRef<boolean>(showHeistMapModal);
  showHeistMapModalRef.current = showHeistMapModal;

  const keysRef = useRef<Set<string>>(new Set());
  const justPressedRef = useRef<{
    action: boolean;
    switchCrew: boolean;
    fire: boolean;
  }>({
    action: false,
    switchCrew: false,
    fire: false,
  });
  const aimRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  const clearInputs = useCallback(() => {
    keysRef.current.clear();
    justPressedRef.current.action = false;
    justPressedRef.current.switchCrew = false;
    justPressedRef.current.fire = false;
  }, []);

  const unlockLevel = useCallback((lvl: number) => {
    const clamped = clampHighestUnlocked(lvl);
    const next = Math.max(highestUnlockedRef.current, clamped);
    highestUnlockedRef.current = next;
    try {
      localStorage.setItem(PROGRESS_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    setHighestUnlocked(next);
  }, []);

  const startLevel = useCallback(
    (levelId: number, overrideRoles?: RoleAssignment, overrideLead?: CrewId) => {
      if (!canDeployLevel(levelId, highestUnlockedRef.current)) {
        return;
      }
      const roles = overrideRoles ?? roleAssignment;
      const crew = overrideLead ?? leadCrew;
      clearInputs();
      const activeEl = document.activeElement as HTMLElement | null;
      activeEl?.blur?.();
      runtimeRef.current = createLevelRuntime(levelId, roles, crew);
      setCityNight(getLevelCityAnchor(levelId).defaultNight);
      setShowHeistMapModal(false);
      setCityMapFromHeist(false);
      setRuntimeVersion((v) => v + 1);
      setHud(extractHudSnapshot(runtimeRef.current));
      setScreenState('playing');
      screenStateRef.current = 'playing';
      document.body.dataset.state = 'playing';
    },
    [clearInputs, leadCrew, roleAssignment]
  );

  const getMinimapPlayer = useCallback((): MinimapPlayerPose | null => {
    const rt = runtimeRef.current;
    const anchor = getLevelCityAnchor(rt.levelId);
    if (rt.config.mode === 'highway_chase') {
      return {
        x: anchor.anchorX + (rt.playerCarX - 500) * 0.032,
        z: anchor.anchorZ + (rt.playerCarY - 310) * 0.032,
        face: 0,
      };
    }
    const activeP = rt.players[rt.activePlayerIndex];
    if (!activeP) return null;
    return {
      x: anchor.anchorX + (activeP.x - 500) * 0.032,
      z: anchor.anchorZ + (activeP.y - 310) * 0.032,
      face: Math.PI / 2 - activeP.angle,
    };
  }, []);

  const handleConfirmPlan = useCallback(
    (roles: RoleAssignment) => {
      setRoleAssignment(roles);
      const next = getUnlockedLevelAfterCompletion(highestUnlockedRef.current, 3);
      unlockLevel(next);
      startLevel(4, roles);
    },
    [startLevel, unlockLevel]
  );

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMute();
    setMuted(next);
  }, []);

  const handlePauseToggle = useCallback(() => {
    const current = screenStateRef.current;
    if (current === 'playing') {
      clearInputs();
      setScreenState('paused');
      screenStateRef.current = 'paused';
      document.body.dataset.state = 'paused';
    } else if (current === 'paused') {
      clearInputs();
      setScreenState('playing');
      screenStateRef.current = 'playing';
      document.body.dataset.state = 'playing';
    }
  }, [clearInputs]);

  const handleRestartLevel = useCallback(() => {
    startLevel(runtimeRef.current.levelId);
  }, [startLevel]);

  const handleNextLevel = useCallback(() => {
    const rt = runtimeRef.current;
    if (rt.outcome !== 'victory' && rt.outcome !== 'cutscene') {
      return;
    }
    const nextUnlocked = getUnlockedLevelAfterCompletion(
      highestUnlockedRef.current,
      rt.levelId
    );
    unlockLevel(nextUnlocked);
    const nextId = Math.min(10, rt.levelId + 1);
    startLevel(nextId);
  }, [startLevel, unlockLevel]);

  const handleReturnTitle = useCallback(() => {
    clearInputs();
    setScreenState('title');
    screenStateRef.current = 'title';
    document.body.dataset.state = 'title';
  }, [clearInputs]);

  const handleRestartLevels = useCallback(() => {
    clearInputs();
    highestUnlockedRef.current = 1;
    try {
      localStorage.setItem(PROGRESS_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setHighestUnlocked(1);
    setTitleFocusedLevel(1);
    setTitleCityNight(getLevelCityAnchor(1).defaultNight);
    if (screenStateRef.current !== 'title') {
      startLevel(1);
    }
  }, [clearInputs, startLevel]);

  // Mirror screenState to body dataset
  useEffect(() => {
    document.body.dataset.state = showCharacters3D
      ? 'characters3d'
      : showCityMap
        ? 'citymap'
        : screenState;
  }, [screenState, showCharacters3D, showCityMap]);

  // Global keyboard & pointer-blur listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (showCharacters3DRef.current || showCityMapRef.current) {
        return;
      }

      const st = screenStateRef.current;
      if (st === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startLevel(highestUnlockedRef.current);
        return;
      }

      if (e.code === 'Escape' && showHeistMapModalRef.current) {
        e.preventDefault();
        clearInputs();
        setShowHeistMapModal(false);
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (st === 'playing' || st === 'paused') {
          e.preventDefault();
          handlePauseToggle();
        }
        return;
      }

      if (e.code === 'KeyM' && (st === 'playing' || st === 'paused')) {
        e.preventDefault();
        clearInputs();
        setShowHeistMapModal((prev) => !prev);
        return;
      }

      if (e.code === 'KeyN' && (st === 'playing' || st === 'paused')) {
        e.preventDefault();
        setCityNight((prev) => !prev);
        return;
      }

      if (e.code === 'KeyC' && (st === 'playing' || st === 'paused')) {
        e.preventDefault();
        setCameraMode((prev) => (prev === '3d' ? 'top' : '3d'));
        return;
      }

      if (e.code === 'KeyV') {
        handleToggleMute();
        return;
      }

      if (e.code === 'KeyR' && st === 'playing' && !showHeistMapModalRef.current) {
        e.preventDefault();
        handleRestartLevel();
        return;
      }

      if (st !== 'playing' || showHeistMapModalRef.current) return;

      if (e.code === 'Tab' || e.code === 'KeyQ') {
        e.preventDefault();
        justPressedRef.current.switchCrew = true;
      }

      if (e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        if (!keysRef.current.has(e.code)) {
          justPressedRef.current.action = true;
        }
      }

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onBlur = () => clearInputs();
    const onVis = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [clearInputs, handlePauseToggle, handleRestartLevel, handleToggleMute, startLevel]);

  const lastHudSyncRef = useRef(0);

  const stepGameplayFrame = useCallback(
    (rawDt: number) => {
      const rt = runtimeRef.current;
      if (
        screenStateRef.current !== 'playing' ||
        showHeistMapModalRef.current ||
        showCityMapRef.current
      ) {
        return;
      }

      const keys = keysRef.current;
      const rawUp = keys.has('KeyW') || keys.has('ArrowUp');
      const rawDown = keys.has('KeyS') || keys.has('ArrowDown');
      const rawLeft = keys.has('KeyA') || keys.has('ArrowLeft');
      const rawRight = keys.has('KeyD') || keys.has('ArrowRight');

      let moveVecX: number | undefined;
      let moveVecY: number | undefined;
      if (cameraModeRef.current === '3d' && rt.config.mode !== 'highway_chase') {
        const f = (rawUp ? 1 : 0) - (rawDown ? 1 : 0);
        const s = (rawRight ? 1 : 0) - (rawLeft ? 1 : 0);
        if (f !== 0 || s !== 0) {
          const yaw = cameraYawRef.current;
          const fx = -Math.sin(yaw);
          const fz = -Math.cos(yaw);
          const rx = Math.cos(yaw);
          const rz = -Math.sin(yaw);
          moveVecX = fx * f + rx * s;
          moveVecY = fz * f + rz * s;
        }
      }

      const input: InputState = {
        up: rawUp,
        down: rawDown,
        left: rawLeft,
        right: rawRight,
        moveVecX,
        moveVecY,
        actionJustPressed: justPressedRef.current.action,
        actionHeld: keys.has('Space') || keys.has('KeyE'),
        switchJustPressed: justPressedRef.current.switchCrew,
        aimX: aimRef.current.x,
        aimY: aimRef.current.y,
        fireJustPressed: justPressedRef.current.fire,
      };

      justPressedRef.current.action = false;
      justPressedRef.current.switchCrew = false;
      justPressedRef.current.fire = false;

      const ev = stepSimulation(rt, rawDt, input);

      if (ev.step) soundEngine.playStep();
      if (ev.spotted) soundEngine.playAlert();
      if (ev.shutter) soundEngine.playShutter();
      if (ev.pickup) soundEngine.playPickup();
      if (ev.vaultOpened) soundEngine.playVaultOpen();
      if (ev.shot) soundEngine.playShot();
      if (ev.crash) soundEngine.playCrash();

      const now = performance.now();
      if (ev.victory) {
        soundEngine.playVictory();
        const nextUnlocked = getUnlockedLevelAfterCompletion(
          highestUnlockedRef.current,
          rt.levelId
        );
        unlockLevel(nextUnlocked);
        setScreenState('gameover');
        screenStateRef.current = 'gameover';
        document.body.dataset.state = 'gameover';
        setHud(extractHudSnapshot(rt));
      } else if (ev.defeat) {
        if (rt.outcome === 'cutscene') {
          const nextUnlocked = getUnlockedLevelAfterCompletion(
            highestUnlockedRef.current,
            rt.levelId
          );
          unlockLevel(nextUnlocked);
        }
        soundEngine.playDefeat();
        setScreenState('gameover');
        screenStateRef.current = 'gameover';
        document.body.dataset.state = 'gameover';
        setHud(extractHudSnapshot(rt));
      } else if (now - lastHudSyncRef.current > 120) {
        lastHudSyncRef.current = now;
        const nextHud = extractHudSnapshot(rt);
        setHud((prev) => {
          if (
            prev.levelId === nextHud.levelId &&
            prev.objectiveText === nextHud.objectiveText &&
            Math.round(prev.objectiveProgress * 100) === Math.round(nextHud.objectiveProgress * 100) &&
            prev.timerRemaining === nextHud.timerRemaining &&
            prev.spottedCount === nextHud.spottedCount &&
            prev.bagsDelivered === nextHud.bagsDelivered &&
            prev.activeCrewName === nextHud.activeCrewName &&
            prev.playerHp === nextHud.playerHp &&
            prev.bossHp === nextHud.bossHp &&
            prev.dialogue?.text === nextHud.dialogue?.text &&
            prev.outcome === nextHud.outcome
          ) {
            return prev;
          }
          return nextHud;
        });
      }
    },
    [unlockLevel]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090B10]">
      {screenState === 'title' && !showCharacters3D && !showCityMap && (
        <TitleCityStage3D
          focusedLevelId={titleFocusedLevel}
          cityNight={titleCityNight}
          onFootprintsReady={setCityFootprints}
        />
      )}

      {screenState !== 'title' && !showCharacters3D && !showCityMap && (
        <GameStage3D
          runtimeRef={runtimeRef}
          runtimeVersion={runtimeVersion}
          cityNight={cityNight}
          cameraMode={cameraMode}
          cameraYawRef={cameraYawRef}
          screenStateRef={screenStateRef}
          aimRef={aimRef}
          onCityFootprintsReady={setCityFootprints}
          onStepFrame={stepGameplayFrame}
          onFire={() => {
            justPressedRef.current.fire = true;
          }}
        />
      )}

      {screenState === 'title' && !showCharacters3D && !showCityMap && (
        <TitleScreen
          highestUnlocked={highestUnlocked}
          focusedLevelId={titleFocusedLevel}
          cityNight={titleCityNight}
          cityFootprints={cityFootprints}
          leadCrew={leadCrew}
          onSelectFocusedLevel={(lvl) => {
            setTitleFocusedLevel(lvl);
            setTitleCityNight(getLevelCityAnchor(lvl).defaultNight);
          }}
          onToggleCityNight={() => setTitleCityNight((prev) => !prev)}
          onSelectLeadCrew={setLeadCrew}
          onStartLevel={(lvl) => startLevel(lvl)}
          onRestartLevels={handleRestartLevels}
          onOpenCharacters={() => {
            clearInputs();
            setShowCharacters3D(true);
          }}
          onOpenCityMap={(locId) => {
            clearInputs();
            setCityMapStartLocId(locId ?? getLevelCityAnchor(titleFocusedLevel).locationId);
            setCityMapFromHeist(false);
            setShowCityMap(true);
          }}
        />
      )}

      {showCityMap && (
        <CityMap3D
          leadCrew={leadCrew}
          highestUnlocked={highestUnlocked}
          initialLocationId={
            cityMapFromHeist ? getLevelCityAnchor(hud.levelId).locationId : cityMapStartLocId
          }
          initialNight={cityMapFromHeist ? cityNight : titleCityNight}
          hasActiveHeist={cityMapFromHeist}
          onResumeHeist={() => {
            clearInputs();
            setShowCityMap(false);
            setCityMapFromHeist(false);
          }}
          onBackToTitle={() => {
            clearInputs();
            setShowCityMap(false);
            setCityMapFromHeist(false);
          }}
          onDeployLevel={(lvl) => {
            if (!canDeployLevel(lvl, highestUnlockedRef.current)) return;
            clearInputs();
            setShowCityMap(false);
            setCityMapFromHeist(false);
            startLevel(lvl);
          }}
          onRestartLevels={handleRestartLevels}
        />
      )}

      {showCharacters3D && (
        <CharacterGallery3D
          initialCharacter={initialCharacter3D}
          onBackToTitle={() => {
            clearInputs();
            setShowCharacters3D(false);
          }}
        />
      )}

      {screenState !== 'title' && !showCharacters3D && !showCityMap && (
        <GameHud
          hud={hud}
          muted={muted}
          cityNight={cityNight}
          cameraMode={cameraMode}
          highestUnlocked={highestUnlocked}
          cityFootprints={cityFootprints}
          getMinimapPlayer={getMinimapPlayer}
          onToggleMute={handleToggleMute}
          onToggleNight={() => setCityNight((prev) => !prev)}
          onToggleCameraMode={() => setCameraMode((prev) => (prev === '3d' ? 'top' : '3d'))}
          onOpenCityMap={() => {
            clearInputs();
            setShowHeistMapModal(true);
          }}
          onPause={handlePauseToggle}
          onRestart={handleRestartLevel}
        />
      )}

      {screenState === 'playing' &&
        !showCharacters3D &&
        !showCityMap &&
        !showHeistMapModal &&
        hud.levelId === 3 && (
          <BlueprintPlanner
            initialRoles={roleAssignment}
            onConfirmPlan={handleConfirmPlan}
          />
        )}

      {!showCharacters3D && !showCityMap && (
        <HeistCityMapModal
          isOpen={showHeistMapModal}
          hud={hud}
          highestUnlocked={highestUnlocked}
          cityNight={cityNight}
          cityFootprints={cityFootprints}
          getMinimapPlayer={getMinimapPlayer}
          onClose={() => {
            clearInputs();
            setShowHeistMapModal(false);
          }}
          onToggleNight={() => setCityNight((prev) => !prev)}
          onOpenFreeRoam3D={() => {
            clearInputs();
            setShowHeistMapModal(false);
            setCityMapFromHeist(true);
            setShowCityMap(true);
          }}
          onSwitchLevel={(lvl) => {
            startLevel(lvl);
          }}
        />
      )}

      {!showCharacters3D && !showCityMap && !showHeistMapModal && (
        <StatusModals
          screenState={screenState}
          hud={hud}
          onResume={handlePauseToggle}
          onRestart={handleRestartLevel}
          onRestartLevels={handleRestartLevels}
          onNextLevel={handleNextLevel}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
