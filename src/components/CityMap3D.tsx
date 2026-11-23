import { ArrowLeft, Copy, Lock, Map as MapIcon, Moon, Play, RotateCcw, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildGameplayCharacter3D, disposeCharacterRig } from '../game/characters3d';
import { buildCityWorld, type RuntimeCityLocation } from '../game/cityBuilder3d';
import { drawCityMap2D, findCityLocationAtNormalizedCoord } from '../game/cityMap2d';
import {
  CITY_LOCATIONS,
  CITY_MAP_LAYOUT,
  getLevelCityAnchor,
  type CityLocationSpec,
} from '../game/cityMapData';
import { CREW_ROSTER, LEVEL_CONFIGS } from '../game/levels';
import { canDeployLevel, getLevelLockMessage } from '../game/progression';
import type { CrewId } from '../game/types';

interface CityMap3DProps {
  leadCrew: CrewId;
  highestUnlocked: number;
  initialLocationId?: number;
  initialNight?: boolean;
  hasActiveHeist?: boolean;
  onResumeHeist?: () => void;
  onBackToTitle: () => void;
  onDeployLevel: (levelId: number) => void;
  onRestartLevels?: () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function CityMap3D({
  leadCrew,
  highestUnlocked,
  initialLocationId = 1,
  initialNight = false,
  hasActiveHeist = false,
  onResumeHeist,
  onBackToTitle,
  onDeployLevel,
  onRestartLevels,
}: CityMap3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coordsRef = useRef<HTMLDivElement | null>(null);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const jumpBtnRef = useRef<HTMLButtonElement | null>(null);

  const [isNight, setIsNight] = useState(initialNight);
  const [bigMapOpen, setBigMapOpen] = useState(false);
  const [nearLoc, setNearLoc] = useState<CityLocationSpec | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [copyJsonText, setCopyJsonText] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'levels' | 'districts'>(
    hasActiveHeist ? 'districts' : 'levels'
  );
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);

  const bigMapOpenRef = useRef(bigMapOpen);
  bigMapOpenRef.current = bigMapOpen;

  const nightRef = useRef(isNight);
  nightRef.current = isNight;

  const highestUnlockedRef = useRef(highestUnlocked);
  highestUnlockedRef.current = highestUnlocked;

  const initialLocationIdRef = useRef(initialLocationId);
  initialLocationIdRef.current = initialLocationId;

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg('');
    }, 1800);
  }, []);

  const teleportFnRef = useRef<((locId: number) => void) | null>(null);
  const setNightFnRef = useRef<((night: boolean) => void) | null>(null);
  const layoutJsonFnRef = useRef<(() => string) | null>(null);
  const drawBigMapFnRef = useRef<(() => void) | null>(null);
  const jumpTriggerRef = useRef<boolean>(false);

  const onExitRef = useRef(hasActiveHeist && onResumeHeist ? onResumeHeist : onBackToTitle);
  onExitRef.current = hasActiveHeist && onResumeHeist ? onResumeHeist : onBackToTitle;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setIsTouchDevice(window.matchMedia('(pointer:coarse)').matches);
    }
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (bigMapOpen) {
      drawBigMapFnRef.current?.();
    }
  }, [bigMapOpen]);

  useEffect(() => {
    const mount = mountRef.current;
    const labelsEl = labelsRef.current;
    if (!mount || !labelsEl) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.setAttribute('data-testid', 'city-map-canvas');
    mount.appendChild(renderer.domElement);

    const gl = renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 1200);
    const maxAniso = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();

    const cityWorld = buildCityWorld({
      scene,
      renderer,
      isSoftwareGl,
      maxAniso,
      labelsEl,
      initialNight: nightRef.current,
      suppressMarkers: false,
      shadowExtent: 85,
    });

    /* ================= player rig (active crew character) ================= */
    const player = new THREE.Group();
    scene.add(player);
    const playerRig = buildGameplayCharacter3D(leadCrew, maxAniso);
    playerRig.group.scale.setScalar(1.22);
    player.add(playerRig.group);
    player.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = !isSoftwareGl;
    });

    const P = {
      x: -150,
      y: 0,
      z: 7,
      vy: 0,
      onGround: true,
      face: Math.PI,
      phase: 0,
      safe: [-150, 0, 7] as [number, number, number],
    };
    const CAM = { yaw: 0, pitch: 0.38, dist: 10 };

    let nearId = 0;
    let activeTeleportLoc: RuntimeCityLocation | null = null;
    function teleportTo(loc: RuntimeCityLocation) {
      P.x = loc.spawn.x;
      P.z = loc.spawn.z;
      P.y = cityWorld.groundAt(loc.spawn.x, loc.spawn.z) + 0.05;
      P.vy = 0;
      const dx = loc.marker.x - loc.spawn.x;
      const dz = loc.marker.z - loc.spawn.z;
      if (dx || dz) {
        CAM.yaw = Math.atan2(-dx, -dz);
        P.face = Math.atan2(dx, dz);
      }
      activeTeleportLoc = loc;
      nearId = loc.id;
      setNearLoc(loc);
      showToast(`${loc.id}. ${loc.name}`);
    }

    teleportFnRef.current = (locId: number) => {
      const target = cityWorld.runtimeLocs.find((l) => l.id === locId);
      if (target) teleportTo(target);
    };

    const applyNightMode = (n: boolean) => {
      nightRef.current = n;
      setIsNight(n);
      cityWorld.setNight(n);
    };
    setNightFnRef.current = applyNightMode;
    layoutJsonFnRef.current = cityWorld.getLayoutJson;

    /* ================= input handlers ================= */
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keys[e.code] = true;
      if (e.code === 'KeyM') {
        setBigMapOpen((prev) => !prev);
      } else if (e.code === 'KeyN') {
        applyNightMode(!nightRef.current);
      } else if (e.code === 'Escape') {
        if (bigMapOpenRef.current) {
          setBigMapOpen(false);
        } else {
          onExitRef.current();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    const onBlur = () => {
      for (const k of Object.keys(keys)) keys[k] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let look: { id: number; x: number; y: number } | null = null;
    let joy: { id: number; x0: number; y0: number; dx: number; dy: number } | null = null;

    const canvas = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) {
        joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
        if (joyRef.current) {
          joyRef.current.style.display = 'block';
          joyRef.current.style.left = `${e.clientX}px`;
          joyRef.current.style.top = `${e.clientY}px`;
        }
      } else {
        look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (joy && e.pointerId === joy.id) {
        let dx = e.clientX - joy.x0;
        let dy = e.clientY - joy.y0;
        const m = Math.hypot(dx, dy);
        if (m > 50) {
          dx *= 50 / m;
          dy *= 50 / m;
        }
        joy.dx = dx;
        joy.dy = dy;
        if (joyKnobRef.current) {
          joyKnobRef.current.style.transform = `translate(${dx}px,${dy}px)`;
        }
      } else if (look && e.pointerId === look.id) {
        CAM.yaw -= (e.clientX - look.x) * 0.005;
        CAM.pitch = Math.max(0.05, Math.min(1.35, CAM.pitch + (e.clientY - look.y) * 0.004));
        look.x = e.clientX;
        look.y = e.clientY;
      }
    };
    const endPtr = (e: PointerEvent) => {
      canvas.style.cursor = 'grab';
      if (joy && e.pointerId === joy.id) {
        joy = null;
        if (joyRef.current) joyRef.current.style.display = 'none';
        if (joyKnobRef.current) joyKnobRef.current.style.transform = '';
      }
      if (look && e.pointerId === look.id) look = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      CAM.dist = Math.max(3.5, Math.min(45, CAM.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    };
    const onCtx = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onCtx);

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    /* ================= loop ================= */
    let last = performance.now();
    let time = 0;
    let safeT = 0;
    let disposed = false;
    let rafId = 0;
    let syncTimerId = 0;

    function afterDraw(cb: () => void) {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      if (isWebGL2) {
        const gl2 = gl as WebGL2RenderingContext;
        const fence = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        let finished = false;
        const check = () => {
          if (disposed || finished) return;
          if (!fence || gl2.getSyncParameter(fence, gl2.SYNC_STATUS) === gl2.SIGNALED) {
            finished = true;
            if (fence) gl2.deleteSync(fence);
            syncTimerId = window.setTimeout(cb, 45);
          } else {
            syncTimerId = window.setTimeout(check, 20);
          }
        };
        syncTimerId = window.setTimeout(check, 25);
      } else {
        syncTimerId = window.setTimeout(cb, 65);
      }
    }

    function update(dt: number) {
      time += dt;
      let f = 0;
      let st = 0;
      if (keys.KeyW || keys.ArrowUp) f += 1;
      if (keys.KeyS || keys.ArrowDown) f -= 1;
      if (keys.KeyD || keys.ArrowRight) st += 1;
      if (keys.KeyA || keys.ArrowLeft) st -= 1;
      if (joy) {
        st += joy.dx / 50;
        f -= joy.dy / 50;
      }
      const fx = -Math.sin(CAM.yaw);
      const fz = -Math.cos(CAM.yaw);
      const rx = Math.cos(CAM.yaw);
      const rz = -Math.sin(CAM.yaw);
      let vx = fx * f + rx * st;
      let vz = fz * f + rz * st;
      const mag = Math.hypot(vx, vz);
      const run = Boolean(
        keys.ShiftLeft || keys.ShiftRight || (joy && Math.hypot(joy.dx, joy.dy) > 45)
      );
      const speed = run ? 13 : 6.5;
      if (mag > 0) {
        if (mag > 1) {
          vx /= mag;
          vz /= mag;
        }
        vx *= speed;
        vz *= speed;
        const nx = P.x + vx * dt;
        if (!cityWorld.blocked(nx, P.z, P.y)) P.x = nx;
        const nz = P.z + vz * dt;
        if (!cityWorld.blocked(P.x, nz, P.y)) P.z = nz;
        let da = Math.atan2(vx, vz) - P.face;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        P.face += da * Math.min(1, dt * 12);
      }
      if ((keys.Space || jumpTriggerRef.current) && P.onGround) {
        P.vy = 9.5;
        P.onGround = false;
      }
      jumpTriggerRef.current = false;
      P.vy -= 26 * dt;
      P.y += P.vy * dt;
      const g = cityWorld.groundAt(P.x, P.z, P.y);
      if (P.y <= g) {
        P.y = g;
        P.vy = 0;
        P.onGround = true;
      } else if (P.onGround && P.y - g < 0.6 && P.vy <= 0) {
        P.y = g;
        P.vy = 0;
      } else {
        P.onGround = false;
      }
      if (P.y < -3) {
        [P.x, P.y, P.z] = P.safe;
        P.vy = 0;
        showToast('Splash! Back on dry land.');
      }
      safeT += dt;
      if (safeT > 0.5 && P.onGround && P.y >= -0.1 && P.z < 163) {
        P.safe = [P.x, P.y, P.z];
        safeT = 0;
      }

      const moving = mag > 0 && P.onGround;
      P.phase += dt * (run ? 13 : 9) * (moving ? 1 : 0);
      playerRig.animate(time, P.phase, moving, false);
      player.position.set(P.x, P.y + (moving ? Math.abs(Math.sin(P.phase)) * 0.04 : 0), P.z);
      player.rotation.y = P.face;

      const tx = P.x;
      const ty = P.y + 1.7;
      const tz = P.z;
      const cdx = Math.sin(CAM.yaw) * Math.cos(CAM.pitch);
      const cdy = Math.sin(CAM.pitch);
      const cdz = Math.cos(CAM.yaw) * Math.cos(CAM.pitch);
      const dist = cityWorld.cameraClipDistance(tx, ty, tz, cdx, cdy, cdz, CAM.dist);
      camera.position.set(
        tx + cdx * dist,
        Math.max(ty + cdy * dist, cityWorld.groundAt(tx + cdx * dist, tz + cdz * dist, 999) + 0.3),
        tz + cdz * dist
      );
      camera.lookAt(tx, ty, tz);

      cityWorld.updateWorld(
        time,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        P.x,
        P.y,
        P.z
      );

      let near: RuntimeCityLocation | null = null;
      let nd = 14;
      for (const L of cityWorld.runtimeLocs) {
        const d = Math.hypot(P.x - L.marker.x, P.z - L.marker.z);
        if (d < nd && Math.abs(P.y - L.gy) < 6) {
          nd = d;
          near = L;
        }
      }
      if (activeTeleportLoc) {
        const distFromSpawn = Math.hypot(
          P.x - activeTeleportLoc.spawn.x,
          P.z - activeTeleportLoc.spawn.z
        );
        if (near || distFromSpawn > 8) {
          activeTeleportLoc = null;
        } else {
          near = activeTeleportLoc;
        }
      }
      if ((near ? near.id : 0) !== nearId) {
        nearId = near ? near.id : 0;
        setNearLoc(near);
      }
      if (coordsRef.current) {
        coordsRef.current.textContent = `x ${P.x.toFixed(1)} · y ${P.y.toFixed(1)} · z ${P.z.toFixed(1)}`;
      }
    }

    const renderMaps = () => {
      const playerObj = { x: P.x, z: P.z, face: P.face };
      const mctx = miniCanvasRef.current?.getContext('2d');
      if (mctx) {
        drawCityMap2D(mctx, cityWorld.mapBgCanvas, 190, {
          full: false,
          player: playerObj,
          activeLocationId: nearId || null,
          highestUnlocked: highestUnlockedRef.current,
          pulseTimeSec: time,
        });
      }
      if (bigMapOpenRef.current) {
        const bctx = bigCanvasRef.current?.getContext('2d');
        if (bctx) {
          drawCityMap2D(bctx, cityWorld.mapBgCanvas, 900, {
            full: true,
            player: playerObj,
            activeLocationId: nearId || null,
            highestUnlocked: highestUnlockedRef.current,
            pulseTimeSec: time,
          });
        }
      }
    };

    function frame() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      renderer.render(scene, camera);
      const w = mount?.clientWidth || window.innerWidth;
      const h = mount?.clientHeight || window.innerHeight;
      cityWorld.updateLabels(camera, w, h);
      renderMaps();
      afterDraw(frame);
    }

    drawBigMapFnRef.current = () => {
      const bctx = bigCanvasRef.current?.getContext('2d');
      if (bctx) {
        drawCityMap2D(bctx, cityWorld.mapBgCanvas, 900, {
          full: true,
          player: { x: P.x, z: P.z, face: P.face },
          activeLocationId: nearId || null,
          highestUnlocked: highestUnlockedRef.current,
          pulseTimeSec: time,
        });
      }
    };

    const startLoc =
      cityWorld.runtimeLocs.find((l) => l.id === initialLocationIdRef.current) ??
      cityWorld.runtimeLocs[0];
    teleportTo(startLoc);
    applyNightMode(nightRef.current);
    setReady(true);
    update(0);
    renderer.render(scene, camera);
    cityWorld.updateLabels(camera, width, height);
    renderMaps();
    afterDraw(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(syncTimerId);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPtr);
      canvas.removeEventListener('pointercancel', endPtr);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onCtx);
      scene.remove(player);
      disposeCharacterRig(playerRig);
      cityWorld.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [leadCrew, showToast]);

  const handleCopyLayout = useCallback(async () => {
    const txt = layoutJsonFnRef.current?.() ?? JSON.stringify(CITY_MAP_LAYOUT, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      showToast('Layout JSON copied');
    } catch {
      setCopyJsonText(txt);
    }
  }, [showToast]);

  const handleBigMapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = bigCanvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const best = findCityLocationAtNormalizedCoord(
      (e.clientX - r.left) / r.width,
      (e.clientY - r.top) / r.height,
      14
    );
    if (best) {
      teleportFnRef.current?.(best.id);
      setBigMapOpen(false);
    }
  }, []);

  const cardLevelId = selectedLevelId ?? nearLoc?.primaryLevelId ?? 1;
  const nearLocked = nearLoc ? !canDeployLevel(cardLevelId, highestUnlocked) : false;
  const nearLockMsg = nearLoc ? getLevelLockMessage(cardLevelId, highestUnlocked) : null;

  return (
    <div
      className="fixed inset-0 z-30 bg-[#0d0f13] text-slate-100 select-none overflow-hidden"
      data-city-map-ready={ready ? 'true' : 'false'}
    >
      {/* Dedicated WebGL Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected 3D Marker Labels */}
      <div
        ref={labelsRef}
        className={`fixed inset-0 pointer-events-none overflow-hidden ${bigMapOpen ? 'hidden' : ''}`}
      />

      {/* Top-Left Title & Controls Header */}
      <div className="fixed top-3 left-3 z-10 bg-[#0c0e12]/90 border border-white/12 rounded-xl px-3.5 py-2.5 max-w-[270px]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-bold tracking-[0.14em] text-slate-100">
            SHADOWS &amp; GEARS
          </h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            {CREW_ROSTER[leadCrew].name}
          </span>
        </div>
        <p className="hidden sm:block text-[11px] text-slate-300/80 leading-snug mt-1">
          <strong className="text-slate-100">WASD</strong> move ·{' '}
          <strong className="text-slate-100">Shift</strong> run ·{' '}
          <strong className="text-slate-100">Space</strong> jump ·{' '}
          <strong className="text-slate-100">Drag</strong> look ·{' '}
          <strong className="text-slate-100">M</strong> map ·{' '}
          <strong className="text-slate-100">N</strong> day/night
        </p>
      </div>

      {/* Left Sidebar: Combined Heist Levels (1-10) & 12 City Districts */}
      <div className="hidden md:block fixed top-[102px] left-3 z-10 w-[254px] max-h-[calc(100%-118px)] overflow-y-auto bg-[#0c0e12]/90 border border-white/12 rounded-xl p-1.5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-lg mb-1.5">
          <button
            type="button"
            onClick={() => setSidebarTab('levels')}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              sidebarTab === 'levels'
                ? 'bg-amber-400 text-[#090B10]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Heist Levels
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('districts')}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              sidebarTab === 'districts'
                ? 'bg-amber-400 text-[#090B10]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            12 Districts
          </button>
        </div>

        {sidebarTab === 'levels' ? (
          <div className="space-y-0.5">
            {LEVEL_CONFIGS.map((lvl) => {
              const anchor = getLevelCityAnchor(lvl.id);
              const unlocked = canDeployLevel(lvl.id, highestUnlocked);
              const isSelected =
                selectedLevelId === lvl.id ||
                (selectedLevelId === null && nearLoc?.id === anchor.locationId && nearLoc.primaryLevelId === lvl.id);
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelectedLevelId(lvl.id);
                    teleportFnRef.current?.(anchor.locationId);
                  }}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-[12px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white/15 text-white'
                      : unlocked
                        ? 'text-slate-200 hover:bg-white/10'
                        : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-5 rounded grid place-items-center text-[10px] font-bold ${
                      unlocked ? 'bg-amber-400 text-[#090B10]' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    L{lvl.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight">{lvl.title}</span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {anchor.districtName}
                    </span>
                  </span>
                  {!unlocked && (
                    <Lock className="w-3 h-3 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-0.5">
            {CITY_LOCATIONS.map((loc) => {
              const isNear = nearLoc?.id === loc.id;
              const unlocked = canDeployLevel(loc.primaryLevelId, highestUnlocked);
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelectedLevelId(null);
                    teleportFnRef.current?.(loc.id);
                  }}
                  className={`w-full flex items-center gap-2.5 text-left px-2 py-1.5 rounded-lg text-[12.5px] transition-colors cursor-pointer ${
                    isNear
                      ? 'bg-white/15 text-white'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold text-[#111]"
                    style={{ backgroundColor: unlocked ? loc.color : '#64748b' }}
                  >
                    {loc.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight">{loc.name}</span>
                    <span className="block text-[10px] text-slate-400">{loc.levels}</span>
                  </span>
                  {!unlocked && (
                    <Lock className="w-3 h-3 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {onRestartLevels && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setSelectedLevelId(1);
                onRestartLevels();
                teleportFnRef.current?.(getLevelCityAnchor(1).locationId);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11.5px] font-semibold text-amber-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restart Levels
            </button>
          </div>
        )}
      </div>

      {/* Top-Right Tools */}
      <div className="fixed top-3 right-3 z-10 flex items-center gap-1.5 bg-[#0c0e12]/90 border border-white/12 rounded-xl p-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setBigMapOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-slate-100 cursor-pointer whitespace-nowrap"
        >
          <MapIcon className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          Map (M)
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setNightFnRef.current?.(!nightRef.current);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-slate-100 cursor-pointer whitespace-nowrap"
        >
          {isNight ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              Day (N)
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
              Night (N)
            </>
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleCopyLayout();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-slate-100 cursor-pointer whitespace-nowrap"
        >
          <Copy className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          Copy Layout JSON
        </button>
        {hasActiveHeist && onResumeHeist ? (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResumeHeist();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#090B10] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Return to Heist
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onBackToTitle();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#090B10] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Title
          </button>
        )}
      </div>

      {/* Bottom-Right Coordinates & Minimap */}
      <div
        ref={coordsRef}
        className="hidden sm:block fixed right-3 bottom-[220px] z-10 bg-[#0c0e12]/90 border border-white/12 rounded-lg px-2.5 py-1 text-[11px] font-mono tabular-nums text-slate-200"
      >
        x -150.0 · y 0.0 · z 7.0
      </div>
      <div className="fixed right-3 bottom-3 z-10 bg-[#0c0e12]/90 border border-white/12 rounded-xl p-1.5">
        <canvas
          ref={miniCanvasRef}
          width={190}
          height={190}
          onClick={() => setBigMapOpen(true)}
          title="Click to expand City Map (M)"
          className="block rounded-lg cursor-pointer"
        />
      </div>

      {/* Bottom-Center Location & Mission Card */}
      {nearLoc && (
        <div
          className="fixed left-1/2 bottom-5 -translate-x-1/2 z-10 w-[min(470px,84vw)] bg-[#0c0e12]/92 border-2 rounded-xl px-4 py-3"
          style={{ borderColor: nearLoc.color }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold text-slate-50">
                <span style={{ color: nearLoc.color }}>{nearLoc.id}.</span> {nearLoc.name}
              </div>
              <div className="text-[11px] tracking-[0.1em] text-slate-400 mt-0.5">
                {selectedLevelId ? `LEVEL ${selectedLevelId} · ` : ''}
                {nearLoc.levels}
              </div>
            </div>
            <button
              type="button"
              disabled={nearLocked}
              onClick={(e) => {
                e.currentTarget.blur();
                if (!nearLocked) {
                  onDeployLevel(cardLevelId);
                }
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                nearLocked
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-[#090B10] cursor-pointer'
              }`}
            >
              {nearLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  {highestUnlocked === 1 ? 'Complete L1 First' : `Clear L${cardLevelId - 1}`}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  Deploy Level {cardLevelId}
                </>
              )}
            </button>
          </div>
          <p className="text-[13px] leading-snug text-slate-200/90 mt-2">
            {nearLockMsg ? `${nearLockMsg}. ` : ''}
            {nearLoc.brief}
          </p>
        </div>
      )}

      {/* Ephemeral Toast */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-lg bg-[#0c0e12]/95 border border-white/15 text-xs font-medium text-slate-100 pointer-events-none">
          {toastMsg}
        </div>
      )}

      {/* Big Interactive Tactical Map Modal */}
      {bigMapOpen && (
        <div
          className="fixed inset-0 z-20 bg-[#050609]/88 grid place-items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBigMapOpen(false);
          }}
        >
          <div className="fixed top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-3 text-xs text-slate-200 bg-[#0c0e12]/90 border border-white/15 rounded-lg px-3.5 py-1.5">
            <span>Click a numbered location to travel there · Esc / M to close</span>
            <button
              type="button"
              onClick={() => setBigMapOpen(false)}
              className="text-slate-300 hover:text-white cursor-pointer"
              aria-label="Close big map"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <canvas
            ref={bigCanvasRef}
            width={900}
            height={900}
            onClick={handleBigMapClick}
            className="w-[min(86vh,92vw)] h-[min(86vh,92vw)] rounded-xl cursor-pointer border border-white/15"
          />
        </div>
      )}

      {/* Copy JSON Fallback Modal */}
      {copyJsonText !== null && (
        <div className="fixed inset-[10%_14%] z-40 flex flex-col gap-2.5 p-4 bg-[#0c0e12]/95 border border-white/15 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span>City Map Layout JSON</span>
            <button
              type="button"
              onClick={() => setCopyJsonText(null)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
          <textarea
            readOnly
            value={copyJsonText}
            className="flex-1 bg-[#080a0d] text-emerald-200 border border-slate-700 rounded-lg p-3 text-xs font-mono"
          />
        </div>
      )}

      {/* Mobile Touch Controls */}
      <div
        ref={joyRef}
        className="fixed w-[110px] h-[110px] rounded-full border-2 border-white/30 hidden pointer-events-none -translate-x-1/2 -translate-y-1/2"
      >
        <div
          ref={joyKnobRef}
          className="absolute left-1/2 top-1/2 w-[44px] h-[44px] -m-[22px] rounded-full bg-white/35"
        />
      </div>
      {isTouchDevice && (
        <button
          ref={jumpBtnRef}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            jumpTriggerRef.current = true;
          }}
          className="fixed right-6 bottom-[230px] z-10 w-16 h-16 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-slate-100"
        >
          JUMP
        </button>
      )}
    </div>
  );
}
