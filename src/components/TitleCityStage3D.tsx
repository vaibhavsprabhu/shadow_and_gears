import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCityWorld, type CityWorldHandle } from '../game/cityBuilder3d';
import type { CityMapFootprint } from '../game/cityMap2d';
import { getLevelCityAnchor } from '../game/cityMapData';

interface TitleCityStage3DProps {
  focusedLevelId: number;
  cityNight: boolean;
  onFootprintsReady?: (footprints: CityMapFootprint[]) => void;
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

export function TitleCityStage3D({
  focusedLevelId,
  cityNight,
  onFootprintsReady,
}: TitleCityStage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const focusedLevelRef = useRef(focusedLevelId);
  focusedLevelRef.current = focusedLevelId;
  const cityNightRef = useRef(cityNight);
  cityNightRef.current = cityNight;
  const onFootprintsReadyRef = useRef(onFootprintsReady);
  onFootprintsReadyRef.current = onFootprintsReady;

  const worldRef = useRef<{
    world: CityWorldHandle;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
  } | null>(null);

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
    renderer.toneMappingExposure = 1.02;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'title-city-3d-canvas');
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 900);
    const maxAniso = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();

    const world = buildCityWorld({
      scene,
      renderer,
      isSoftwareGl,
      maxAniso,
      initialNight: cityNightRef.current,
      suppressMarkers: false,
      shadowExtent: 55,
    });
    onFootprintsReadyRef.current?.(world.footprints);

    const initAnchor = getLevelCityAnchor(focusedLevelRef.current);
    const focusTarget = new THREE.Vector3(
      initAnchor.anchorX,
      initAnchor.anchorY + 2,
      initAnchor.anchorZ
    );
    const desiredTarget = focusTarget.clone();
    let userYawOffset = 0.45;
    let dragState: { id: number; lastX: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      dragState = { id: e.pointerId, lastX: e.clientX };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragState || e.pointerId !== dragState.id) return;
      userYawOffset -= (e.clientX - dragState.lastX) * 0.004;
      dragState.lastX = e.clientX;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragState && e.pointerId === dragState.id) dragState = null;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    worldRef.current = { world, renderer, scene, camera };

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    let disposed = false;
    let lastNow = performance.now();
    let elapsed = 0;
    let rafId = 0;
    let timerId = 0;

    function afterDraw(cb: () => void) {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      if (isWebGL2) {
        const gl2 = gl as WebGL2RenderingContext;
        const fence = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        let done = false;
        const check = () => {
          if (disposed || done) return;
          if (!fence || gl2.getSyncParameter(fence, gl2.SYNC_STATUS) === gl2.SIGNALED) {
            done = true;
            if (fence) gl2.deleteSync(fence);
            timerId = window.setTimeout(cb, 70);
          } else {
            timerId = window.setTimeout(check, 25);
          }
        };
        timerId = window.setTimeout(check, 35);
      } else {
        timerId = window.setTimeout(cb, 85);
      }
    }

    function updateCamera(dt: number) {
      const anchor = getLevelCityAnchor(focusedLevelRef.current);
      const loc = world.runtimeLocs.find((l) => l.id === anchor.locationId);
      const tx = loc ? loc.marker.x : anchor.anchorX;
      const ty = (loc ? loc.gy : anchor.anchorY) + 2;
      const tz = loc ? loc.marker.z : anchor.anchorZ;
      desiredTarget.set(tx, ty, tz);

      const distToTarget = focusTarget.distanceTo(desiredTarget);
      if (distToTarget > 30) {
        focusTarget.copy(desiredTarget);
      } else {
        const lerpAlpha = Math.min(1, dt * 8.5);
        focusTarget.lerp(desiredTarget, lerpAlpha);
      }

      const yaw = userYawOffset + elapsed * 0.08;
      const radius = 38;
      const camX = focusTarget.x + Math.sin(yaw) * radius;
      const camZ = focusTarget.z + Math.cos(yaw) * radius;
      const groundH = world.groundAt(camX, camZ, 999);
      const camY = Math.max(focusTarget.y + 18, groundH + 14);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(focusTarget.x, focusTarget.y, focusTarget.z);
    }

    function frame() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      elapsed += dt;

      updateCamera(dt);
      world.updateWorld(
        elapsed,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        focusTarget.x,
        focusTarget.y,
        focusTarget.z
      );
      renderer.render(scene, camera);
      afterDraw(frame);
    }

    updateCamera(1);
    world.updateWorld(
      0,
      camera.position.x,
      camera.position.y,
      camera.position.z,
      focusTarget.x,
      focusTarget.y,
      focusTarget.z
    );
    renderer.render(scene, camera);
    afterDraw(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      world.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bundle = worldRef.current;
    if (!bundle) return;
    bundle.world.setNight(cityNight);
    bundle.renderer.render(bundle.scene, bundle.camera);
  }, [cityNight]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-0 overflow-hidden bg-[#090B10]"
      data-focused-level={focusedLevelId}
      data-city-night={cityNight ? 'true' : 'false'}
    />
  );
}
