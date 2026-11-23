import { ArrowLeft, ChevronDown, ChevronUp, RotateCcw, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildCharacter3D,
  CHARACTER_3D_SPECS,
  disposeCharacterRig,
  type BuiltCharacterRig,
  type CharacterId3D,
} from '../game/characters3d';

interface CharacterGallery3DProps {
  initialCharacter?: CharacterId3D;
  onBackToTitle: () => void;
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

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function CharacterGallery3D({
  initialCharacter = 'john',
  onBackToTitle,
}: CharacterGallery3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<CharacterId3D>(initialCharacter);
  const [autoRotate, setAutoRotate] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const selectedRef = useRef<CharacterId3D>(selectedId);
  selectedRef.current = selectedId;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    rimLight: THREE.DirectionalLight;
    rig: BuiltCharacterRig | null;
    maxAniso: number;
    isSoftwareGl: boolean;
  } | null>(null);

  const activeSpec =
    CHARACTER_3D_SPECS.find((c) => c.id === selectedId) ?? CHARACTER_3D_SPECS[0];

  // Mount Three.js scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const spec =
      CHARACTER_3D_SPECS.find((c) => c.id === selectedRef.current) ??
      CHARACTER_3D_SPECS[0];
    scene.background = new THREE.Color(spec.bgHex);
    scene.fog = new THREE.Fog(spec.bgHex, 6, 18);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(...spec.cameraPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, spec.targetY, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.5;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    // 3-Point Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x22242a, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    keyLight.position.set(2.5, 4.8, 3.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -2.2;
    keyLight.shadow.camera.right = 2.2;
    keyLight.shadow.camera.top = 2.6;
    keyLight.shadow.camera.bottom = -0.4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(spec.rimHex, 1.15);
    rimLight.position.set(-2.5, 3.2, -3.0);
    scene.add(rimLight);

    // Stage floor, grid, and contact shadow disc
    const floorGeo = new THREE.CircleGeometry(4.2, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x20252d,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(6.4, 24, 0x3b4252, 0x2a303c);
    grid.position.y = 0.002;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach((m) => {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
    });
    scene.add(grid);

    const shadowTex = createContactShadowTexture();
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const contactPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), contactMat);
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = 0.005;
    scene.add(contactPlane);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const initialRig = buildCharacter3D(selectedRef.current, maxAniso);
    scene.add(initialRig.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneRefs.current = {
      scene,
      camera,
      controls,
      renderer,
      rimLight,
      rig: initialRig,
      maxAniso,
      isSoftwareGl,
    };

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    let frameId = 0;
    let disposed = false;
    const startMs = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const elapsed = (performance.now() - startMs) * 0.001;
      const currentRig = sceneRefs.current?.rig;
      if (currentRig) {
        currentRig.animate(elapsed);
      }
      controls.autoRotate = !isSoftwareGl && autoRotateRef.current;
      controls.autoRotateSpeed = 1.25;
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.dispose();
      if (sceneRefs.current?.rig) {
        scene.remove(sceneRefs.current.rig.group);
        disposeCharacterRig(sceneRefs.current.rig);
      }
      floorGeo.dispose();
      floorMat.dispose();
      grid.geometry.dispose();
      gridMats.forEach((m) => m.dispose());
      contactPlane.geometry.dispose();
      contactMat.dispose();
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Swap 3D character cleanly without tearing down renderer
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const spec =
      CHARACTER_3D_SPECS.find((c) => c.id === selectedId) ?? CHARACTER_3D_SPECS[0];

    if (refs.rig) {
      refs.scene.remove(refs.rig.group);
      disposeCharacterRig(refs.rig);
    }

    const nextRig = buildCharacter3D(selectedId, refs.maxAniso);
    refs.scene.add(nextRig.group);
    refs.rig = nextRig;

    refs.scene.background = new THREE.Color(spec.bgHex);
    if (refs.scene.fog instanceof THREE.Fog) {
      refs.scene.fog.color.setHex(spec.bgHex);
    }
    refs.rimLight.color.setHex(spec.rimHex);
    refs.camera.position.set(...spec.cameraPos);
    refs.controls.target.set(0, spec.targetY, 0);
    refs.controls.update();
    refs.renderer.render(refs.scene, refs.camera);
  }, [selectedId]);

  // Keyboard shortcut [H] to toggle HUD dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'Escape') {
        onBackToTitle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBackToTitle]);

  const handleResetCamera = () => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.camera.position.set(...activeSpec.cameraPos);
    refs.controls.target.set(0, activeSpec.targetY, 0);
    refs.controls.update();
    refs.renderer.render(refs.scene, refs.camera);
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#14181E] select-none">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} data-testid="character-3d-canvas" className="w-full h-full" />

      {/* Top-Left Minimal Spec Header */}
      <div className="fixed top-5 left-5 z-40 flex items-start gap-3 pointer-events-none">
        <button
          type="button"
          onClick={onBackToTitle}
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 bg-[#0B0F17]/90 hover:bg-[#151C29] border border-slate-700/80 text-slate-200 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          Title
        </button>

        <div className="bg-[#0B0F17]/90 border border-slate-700/80 rounded px-4 py-2.5 max-w-md">
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular uppercase tracking-wider text-amber-400">
            <span>{activeSpec.heightLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{activeSpec.archetype}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-50 leading-tight">
            {activeSpec.name}
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-snug">
            {activeSpec.description}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Drag Rotate · Scroll Zoom · Right-Click Pan
          </p>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className="fixed left-1/2 z-40 flex flex-col items-center transition-transform duration-200"
        style={{
          bottom: '20px',
          maxWidth: 'min(1040px, 94vw)',
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 26px))'
            : 'translate(-50%, 0)',
        }}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0B0F17]/95 border border-b-0 border-slate-700/80 rounded-t text-[11px] font-medium text-slate-300 hover:text-slate-100 cursor-pointer whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              Show Controls [H]
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              Hide Controls [H]
            </>
          )}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2 p-2.5 bg-[#0B0F17]/95 border border-slate-700/80 rounded shadow-2xl">
          <div className="flex flex-wrap items-center gap-1 bg-[#141A24] p-1 rounded border border-slate-800">
            {CHARACTER_3D_SPECS.map((char) => {
              const active = char.id === selectedId;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedId(char.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-amber-400 text-[#090B10] font-semibold'
                      : 'text-slate-300 hover:text-slate-50 hover:bg-slate-800/80'
                  }`}
                >
                  {char.name} ({char.heightLabel})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              aria-pressed={autoRotate}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                autoRotate
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#141A24] border-slate-700 text-slate-300 hover:text-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Auto-Orbit
            </button>

            <button
              type="button"
              onClick={handleResetCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#141A24] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
