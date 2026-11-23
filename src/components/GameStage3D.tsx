import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildGameplayCharacter3D,
  disposeCharacterRig,
  type BuiltCharacterRig,
  type GameplayCharacterKind,
} from '../game/characters3d';
import { buildCityWorld, type CityWorldHandle } from '../game/cityBuilder3d';
import type { CityMapFootprint } from '../game/cityMap2d';
import { getAllLevelClearPropRects, getLevelCityAnchor } from '../game/cityMapData';
import { raycastConeDistance } from '../game/math';
import type { AppScreenState, GuardActor, LevelRuntime } from '../game/types';

interface GameStage3DProps {
  runtimeRef: MutableRefObject<LevelRuntime>;
  runtimeVersion: number;
  cityNight: boolean;
  cameraMode: '3d' | 'top';
  cameraYawRef: MutableRefObject<number>;
  screenStateRef: MutableRefObject<AppScreenState>;
  aimRef: MutableRefObject<{ x: number | null; y: number | null }>;
  onCityFootprintsReady?: (footprints: CityMapFootprint[]) => void;
  onStepFrame: (dt: number) => void;
  onFire: () => void;
}

const WORLD_SCALE = 0.032; // 1000px -> 32.0m, 620px -> 19.84m
const CONE_RAYS = 16;

function wx(x: number): number {
  return (x - 500) * WORLD_SCALE;
}

function wz(y: number): number {
  return (y - 310) * WORLD_SCALE;
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

function mapGuardKind(g: GuardActor): GameplayCharacterKind {
  switch (g.kind) {
    case 'shasha':
      return 'shasha';
    case 'shamus':
      return 'shamus';
    case 'pablo':
      return 'pablo';
    case 'swat':
      return 'swat';
    case 'cartel':
      return 'cartel';
    default:
      return 'guard';
  }
}

function getFloorColors(ambience: string): { floor: number; bg: number; grid1: number; grid2: number } {
  switch (ambience) {
    case 'bank':
      return { floor: 0x131b26, bg: 0x0b1017, grid1: 0x2c3b4f, grid2: 0x1b2533 };
    case 'mansion':
      return { floor: 0x11201a, bg: 0x0a130f, grid1: 0x264b3b, grid2: 0x183026 };
    case 'hideout':
      return { floor: 0x101c2c, bg: 0x08101b, grid1: 0x254063, grid2: 0x172940 };
    case 'harbour':
      return { floor: 0x0f1a28, bg: 0x071019, grid1: 0x213c59, grid2: 0x15273b };
    case 'rooftop':
      return { floor: 0x161b24, bg: 0x090c12, grid1: 0x333c4d, grid2: 0x202733 };
    case 'warehouse':
      return { floor: 0x17151f, bg: 0x0c0b12, grid1: 0x3b2f54, grid2: 0x231d33 };
    case 'highway':
      return { floor: 0x12151c, bg: 0x090b10, grid1: 0x272d3b, grid2: 0x191d26 };
    default:
      return { floor: 0x131822, bg: 0x090d14, grid1: 0x2b3648, grid2: 0x1c2330 };
  }
}

function createVehicleMesh(bodyColor: number, isPolice: boolean, isVan: boolean): THREE.Group {
  const car = new THREE.Group();
  const w = isVan ? 1.55 : 1.45;
  const h = isVan ? 1.15 : 0.72;
  const l = isVan ? 2.85 : 2.65;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, l),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.25 })
  );
  body.position.y = h * 0.5 + 0.18;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.88, 0.48, l * 0.56),
    new THREE.MeshStandardMaterial({ color: isPolice ? 0xf8fafc : 0x0f172a, roughness: 0.3 })
  );
  cabin.position.set(0, h + 0.28, isVan ? -0.15 : 0.1);
  car.add(cabin);

  if (isPolice) {
    const barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    barRed.position.set(-0.24, h + 0.58, 0.08);
    const barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
    );
    barBlue.position.set(0.24, h + 0.58, 0.08);
    car.add(barRed, barBlue);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.18, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.8 });
  [
    [-w * 0.48, -l * 0.32],
    [w * 0.48, -l * 0.32],
    [-w * 0.48, l * 0.32],
    [w * 0.48, l * 0.32],
  ].forEach(([wxPos, wzPos]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wxPos, 0.26, wzPos);
    car.add(wheel);
  });

  return car;
}

interface LevelVisualHandle {
  group: THREE.Group;
  playerRigs: {
    rig: BuiltCharacterRig;
    ring: THREE.Mesh;
    prevX: number;
    prevY: number;
  }[];
  guardRigs: {
    rig: BuiltCharacterRig;
    coneMesh: THREE.Mesh;
    coneLine: THREE.Line;
    conePositions: Float32Array;
    coneLinePositions: Float32Array;
    coneAttr: THREE.BufferAttribute;
    coneLineAttr: THREE.BufferAttribute;
    telegraphRing: THREE.Mesh;
    prevX: number;
    prevY: number;
  }[];
  shamusEscapeRig: BuiltCharacterRig | null;
  vaultDoorMeshes: THREE.Mesh[];
  bagMeshes: THREE.Group[];
  zoneRings: {
    id: string;
    ring: THREE.Mesh;
    beacon: THREE.Mesh;
  }[];
  playerVan: THREE.Group | null;
  trafficCars: THREE.Group[];
  roadblockGroup: THREE.Group | null;
  laneDividers: THREE.Mesh[];
  waterMesh: THREE.Mesh | null;
  dispose: () => void;
}

function populateGuardCone(
  gr: LevelVisualHandle['guardRigs'][number],
  g: GuardActor,
  rt: LevelRuntime
): void {
  const gx3 = wx(g.x);
  const gz3 = wz(g.y);
  const pos = gr.conePositions;
  const linePos = gr.coneLinePositions;
  const coneY = 0.055;
  pos[0] = gx3;
  pos[1] = coneY;
  pos[2] = gz3;
  linePos[0] = gx3;
  linePos[1] = coneY + 0.008;
  linePos[2] = gz3;

  const startAng = g.angle - g.fov * 0.5;
  const stepAng = g.fov / CONE_RAYS;
  for (let r = 0; r <= CONE_RAYS; r++) {
    const a = startAng + stepAng * r;
    const distPx = raycastConeDistance(g.x, g.y, a, g.range, rt.walls);
    const px3 = wx(g.x + Math.cos(a) * distPx);
    const pz3 = wz(g.y + Math.sin(a) * distPx);
    const idx3 = (r + 1) * 3;
    pos[idx3] = px3;
    pos[idx3 + 1] = coneY;
    pos[idx3 + 2] = pz3;
    linePos[idx3] = px3;
    linePos[idx3 + 1] = coneY + 0.008;
    linePos[idx3 + 2] = pz3;
  }
  const closeIdx = (CONE_RAYS + 2) * 3;
  linePos[closeIdx] = gx3;
  linePos[closeIdx + 1] = coneY + 0.008;
  linePos[closeIdx + 2] = gz3;

  gr.coneAttr.needsUpdate = true;
  gr.coneLineAttr.needsUpdate = true;
}

function buildLevelVisuals(
  runtime: LevelRuntime,
  maxAniso: number
): LevelVisualHandle {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const pal = getFloorColors(runtime.config.ambience);

  // Subtle ground tint so the surrounding 3D City terrain & cobbles show seamlessly
  const isRooftop = runtime.config.ambience === 'rooftop';
  const isOutdoor =
    runtime.config.ambience === 'city_night' ||
    runtime.config.ambience === 'mansion' ||
    runtime.config.ambience === 'harbour' ||
    runtime.config.ambience === 'highway';
  const floor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(32.2, 20.0)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: pal.floor,
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: isRooftop ? 0.56 : isOutdoor ? 0.14 : 0.36,
        depthWrite: false,
      })
    )
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = !isRooftop;
  group.add(floor);

  // Only show blueprint grid lines during Level 3 planning mode
  if (runtime.levelId === 3) {
    const grid = new THREE.GridHelper(32, 32, pal.grid1, pal.grid2);
    grid.position.y = 0.006;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.32;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      trackMat(m);
    });
    trackGeo(grid.geometry);
    group.add(grid);
  }

  // Level-specific ground landmarks
  if (runtime.levelId === 1) {
    const parkGrass = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(300 * WORLD_SCALE, 520 * WORLD_SCALE)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x103324,
          roughness: 0.95,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        })
      )
    );
    parkGrass.rotation.x = -Math.PI / 2;
    parkGrass.position.set(wx(820), 0.012, wz(310));
    group.add(parkGrass);
  }

  let waterMesh: THREE.Mesh | null = null;
  if (runtime.config.ambience === 'harbour') {
    waterMesh = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(170 * WORLD_SCALE, 620 * WORLD_SCALE)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x082f49,
          roughness: 0.25,
          metalness: 0.4,
          transparent: true,
          opacity: 0.62,
        })
      )
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(wx(915), 0.015, 0);
    group.add(waterMesh);
  }

  // Rooftop gaps (Level 10)
  for (const gap of runtime.rooftopGaps) {
    const gapMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(gap.w * WORLD_SCALE, 0.08, gap.h * WORLD_SCALE)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x020305 }))
    );
    gapMesh.position.set(wx(gap.x + gap.w / 2), 0.01, wz(gap.y + gap.h / 2));
    group.add(gapMesh);

    const edgeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const edgeL = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 0.08, gap.h * WORLD_SCALE)),
      edgeMat
    );
    edgeL.position.set(wx(gap.x), 0.03, wz(gap.y + gap.h / 2));
    const edgeR = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 0.08, gap.h * WORLD_SCALE)),
      edgeMat
    );
    edgeR.position.set(wx(gap.x + gap.w), 0.03, wz(gap.y + gap.h / 2));
    group.add(edgeL, edgeR);
  }

  // Blueprint Green Patrol Route (Level 3 & 4)
  if ((runtime.levelId === 3 || runtime.levelId === 4) && runtime.guards[0]?.waypoints.length > 1) {
    const pts = runtime.guards[0].waypoints.map((p) => new THREE.Vector3(wx(p.x), 0.04, wz(p.y)));
    pts.push(pts[0].clone());
    const routeGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(pts));
    const routeMat = trackMat(
      new THREE.LineBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: runtime.levelId === 3 ? 0.9 : 0.35,
      })
    );
    group.add(new THREE.Line(routeGeo, routeMat));
  }

  // Walls, Buildings, Hedges, Crates, Vault Door
  const vaultDoorMeshes: THREE.Mesh[] = [];
  for (const w of runtime.walls) {
    const width3d = Math.max(0.2, w.w * WORLD_SCALE);
    const depth3d = Math.max(0.2, w.h * WORLD_SCALE);
    let height3d = 2.0;
    let color = 0x2a364b;
    let roughness = 0.72;
    let metalness = 0.1;

    if (w.kind === 'hedge') {
      height3d = 1.25;
      color = 0x165b3d;
      roughness = 0.92;
    } else if (w.kind === 'building') {
      height3d = 3.0;
      color = 0x1a2334;
      roughness = 0.78;
    } else if (w.kind === 'crate') {
      height3d = 1.45;
      color = 0x6b4e34;
      roughness = 0.85;
    } else if (w.kind === 'vault_door') {
      height3d = 2.55;
      color = 0xd97706;
      metalness = 0.75;
      roughness = 0.32;
    }

    const mesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width3d, height3d, depth3d)),
      trackMat(new THREE.MeshStandardMaterial({ color, roughness, metalness }))
    );
    mesh.position.set(wx(w.x + w.w / 2), height3d / 2, wz(w.y + w.h / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (w.kind === 'building') {
      const cap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width3d + 0.1, 0.14, depth3d + 0.1)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 }))
      );
      cap.position.y = height3d / 2 + 0.05;
      mesh.add(cap);

      const windowBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width3d + 0.03, 0.22, depth3d + 0.03)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color: runtime.config.ambience === 'bank' ? 0x38bdf8 : 0xfbbf24,
            transparent: true,
            opacity: 0.45,
          })
        )
      );
      windowBand.position.y = height3d * 0.16;
      mesh.add(windowBand);
    } else if (w.kind === 'crate') {
      const strap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width3d + 0.04, 0.18, depth3d + 0.04)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 }))
      );
      strap.position.y = 0.15;
      mesh.add(strap);
    } else if (w.kind === 'hedge') {
      const crown = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(Math.max(0.15, width3d * 0.86), 0.35, Math.max(0.15, depth3d * 0.86))),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x1d754e, roughness: 0.92 }))
      );
      crown.position.y = height3d * 0.48;
      mesh.add(crown);
    } else if (w.kind === 'vault_door') {
      const cap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width3d + 0.08, 0.14, depth3d + 0.08)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.25 }))
      );
      cap.position.y = height3d / 2 + 0.04;
      mesh.add(cap);
    } else {
      const coping = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width3d + 0.05, 0.1, depth3d + 0.05)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }))
      );
      coping.position.y = height3d / 2 + 0.03;
      mesh.add(coping);
    }

    if (w.kind === 'vault_door') {
      vaultDoorMeshes.push(mesh);
    }
  }

  // Zones & Diegetic Props (Van, Boat, Antenna, Letterbox, Plates)
  const zoneRings: LevelVisualHandle['zoneRings'] = [];
  for (const z of runtime.zones) {
    const r = Math.max(0.55, z.radius * WORLD_SCALE);
    const ringColor =
      z.kind === 'antenna'
        ? 0x38bdf8
        : z.kind === 'van' || z.kind === 'boat'
          ? 0x22c55e
          : 0xe5a93b;

    const ring = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(r * 0.78, r, 32)),
      trackMat(
        new THREE.MeshBasicMaterial({
          color: ringColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.82,
        })
      )
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wx(z.x), 0.03, wz(z.y));
    ring.visible = z.active || z.completed;
    group.add(ring);

    const beacon = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16)),
      trackMat(new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7 }))
    );
    beacon.position.set(wx(z.x), 0.18, wz(z.y));
    beacon.visible = false;
    group.add(beacon);

    // 3D landmark prop inside special zones
    if (z.kind === 'van') {
      const van = createVehicleMesh(0xe5a93b, false, true);
      van.position.set(wx(z.x), 0, wz(z.y));
      van.rotation.y = Math.PI / 2;
      group.add(van);
    } else if (z.kind === 'boat') {
      const hull = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.8, 0.75, 1.35)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 }))
      );
      hull.position.set(wx(z.x), 0.38, wz(z.y));
      const cabin = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.1, 0.55, 0.95)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }))
      );
      cabin.position.set(wx(z.x - 10), 0.95, wz(z.y));
      group.add(hull, cabin);
    } else if (z.kind === 'antenna') {
      const mast = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.08, 0.18, 2.8, 12)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 }))
      );
      mast.position.set(wx(z.x), 1.4, wz(z.y));
      const tip = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.16, 12, 12)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
      );
      tip.position.set(wx(z.x), 2.85, wz(z.y));
      group.add(mast, tip);
    } else if (z.kind === 'letterbox') {
      const post = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.14, 0.95, 0.14)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x475569 }))
      );
      post.position.set(wx(z.x), 0.48, wz(z.y));
      const box = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.32, 0.24, 0.42)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 }))
      );
      box.position.set(wx(z.x), 1.0, wz(z.y));
      group.add(post, box);
    }

    zoneRings.push({ id: z.id, ring, beacon });
  }

  // Cash Bags
  const bagGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.38, 0.44));
  const bagMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 }));
  const stripeGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.1, 0.47));
  const stripeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.4 }));
  const bagMeshes: THREE.Group[] = [];
  for (const b of runtime.bags) {
    const bg = new THREE.Group();
    const m = new THREE.Mesh(bagGeo, bagMat);
    m.position.y = 0.22;
    m.castShadow = true;
    const s = new THREE.Mesh(stripeGeo, stripeMat);
    s.position.y = 0.24;
    bg.add(m, s);
    bg.position.set(wx(b.x), 0, wz(b.y));
    bg.visible = !b.collected;
    group.add(bg);
    bagMeshes.push(bg);
  }

  // Highway Chase Setup (Level 6)
  let playerVan: THREE.Group | null = null;
  const trafficCars: THREE.Group[] = [];
  let roadblockGroup: THREE.Group | null = null;
  const laneDividers: THREE.Mesh[] = [];

  if (runtime.config.mode === 'highway_chase') {
    const asphalt = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(580 * WORLD_SCALE, 22)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x1b1f29, roughness: 0.92 }))
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.015, 0);
    group.add(asphalt);

    const railMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4 }));
    const railL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.55, 22)), railMat);
    railL.position.set(wx(204), 0.28, 0);
    const railR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.55, 22)), railMat);
    railR.position.set(wx(796), 0.28, 0);
    group.add(railL, railR);

    const dashGeo = trackGeo(new THREE.PlaneGeometry(0.16, 1.3));
    const dashMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.6 }));
    for (let lane = 1; lane <= 3; lane++) {
      const lx = wx(210 + lane * 145);
      for (let d = -10; d <= 10; d += 2.6) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.025, d);
        group.add(dash);
        laneDividers.push(dash);
      }
    }

    playerVan = createVehicleMesh(0xe5a93b, false, true);
    playerVan.position.set(wx(runtime.playerCarX), 0, wz(runtime.playerCarY));
    group.add(playerVan);

    for (const c of runtime.cars) {
      const cm = createVehicleMesh(
        c.kind === 'police' ? 0x1e293b : 0x64748b,
        c.kind === 'police',
        false
      );
      cm.position.set(wx(c.x), 0, wz(c.y));
      group.add(cm);
      trafficCars.push(cm);
    }

    roadblockGroup = new THREE.Group();
    const barrier = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(540 * WORLD_SCALE, 0.9, 1.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }))
    );
    barrier.position.y = 0.45;
    const cruL = createVehicleMesh(0x1e293b, true, false);
    cruL.rotation.y = Math.PI / 2;
    cruL.position.set(-4.5, 0, 0);
    const cruR = createVehicleMesh(0x1e293b, true, false);
    cruR.rotation.y = -Math.PI / 2;
    cruR.position.set(4.5, 0, 0);
    roadblockGroup.add(barrier, cruL, cruR);
    roadblockGroup.visible = false;
    group.add(roadblockGroup);
  }

  // Player 3D Rigs
  const playerRigs: LevelVisualHandle['playerRigs'] = [];
  for (let i = 0; i < runtime.players.length; i++) {
    const p = runtime.players[i];
    const rig = buildGameplayCharacter3D(p.id, maxAniso);
    rig.group.position.x = wx(p.x);
    rig.group.position.z = wz(p.y);
    rig.group.rotation.y = Math.PI / 2 - p.angle;
    if (runtime.config.mode === 'highway_chase') {
      rig.group.visible = false;
    }
    group.add(rig.group);

    const ring = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.46, 0.58, 28)),
      trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xe5a93b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      )
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wx(p.x), 0.035, wz(p.y));
    ring.visible = runtime.config.mode !== 'highway_chase';
    group.add(ring);

    playerRigs.push({ rig, ring, prevX: p.x, prevY: p.y });
  }

  // Guard / Villain 3D Rigs + Dynamic Vision Cones
  const guardRigs: LevelVisualHandle['guardRigs'] = [];
  for (const g of runtime.guards) {
    const kind = mapGuardKind(g);
    const rig = buildGameplayCharacter3D(kind, maxAniso);
    rig.group.position.x = wx(g.x);
    rig.group.position.z = wz(g.y);
    rig.group.rotation.y = Math.PI / 2 - g.angle;
    group.add(rig.group);

    // Pre-allocated 18-vertex Triangle Fan Geometry for Vision Cone
    const positions = new Float32Array((CONE_RAYS + 2) * 3);
    const indices: number[] = [];
    for (let k = 1; k <= CONE_RAYS; k++) {
      indices.push(0, k + 1, k);
    }
    const coneGeo = trackGeo(new THREE.BufferGeometry());
    const coneAttr = new THREE.BufferAttribute(positions, 3);
    coneAttr.setUsage(THREE.DynamicDrawUsage);
    coneGeo.setAttribute('position', coneAttr);
    coneGeo.setIndex(indices);

    const coneHex =
      g.kind === 'shasha'
        ? 0xf472b6
        : g.kind === 'shamus' || g.kind === 'swat'
          ? 0xef4444
          : g.color === '#22C55E'
            ? 0x22c55e
            : 0xf59e0b;

    const coneMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: coneHex,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.frustumCulled = false;
    coneMesh.renderOrder = 3;
    coneMesh.visible = runtime.config.mode !== 'warehouse_war';
    group.add(coneMesh);

    const linePositions = new Float32Array((CONE_RAYS + 3) * 3);
    const lineGeo = trackGeo(new THREE.BufferGeometry());
    const coneLineAttr = new THREE.BufferAttribute(linePositions, 3);
    coneLineAttr.setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute('position', coneLineAttr);
    const lineMat = trackMat(
      new THREE.LineBasicMaterial({
        color: coneHex,
        transparent: true,
        opacity: 0.88,
      })
    );
    const coneLine = new THREE.Line(lineGeo, lineMat);
    coneLine.frustumCulled = false;
    coneLine.renderOrder = 4;
    coneLine.visible = coneMesh.visible;
    group.add(coneLine);

    const telegraphRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.65, 0.82, 24)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }))
    );
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.set(wx(g.x), 0.05, wz(g.y));
    telegraphRing.visible = false;
    group.add(telegraphRing);

    const guardHandle: LevelVisualHandle['guardRigs'][number] = {
      rig,
      coneMesh,
      coneLine,
      conePositions: positions,
      coneLinePositions: linePositions,
      coneAttr,
      coneLineAttr,
      telegraphRing,
      prevX: g.x,
      prevY: g.y,
    };
    populateGuardCone(guardHandle, g, runtime);
    guardRigs.push(guardHandle);
  }

  // Level 10 Fleeing Officer Shamus Rig
  let shamusEscapeRig: BuiltCharacterRig | null = null;
  if (runtime.levelId === 10) {
    shamusEscapeRig = buildGameplayCharacter3D('shamus', maxAniso);
    shamusEscapeRig.group.position.x = wx(runtime.shamusEscapeX);
    shamusEscapeRig.group.position.z = wz(runtime.shamusEscapeY);
    shamusEscapeRig.group.rotation.y = Math.PI / 2;
    group.add(shamusEscapeRig.group);
  }

  return {
    group,
    playerRigs,
    guardRigs,
    shamusEscapeRig,
    vaultDoorMeshes,
    bagMeshes,
    zoneRings,
    playerVan,
    trafficCars,
    roadblockGroup,
    laneDividers,
    waterMesh,
    dispose: () => {
      playerRigs.forEach((p) => disposeCharacterRig(p.rig));
      guardRigs.forEach((g) => disposeCharacterRig(g.rig));
      if (shamusEscapeRig) disposeCharacterRig(shamusEscapeRig);
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function GameStage3D({
  runtimeRef,
  runtimeVersion,
  cityNight,
  cameraMode,
  cameraYawRef,
  screenStateRef,
  aimRef,
  onCityFootprintsReady,
  onStepFrame,
  onFire,
}: GameStage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelsContainerRef = useRef<HTMLDivElement | null>(null);
  const onStepRef = useRef(onStepFrame);
  onStepRef.current = onStepFrame;
  const onFootprintsReadyRef = useRef(onCityFootprintsReady);
  onFootprintsReadyRef.current = onCityFootprintsReady;
  const cityNightRef = useRef(cityNight);
  cityNightRef.current = cityNight;
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const camOrbitRef = useRef({ yaw: 0, pitch: 0.35, dist: 10.5 });
  const dragOrbitRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const builtVersionRef = useRef<number>(-1);
  const runtimeVersionRef = useRef<number>(runtimeVersion);
  runtimeVersionRef.current = runtimeVersion;

  const sceneBundleRef = useRef<{
    scene: THREE.Scene;
    stageRoot: THREE.Group;
    cityWorld: CityWorldHandle;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    maxAniso: number;
    isSoftwareGl: boolean;
    levelHandle: LevelVisualHandle | null;
    bulletMeshes: THREE.Mesh[];
    particleMeshes: THREE.Mesh[];
    labelEls: HTMLSpanElement[];
  } | null>(null);

  // Mount Three.js gameplay renderer & 3D City World once
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
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = cityNightRef.current ? 0.24 : 0.72;
    pmrem.dispose();

    const maxAniso = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();
    const cityWorld = buildCityWorld({
      scene,
      renderer,
      isSoftwareGl,
      maxAniso,
      initialNight: cityNightRef.current,
      suppressMarkers: true,
      clearPropRects: getAllLevelClearPropRects(),
      shadowExtent: 26,
    });
    onFootprintsReadyRef.current?.(cityWorld.footprints);

    const initAnchor = getLevelCityAnchor(runtimeRef.current.levelId);
    const camera = new THREE.PerspectiveCamera(56, width / height, 0.3, 1200);
    const initPlayer = runtimeRef.current.players[runtimeRef.current.activePlayerIndex];
    const initFocusX = initAnchor.anchorX + (initPlayer ? wx(initPlayer.x) : 0);
    const initFocusY = initAnchor.anchorY + 1.65;
    const initFocusZ = initAnchor.anchorZ + (initPlayer ? wz(initPlayer.y) : 0);
    camera.position.set(initFocusX, initFocusY + 3.6, initFocusZ + 9.8);
    camera.lookAt(initFocusX, initFocusY, initFocusZ);

    // Stage Root anchored dynamically to current level's real district in the 3D City
    const stageRoot = new THREE.Group();
    stageRoot.position.set(initAnchor.anchorX, initAnchor.anchorY + 0.06, initAnchor.anchorZ);
    scene.add(stageRoot);

    // Pre-allocated Bullet & Particle Meshes inside stageRoot (local stage coords)
    const bulletGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const bulletPlayerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const bulletEnemyMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const bulletMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(bulletGeo, bulletPlayerMat);
      m.visible = false;
      stageRoot.add(m);
      bulletMeshes.push(m);
    }

    const partGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
    const partMats = {
      rain: new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
      smoke: new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }),
    };
    const particleMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(partGeo, partMats.rain);
      m.visible = false;
      stageRoot.add(m);
      particleMeshes.push(m);
    }

    // Floating Name Label Pool (max 12 actors per level)
    const labelEls: HTMLSpanElement[] = [];
    const labelsHost = labelsContainerRef.current;
    if (labelsHost) {
      for (let i = 0; i < 12; i++) {
        const el = document.createElement('span');
        el.className =
          'absolute top-0 left-0 px-1.5 py-0.5 rounded bg-[#090B10]/85 text-[10px] font-semibold tracking-wide pointer-events-none whitespace-nowrap border border-slate-700/60';
        el.style.display = 'none';
        labelsHost.appendChild(el);
        labelEls.push(el);
      }
    }

    const levelHandle = buildLevelVisuals(runtimeRef.current, maxAniso);
    stageRoot.add(levelHandle.group);
    builtVersionRef.current = runtimeVersionRef.current;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneBundleRef.current = {
      scene,
      stageRoot,
      cityWorld,
      camera,
      renderer,
      maxAniso,
      isSoftwareGl,
      levelHandle,
      bulletMeshes,
      particleMeshes,
      labelEls,
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
    let lastMs = performance.now();
    const startMs = lastMs;
    const projVec = new THREE.Vector3();

    function syncVisuals(elapsedSec: number) {
      const bundle = sceneBundleRef.current;
      const rt = runtimeRef.current;
      const lh = bundle?.levelHandle;
      if (!bundle || !lh) return;

      const anchor = getLevelCityAnchor(rt.levelId);
      const stageY = anchor.anchorY + 0.06;
      bundle.stageRoot.position.set(anchor.anchorX, stageY, anchor.anchorZ);

      const shakeMag = rt.shakeTrauma * rt.shakeTrauma * 0.25;
      const sx = shakeMag > 0.01 ? Math.sin(rt.elapsed * 55) * shakeMag : 0;
      const sy = shakeMag > 0.01 ? Math.cos(rt.elapsed * 49) * shakeMag : 0;

      const getPlayerWorldGroundY = (localX: number, localZ: number) => {
        const worldX = anchor.anchorX + localX;
        const worldZ = anchor.anchorZ + localZ;
        const inPad =
          anchor.clearPropRect &&
          worldX >= anchor.clearPropRect.x0 &&
          worldX <= anchor.clearPropRect.x1 &&
          worldZ >= anchor.clearPropRect.z0 &&
          worldZ <= anchor.clearPropRect.z1;
        return inPad ? stageY : bundle.cityWorld.groundAt(worldX, worldZ);
      };

      const activeP = rt.players[rt.activePlayerIndex];
      const activeLocalX = activeP ? wx(activeP.x) : 0;
      const activeLocalZ = activeP ? wz(activeP.y) : 0;
      const activeGroundY =
        rt.config.mode === 'highway_chase'
          ? anchor.anchorY
          : getPlayerWorldGroundY(activeLocalX, activeLocalZ);
      const useGrounded3D = cameraModeRef.current === '3d' && rt.levelId !== 3;
      const targetFov = useGrounded3D ? 56 : 44;
      if (Math.abs(bundle.camera.fov - targetFov) > 0.1) {
        bundle.camera.fov = targetFov;
        bundle.camera.updateProjectionMatrix();
      }

      let focusX = anchor.anchorX;
      let focusY = anchor.anchorY;
      let focusZ = anchor.anchorZ;

      if (useGrounded3D) {
        if (rt.config.mode === 'highway_chase') {
          cameraYawRef.current = 0;
          focusX = anchor.anchorX + wx(rt.playerCarX);
          focusY = anchor.anchorY + 1.1;
          focusZ = anchor.anchorZ + wz(rt.playerCarY);
          bundle.camera.position.set(focusX + sx, focusY + 3.4 + sy, focusZ + 9.4);
          bundle.camera.lookAt(focusX, focusY + 0.3, focusZ - 10);
        } else {
          const cam = camOrbitRef.current;
          cameraYawRef.current = cam.yaw;
          focusX = anchor.anchorX + activeLocalX;
          focusY = activeGroundY + 1.65;
          focusZ = anchor.anchorZ + activeLocalZ;

          const cdx = Math.sin(cam.yaw) * Math.cos(cam.pitch);
          const cdy = Math.sin(cam.pitch);
          const cdz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
          const clippedDist = bundle.cityWorld.cameraClipDistance(
            focusX,
            focusY,
            focusZ,
            cdx,
            cdy,
            cdz,
            cam.dist
          );
          const camX = focusX + cdx * clippedDist + sx;
          const camZ = focusZ + cdz * clippedDist;
          const groundMinY = bundle.cityWorld.groundAt(camX, camZ, 999) + 0.55;
          const camY = Math.max(focusY + cdy * clippedDist + sy, groundMinY);

          bundle.camera.position.set(camX, camY, camZ);
          bundle.camera.lookAt(focusX, focusY, focusZ);
        }
      } else {
        cameraYawRef.current = 0;
        const focusLocalX = activeP ? wx(activeP.x) * 0.14 : 0;
        const focusLocalZ = activeP ? wz(activeP.y) * 0.14 : 0;
        focusX = anchor.anchorX + focusLocalX;
        focusY = anchor.anchorY;
        focusZ = anchor.anchorZ + focusLocalZ;
        bundle.camera.position.set(focusX + sx, focusY + 22.8 + sy, focusZ + 15.8);
        bundle.camera.lookAt(focusX, focusY, focusZ + 0.4);
      }

      bundle.cityWorld.updateWorld(
        elapsedSec,
        bundle.camera.position.x,
        bundle.camera.position.y,
        bundle.camera.position.z,
        focusX,
        focusY,
        focusZ
      );

      // Vault door open state
      for (const door of lh.vaultDoorMeshes) {
        door.visible = !rt.vaultOpen;
      }

      // Cash bags
      for (let i = 0; i < lh.bagMeshes.length; i++) {
        const b = rt.bags[i];
        const bm = lh.bagMeshes[i];
        if (b && bm) {
          bm.visible = !b.collected;
          if (bm.visible) bm.rotation.y = elapsedSec * 1.4 + i;
        }
      }

      // Zones
      for (let i = 0; i < rt.zones.length; i++) {
        const z = rt.zones[i];
        const zr = lh.zoneRings[i];
        if (!zr) continue;
        zr.ring.visible = z.active || z.completed;
        const pulse = 1 + Math.sin(rt.elapsed * 4) * 0.06;
        zr.ring.scale.set(pulse, pulse, 1);
        (zr.ring.material as THREE.MeshBasicMaterial).color.setHex(
          z.completed
            ? 0x22c55e
            : z.kind === 'antenna'
              ? 0x38bdf8
              : z.kind === 'van' || z.kind === 'boat'
                ? 0x22c55e
                : 0xe5a93b
        );
        if (z.progress > 0 && z.requiredTime > 0.2) {
          zr.beacon.visible = true;
          zr.beacon.scale.y = 0.4 + (z.progress / z.requiredTime) * 2.4;
        } else {
          zr.beacon.visible = false;
        }
      }

      // Highway Chase sync
      if (rt.config.mode === 'highway_chase') {
        const offset = ((rt.highwayDistance * 1.1) % 70) * WORLD_SCALE;
        let idx = 0;
        for (let lane = 1; lane <= 3; lane++) {
          for (let d = -10; d <= 10; d += 2.6) {
            const dash = lh.laneDividers[idx++];
            if (dash) {
              dash.position.z = ((d + offset + 11) % 22) - 11;
            }
          }
        }
        if (lh.playerVan) {
          lh.playerVan.position.set(wx(rt.playerCarX), 0, wz(rt.playerCarY));
        }
        for (let i = 0; i < lh.trafficCars.length; i++) {
          const c = rt.cars[i];
          const cm = lh.trafficCars[i];
          if (c && cm) cm.position.set(wx(c.x), 0, wz(c.y));
        }
        if (lh.roadblockGroup) {
          const remaining = rt.highwayTarget - rt.highwayDistance;
          lh.roadblockGroup.visible = remaining < 620;
          if (lh.roadblockGroup.visible) {
            lh.roadblockGroup.position.set(0, 0, wz(rt.playerCarY - remaining));
          }
        }
      }

      // Players 3D rigs (project label using world-space coordinates)
      const w = container?.clientWidth || 1440;
      const h = container?.clientHeight || 900;
      let labelIdx = 0;

      const pushLabel = (
        text: string,
        xLocal: number,
        yLocal: number,
        zLocal: number,
        active: boolean,
        accentColor?: string
      ) => {
        const el = bundle.labelEls[labelIdx++];
        if (!el) return;
        projVec
          .set(anchor.anchorX + xLocal, stageY + yLocal, anchor.anchorZ + zLocal)
          .project(bundle.camera);
        if (projVec.z > 1) {
          el.style.display = 'none';
          return;
        }
        const px = (projVec.x * 0.5 + 0.5) * w;
        const py = (-projVec.y * 0.5 + 0.5) * h;
        el.textContent = text;
        el.style.display = 'block';
        el.style.color = active ? '#FDE68A' : accentColor ?? '#E2E8F0';
        el.style.borderColor = active ? 'rgba(229, 169, 59, 0.85)' : 'rgba(100, 116, 139, 0.55)';
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
      };

      for (let i = 0; i < lh.playerRigs.length; i++) {
        const p = rt.players[i];
        const pr = lh.playerRigs[i];
        if (!p || !pr) continue;
        if (rt.config.mode === 'highway_chase') {
          pr.rig.group.visible = false;
          pr.ring.visible = false;
          continue;
        }

        const moved = Math.hypot(p.x - pr.prevX, p.y - pr.prevY) > 0.25;
        pr.prevX = p.x;
        pr.prevY = p.y;

        const px3 = wx(p.x);
        const pz3 = wz(p.y);
        const localGroundOffsetY = getPlayerWorldGroundY(px3, pz3) - stageY;
        pr.rig.group.position.x = px3;
        pr.rig.group.position.y = localGroundOffsetY;
        pr.rig.group.position.z = pz3;
        pr.rig.group.rotation.y = Math.PI / 2 - p.angle;
        pr.rig.animate(elapsedSec, p.walkPhase, moved, p.carryingBag);

        const isActive = i === rt.activePlayerIndex && rt.levelId !== 3;
        pr.ring.position.set(px3, localGroundOffsetY + 0.035, pz3);
        pr.ring.visible = true;
        (pr.ring.material as THREE.MeshBasicMaterial).color.setHex(isActive ? 0xe5a93b : 0x64748b);

        pushLabel(p.name, px3, localGroundOffsetY + 2.25, pz3, isActive);
      }

      // Guards & Villains 3D rigs + dynamic raycast vision cones
      for (let i = 0; i < lh.guardRigs.length; i++) {
        const g = rt.guards[i];
        const gr = lh.guardRigs[i];
        if (!g || !gr) continue;
        const alive = g.hp > 0;
        gr.rig.group.visible = alive;
        const showCone = alive && g.koTimer <= 0 && rt.config.mode !== 'warehouse_war';
        gr.coneMesh.visible = showCone;
        gr.coneLine.visible = showCone;
        gr.telegraphRing.visible = alive && g.telegraphTimer > 0;
        if (!alive) continue;

        const moved = Math.hypot(g.x - gr.prevX, g.y - gr.prevY) > 0.12;
        gr.prevX = g.x;
        gr.prevY = g.y;

        const gx3 = wx(g.x);
        const gz3 = wz(g.y);
        gr.rig.group.position.x = gx3;
        gr.rig.group.position.z = gz3;
        gr.rig.group.rotation.y = Math.PI / 2 - g.angle;
        gr.rig.animate(elapsedSec, elapsedSec * 7.5 + i, moved, false);
        gr.telegraphRing.position.set(gx3, 0.05, gz3);

        if (showCone) {
          populateGuardCone(gr, g, rt);

          const coneHex =
            rt.alertFlash > 0
              ? 0xef4444
              : g.kind === 'shasha'
                ? 0xf472b6
                : g.kind === 'shamus' || g.kind === 'swat'
                  ? 0xef4444
                  : g.color === '#22C55E'
                    ? 0x22c55e
                    : 0xf59e0b;

          const cMat = gr.coneMesh.material as THREE.MeshBasicMaterial;
          cMat.color.setHex(coneHex);
          cMat.opacity = rt.alertFlash > 0 ? 0.48 : 0.36;

          const lMat = gr.coneLine.material as THREE.LineBasicMaterial;
          lMat.color.setHex(coneHex);
          lMat.opacity = rt.alertFlash > 0 ? 1.0 : 0.88;
        }

        const accent =
          g.kind === 'shasha'
            ? '#F472B6'
            : g.kind === 'shamus'
              ? '#FCA5A5'
              : g.kind === 'pablo'
                ? '#FDBA74'
                : '#CBD5E1';
        pushLabel(g.name, gx3, 2.25, gz3, false, accent);
      }

      // Level 10 Fleeing Officer Shamus
      if (lh.shamusEscapeRig) {
        lh.shamusEscapeRig.group.visible = !rt.shamusJumped;
        if (!rt.shamusJumped) {
          const sx3 = wx(rt.shamusEscapeX);
          const sz3 = wz(rt.shamusEscapeY);
          lh.shamusEscapeRig.group.position.x = sx3;
          lh.shamusEscapeRig.group.position.z = sz3;
          lh.shamusEscapeRig.group.rotation.y = Math.PI / 2;
          lh.shamusEscapeRig.animate(elapsedSec, elapsedSec * 10, true, false);
          pushLabel('Officer Shamus', sx3, 2.25, sz3, false, '#FCA5A5');
        }
      }

      // Hide unused pooled labels
      for (let i = labelIdx; i < bundle.labelEls.length; i++) {
        bundle.labelEls[i].style.display = 'none';
      }

      // Bullets
      for (let i = 0; i < bundle.bulletMeshes.length; i++) {
        const b = rt.bullets[i];
        const bm = bundle.bulletMeshes[i];
        if (b && b.active) {
          bm.visible = true;
          bm.position.set(wx(b.x), 1.05, wz(b.y));
          bm.material = b.fromPlayer ? bulletPlayerMat : bulletEnemyMat;
        } else {
          bm.visible = false;
        }
      }

      // Particles (rain & sparks)
      for (let i = 0; i < bundle.particleMeshes.length; i++) {
        const pt = rt.particles[i];
        const pm = bundle.particleMeshes[i];
        if (pt && pt.active) {
          pm.visible = true;
          pm.position.set(wx(pt.x), pt.kind === 'rain' ? 2.4 : 0.9, wz(pt.y));
          pm.material = pt.kind === 'rain' ? partMats.rain : pt.kind === 'smoke' ? partMats.smoke : partMats.spark;
        } else {
          pm.visible = false;
        }
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 24);
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
          frameId = window.setTimeout(poll, 4);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 24);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0, (now - lastMs) / 1000);
      lastMs = now;

      if (screenStateRef.current === 'playing') {
        onStepRef.current(rawDt);
      }

      syncVisuals((now - startMs) * 0.001);
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

      if (sceneBundleRef.current?.levelHandle) {
        stageRoot.remove(sceneBundleRef.current.levelHandle.group);
        sceneBundleRef.current.levelHandle.dispose();
      }
      cityWorld.dispose();
      scene.remove(stageRoot);
      bulletGeo.dispose();
      bulletPlayerMat.dispose();
      bulletEnemyMat.dispose();
      partGeo.dispose();
      Object.values(partMats).forEach((m) => m.dispose());
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      if (labelsHost) {
        labelsHost.innerHTML = '';
      }
      sceneBundleRef.current = null;
    };
  }, [runtimeRef, screenStateRef]);

  // Sync Day/Night lighting when toggled via N or HUD button
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle) return;
    bundle.cityWorld.setNight(cityNight);
    bundle.scene.environmentIntensity = cityNight ? 0.24 : 0.72;
    bundle.renderer.render(bundle.scene, bundle.camera);
  }, [cityNight]);

  // Rebuild level 3D stage & reposition camera to district anchor whenever runtimeVersion changes
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle || builtVersionRef.current === runtimeVersion) return;
    builtVersionRef.current = runtimeVersion;

    if (bundle.levelHandle) {
      bundle.stageRoot.remove(bundle.levelHandle.group);
      bundle.levelHandle.dispose();
    }

    const rt = runtimeRef.current;
    const anchor = getLevelCityAnchor(rt.levelId);
    camOrbitRef.current = { yaw: 0, pitch: 0.35, dist: 10.5 };
    cameraYawRef.current = 0;
    bundle.stageRoot.position.set(anchor.anchorX, anchor.anchorY + 0.06, anchor.anchorZ);
    const activeP = rt.players[rt.activePlayerIndex];
    const initFx = anchor.anchorX + (activeP ? wx(activeP.x) : 0);
    const initFy = anchor.anchorY + 1.65;
    const initFz = anchor.anchorZ + (activeP ? wz(activeP.y) : 0);
    bundle.camera.position.set(initFx, initFy + 3.6, initFz + 9.8);
    bundle.camera.lookAt(initFx, initFy, initFz);
    bundle.cityWorld.updateWorld(
      rt.elapsed,
      bundle.camera.position.x,
      bundle.camera.position.y,
      bundle.camera.position.z,
      initFx,
      initFy,
      initFz
    );

    const nextHandle = buildLevelVisuals(rt, bundle.maxAniso);
    bundle.stageRoot.add(nextHandle.group);
    bundle.levelHandle = nextHandle;
    bundle.renderer.render(bundle.scene, bundle.camera);
  }, [cameraYawRef, runtimeVersion, runtimeRef]);

  // 3D Ground-Plane Raycaster for Level 9 Aiming & Shooting
  const raycasterRef = useRef(new THREE.Raycaster());
  const aimPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.96));
  const hitVecRef = useRef(new THREE.Vector3());

  const updateAimFromPointer = (clientX: number, clientY: number) => {
    const container = mountRef.current;
    const bundle = sceneBundleRef.current;
    if (!container || !bundle) return;
    const anchor = getLevelCityAnchor(runtimeRef.current.levelId);
    aimPlaneRef.current.constant = -(anchor.anchorY + 0.96);

    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycasterRef.current.setFromCamera(ndc, bundle.camera);
    const hit = raycasterRef.current.ray.intersectPlane(aimPlaneRef.current, hitVecRef.current);
    if (hit) {
      aimRef.current = {
        x: (hit.x - anchor.anchorX) / WORLD_SCALE + 500,
        y: (hit.z - anchor.anchorZ) / WORLD_SCALE + 310,
      };
    }
  };

  const activeAnchor = getLevelCityAnchor(runtimeRef.current.levelId);

  return (
    <div
      className="fixed inset-0 z-10 overflow-hidden bg-[#090B10]"
      data-city-district={activeAnchor.districtName}
      data-city-night={cityNight ? 'true' : 'false'}
      data-camera-mode={cameraMode}
      onPointerDown={(e) => {
        if (screenStateRef.current !== 'playing') return;
        dragOrbitRef.current = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        if (screenStateRef.current !== 'playing') return;
        updateAimFromPointer(e.clientX, e.clientY);
        const drag = dragOrbitRef.current;
        if (drag && drag.id === e.pointerId && cameraModeRef.current === '3d') {
          const dx = e.clientX - drag.lastX;
          const dy = e.clientY - drag.lastY;
          if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) {
            drag.moved = true;
          }
          if (drag.moved) {
            camOrbitRef.current.yaw -= dx * 0.0055;
            camOrbitRef.current.pitch = Math.max(
              0.12,
              Math.min(1.22, camOrbitRef.current.pitch + dy * 0.0045)
            );
          }
          drag.lastX = e.clientX;
          drag.lastY = e.clientY;
        }
      }}
      onPointerUp={(e) => {
        const drag = dragOrbitRef.current;
        if (drag && drag.id === e.pointerId) {
          if (!drag.moved && screenStateRef.current === 'playing') {
            updateAimFromPointer(e.clientX, e.clientY);
            onFire();
          }
          dragOrbitRef.current = null;
        }
      }}
      onPointerCancel={() => {
        dragOrbitRef.current = null;
      }}
      onWheel={(e) => {
        if (cameraModeRef.current !== '3d') return;
        camOrbitRef.current.dist = Math.max(
          5.5,
          Math.min(26, camOrbitRef.current.dist * (1 + Math.sign(e.deltaY) * 0.1))
        );
      }}
    >
      <div ref={mountRef} data-testid="game-3d-canvas" className="w-full h-full" />
      <div ref={labelsContainerRef} className="fixed inset-0 pointer-events-none overflow-hidden" />
    </div>
  );
}
