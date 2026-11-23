import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCityMapBackgroundCanvas, type CityMapFootprint } from './cityMap2d';
import {
  CITY_LOCATIONS,
  CITY_MAP_LAYOUT,
  CITY_ROADS,
  type CityLocationSpec,
} from './cityMapData';

export interface ClearPropRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface CityWorldOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  maxAniso: number;
  labelsEl?: HTMLElement | null;
  initialNight?: boolean;
  suppressMarkers?: boolean;
  clearPropRects?: ReadonlyArray<ClearPropRect>;
  shadowExtent?: number;
}

export interface RuntimeCityLocation extends CityLocationSpec {
  gy: number;
  ring: THREE.Mesh | null;
  beam: THREE.Mesh | null;
  el: HTMLDivElement | null;
}

export interface CityWorldHandle {
  runtimeLocs: RuntimeCityLocation[];
  footprints: CityMapFootprint[];
  mapBgCanvas: HTMLCanvasElement;
  setNight: (night: boolean) => void;
  updateWorld: (timeSec: number, camX: number, camY: number, camZ: number, focusX: number, focusY: number, focusZ: number) => void;
  groundAt: (x: number, z: number, y?: number) => number;
  blocked: (x: number, z: number, y: number, radius?: number) => boolean;
  cameraClipDistance: (tx: number, ty: number, tz: number, cdx: number, cdy: number, cdz: number, maxDist: number) => number;
  updateLabels: (camera: THREE.Camera, width: number, height: number) => void;
  getLayoutJson: () => string;
  dispose: () => void;
}

interface CollBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
}

interface SurfBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h?: number;
  ramp?: boolean;
  hz0?: number;
  hz1?: number;
}

export function buildCityWorld(options: CityWorldOptions): CityWorldHandle {
  const {
    scene,
    renderer,
    isSoftwareGl,
    maxAniso,
    labelsEl = null,
    initialNight = false,
    suppressMarkers = false,
    clearPropRects = [],
    shadowExtent = 85,
  } = options;

  const texturesToDispose: THREE.Texture[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const sceneObjectsToRemove: THREE.Object3D[] = [];

  const addToScene = <T extends THREE.Object3D>(obj: T): T => {
    scene.add(obj);
    sceneObjectsToRemove.push(obj);
    return obj;
  };

  const inClearRect = (x: number, z: number, pad = 0): boolean =>
    clearPropRects.some(
      (r) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad
    );

  const rectOverlapsClear = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    pad = 0
  ): boolean =>
    clearPropRects.some(
      (r) => x0 < r.x1 + pad && x1 > r.x0 - pad && z0 < r.z1 + pad && z1 > r.z0 - pad
    );

  /* ================= seeded random ================= */
  let seed = 20261123;
  function rand(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a: number, b: number) => a + rand() * (b - a);
  const RI = (a: number, b: number) => Math.floor(R(a, b + 1));
  const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];

  /* ================= procedural textures ================= */
  function tex(
    w: number,
    h: number,
    fn: (g: CanvasRenderingContext2D, w: number, h: number) => void,
    srgb = true
  ): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    fn(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texturesToDispose.push(t);
    return t;
  }
  function shade(hex: string, a: number): string {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, v + a));
    return `rgb(${clamp(n >> 16)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`;
  }
  function drawNoise(g: CanvasRenderingContext2D, w: number, h: number, n: number, alpha = 0.12) {
    for (let i = 0; i < n; i++) {
      g.fillStyle =
        rand() < 0.5 ? `rgba(0,0,0,${R(0, alpha)})` : `rgba(255,255,255,${R(0, alpha * 0.7)})`;
      g.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3));
    }
  }
  function glyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
    g.strokeStyle = col;
    g.lineWidth = Math.max(1.5, s * 0.12);
    g.lineCap = 'round';
    const n = RI(3, 6);
    for (let i = 0; i < n; i++) {
      g.beginPath();
      const t = rand();
      if (t < 0.4) {
        const yy = y + R(0.1, 0.9) * s;
        g.moveTo(x + R(0.05, 0.3) * s, yy);
        g.lineTo(x + R(0.7, 0.95) * s, yy);
      } else if (t < 0.75) {
        const xx = x + R(0.1, 0.9) * s;
        g.moveTo(xx, y + R(0.05, 0.3) * s);
        g.lineTo(xx, y + R(0.7, 0.95) * s);
      } else {
        g.moveTo(x + R(0.1, 0.5) * s, y + R(0.1, 0.5) * s);
        g.lineTo(x + R(0.5, 0.9) * s, y + R(0.5, 0.9) * s);
      }
      g.stroke();
    }
  }

  const T_wood = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#2e2119';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const l = R(-14, 14);
      g.fillStyle = `rgb(${(78 + l) | 0},${(56 + l * 0.8) | 0},${(41 + l * 0.6) | 0})`;
      g.fillRect(x + 1.5, 0, 29, h);
      for (let i = 0; i < 16; i++) {
        g.strokeStyle = `rgba(20,12,8,${R(0.08, 0.28)})`;
        g.lineWidth = R(0.5, 1.6);
        g.beginPath();
        const xx = x + R(3, 29);
        g.moveTo(xx, 0);
        g.bezierCurveTo(xx + R(-3, 3), h * 0.33, xx + R(-3, 3), h * 0.66, xx, h);
        g.stroke();
      }
    }
    drawNoise(g, w, h, 900, 0.14);
  });
  const T_roof = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#2f3237';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const gr = g.createLinearGradient(0, y, 0, y + 16);
      gr.addColorStop(0, '#5a5f66');
      gr.addColorStop(1, '#2a2d31');
      g.fillStyle = gr;
      g.fillRect(0, y, w, 15);
      for (let x = ((y / 16) % 2) * 8; x < w; x += 16) {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(x, y, 1.5, 15);
      }
    }
    drawNoise(g, w, h, 300, 0.15);
  });
  const T_roofG = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#2f3237';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#5d626a');
      gr.addColorStop(1, '#26292d');
      g.fillStyle = gr;
      g.fillRect(x, 0, 15, h);
    }
    drawNoise(g, w, h, 300, 0.15);
  });
  T_roofG.repeat.set(9, 5);

  function latticeDraw(glow: boolean) {
    return (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.fillStyle = glow ? '#000' : '#2a1e16';
      g.fillRect(0, 0, w, h);
      const cols = 4;
      const rows = 3;
      const fw = 7;
      const pw = (w - fw * (cols + 1)) / cols;
      const ph = (h - fw * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = fw + c * (pw + fw);
          const y = fw + r * (ph + fw);
          if (glow) {
            g.fillStyle = `rgba(255,${(190 + R(0, 40)) | 0},${(110 + R(0, 50)) | 0},${R(0.3, 1)})`;
            g.fillRect(x, y, pw, ph);
            g.fillStyle = '#000';
          } else {
            const gr = g.createLinearGradient(x, y, x + pw, y + ph);
            gr.addColorStop(0, '#6f7c86');
            gr.addColorStop(0.5, '#38424c');
            gr.addColorStop(1, '#5a656e');
            g.fillStyle = gr;
            g.fillRect(x, y, pw, ph);
            g.fillStyle = 'rgba(30,22,16,.95)';
          }
          g.fillRect(x + pw / 2 - 1, y, 2, ph);
          g.fillRect(x, y + ph / 2 - 1, pw, 2);
        }
      }
    };
  }
  const T_lattice = tex(128, 128, latticeDraw(false));
  const T_latticeGlow = tex(128, 128, latticeDraw(true));

  const COBBLE = [
    '#8d9290',
    '#a08f8a',
    '#7f8d84',
    '#a59c8e',
    '#717d86',
    '#b39a92',
    '#8f8a7c',
    '#6e7a72',
    '#9aa3a8',
    '#a68478',
  ];
  function drawStone(
    g: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    col: string,
    jit: number[]
  ) {
    const n = jit.length;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = Math.cos(a) * rx * jit[i];
      const py = Math.sin(a) * ry * jit[i];
      const X = cx + px * Math.cos(rot) - py * Math.sin(rot);
      const Y = cy + px * Math.sin(rot) + py * Math.cos(rot);
      if (i) g.lineTo(X, Y);
      else g.moveTo(X, Y);
    }
    g.closePath();
    const gr = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 1, cx, cy, Math.max(rx, ry));
    gr.addColorStop(0, shade(col, 22));
    gr.addColorStop(1, shade(col, -28));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)';
    g.lineWidth = 2;
    g.stroke();
  }
  const T_cobble = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#34322e';
    g.fillRect(0, 0, w, h);
    const rows = 16;
    const cols = 13;
    const dy = h / rows;
    const dx = w / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * dx + (r % 2) * (dx / 2) + R(-4, 4);
        const cy = r * dy + R(-3, 3);
        const rx = R(14, 19);
        const ry = R(11, 15);
        const col = pick(COBBLE);
        const rot = R(0, 3.14);
        const jit = [...Array(RI(7, 9))].map(() => R(0.82, 1.08));
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            if (cx + ox > -30 && cx + ox < w + 30 && cy + oy > -30 && cy + oy < h + 30) {
              drawStone(g, cx + ox, cy + oy, rx, ry, rot, col, jit);
            }
          }
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(70,110,50,${R(0.05, 0.2)})`;
      g.beginPath();
      g.ellipse(R(0, w), R(0, h), R(4, 16), R(3, 10), R(0, 3), 0, 7);
      g.fill();
    }
    drawNoise(g, w, h, 2500, 0.1);
  });
  const T_stoneWall = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3935';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      let x = -R(0, 30);
      while (x < w) {
        const bw = R(36, 62);
        const col = pick(['#7a7d78', '#8d8a80', '#6c716d', '#948f86', '#7f857f']);
        g.fillStyle = col;
        g.beginPath();
        g.roundRect(x + 2, y + 2, bw - 4, 28, 8);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.08)';
        g.fillRect(x + 6, y + 5, bw - 14, 5);
        x += bw;
      }
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${(60 + R(0, 30)) | 0},${(100 + R(0, 40)) | 0},45,${R(0.15, 0.45)})`;
      g.beginPath();
      g.ellipse(R(0, w), R(0, h), R(4, 20), R(3, 9), 0, 0, 7);
      g.fill();
    }
    drawNoise(g, w, h, 1500, 0.14);
  });
  const T_shutter = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#7b8086';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(0, y, w, 1.5);
      g.fillStyle = 'rgba(255,255,255,.15)';
      g.fillRect(0, y + 2, w, 1);
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(120,70,40,${R(0.1, 0.3)})`;
      g.fillRect(R(0, w), R(0, h), R(2, 8), R(1, 12));
    }
  });
  const T_concrete = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8d86';
    g.fillRect(0, 0, w, h);
    drawNoise(g, w, h, 3000, 0.12);
    for (let i = 0; i < 25; i++) {
      g.fillStyle = `rgba(40,40,35,${R(0.04, 0.12)})`;
      g.fillRect(R(0, w), R(0, h * 0.4), R(2, 6), R(40, 160));
    }
  });
  const T_plaster = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#d6cfc1';
    g.fillRect(0, 0, w, h);
    drawNoise(g, w, h, 2500, 0.07);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(90,80,60,${R(0.03, 0.08)})`;
      g.fillRect(R(0, w), R(0, h * 0.3), R(3, 9), R(60, 200));
    }
  });
  const T_metal = tex(128, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const gr = g.createLinearGradient(x, 0, x + 8, 0);
      gr.addColorStop(0, '#e2e2e2');
      gr.addColorStop(0.5, '#b5b5b5');
      gr.addColorStop(1, '#d4d4d4');
      g.fillStyle = gr;
      g.fillRect(x, 0, 8, h);
    }
    drawNoise(g, w, h, 500, 0.1);
  });
  const T_grass = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a6a33';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      g.strokeStyle = `rgba(${R(40, 110) | 0},${R(90, 150) | 0},${R(30, 60) | 0},.6)`;
      g.beginPath();
      const x = R(0, w);
      const y = R(0, h);
      g.moveTo(x, y);
      g.lineTo(x + R(-2, 2), y - R(2, 6));
      g.stroke();
    }
  });
  const T_asphalt = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3d40';
    g.fillRect(0, 0, w, h);
    drawNoise(g, w, h, 4000, 0.14);
  });
  const T_road = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3d40';
    g.fillRect(0, 0, w, h);
    drawNoise(g, w, h, 4000, 0.14);
    g.fillStyle = 'rgba(230,224,200,.85)';
    g.fillRect(0, h / 2 - 3, w * 0.5, 6);
    g.fillStyle = 'rgba(220,215,195,.7)';
    g.fillRect(0, 14, w, 3);
    g.fillRect(0, h - 17, w, 3);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(0,0,0,${R(0.05, 0.15)})`;
      g.beginPath();
      g.ellipse(R(0, w), R(20, h - 20), R(6, 30), R(3, 10), 0, 0, 7);
      g.fill();
    }
  });
  const T_redSign = tex(64, 192, (g, w, h) => {
    g.fillStyle = '#c4161f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.strokeRect(4, 4, w - 8, h - 8);
    for (let i = 0; i < 3; i++) glyph(g, 12, 14 + i * 58, 40, '#fff');
  });
  const T_posters = [0, 1, 2, 3, 4, 5].map(() =>
    tex(128, 176, (g, w, h) => {
      g.fillStyle = pick(['#f2c14e', '#e94f37', '#3f88c5', '#f3eee2', '#44bba4', '#e8d5b7']);
      g.fillRect(0, 0, w, h);
      g.fillStyle = pick(['#1d1d1d', '#c8202a', '#ffffff', '#1f4fa0']);
      g.fillRect(0, R(10, 50), w, R(26, 44));
      for (let k = 0; k < 4; k++) {
        glyph(g, R(8, 70), R(80, 130), R(26, 40), pick(['#111', '#c8202a', '#fff']));
      }
      for (let i = 0; i < 20; i++) {
        g.fillStyle = `rgba(255,255,255,${R(0.05, 0.2)})`;
        g.fillRect(R(0, w), R(0, h), R(2, 30), R(1, 4));
      }
      drawNoise(g, w, h, 400, 0.2);
    })
  );
  const T_fence = tex(64, 64, (g) => {
    g.strokeStyle = 'rgba(170,175,180,1)';
    g.lineWidth = 2;
    for (let i = -64; i < 128; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.stroke();
      g.beginPath();
      g.moveTo(i + 64, 0);
      g.lineTo(i, 64);
      g.stroke();
    }
  });
  const T_stripe = tex(128, 32, (g, w, h) => {
    g.fillStyle = '#eee';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4161f';
    for (let x = -32; x < w + 32; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 32, h);
      g.lineTo(x + 16, h);
      g.fill();
    }
  });
  const T_water = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#7f9fa8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(255,255,255,${R(0.1, 0.45)})`;
      g.lineWidth = R(0.5, 2);
      g.beginPath();
      const x = R(0, w);
      const y = R(0, h);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 8, y - 3, x + R(10, 26), y);
      g.stroke();
    }
  });
  T_water.repeat.set(60, 30);
  const T_smoke = tex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(90,90,90,.9)');
    gr.addColorStop(1, 'rgba(90,90,90,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

  function textTex(text: string, bg: string, fg: string, w = 1024, h = 160, border?: string) {
    return tex(w, h, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = 8;
        g.strokeRect(8, 8, w - 16, h - 16);
      }
      let size = h * 0.55;
      g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
      while (g.measureText(text).width > w * 0.9) {
        size -= 4;
        g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
      }
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 3);
    });
  }

  function skyTex(top: string, mid: string, bot: string) {
    return tex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, top);
      gr.addColorStop(0.48, mid);
      gr.addColorStop(0.52, bot);
      gr.addColorStop(1, bot);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }

  /* ================= materials ================= */
  const std = (o: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(o);
    materialsToDispose.push(m);
    return m;
  };
  const MAT = {
    wood: std({ map: T_wood, roughness: 0.92 }),
    woodDark: std({ map: T_wood, color: 0xb49f92, roughness: 0.92 }),
    woodWarm: std({ map: T_wood, color: 0xe0b896, roughness: 0.9 }),
    lattice: std({
      map: T_lattice,
      emissiveMap: T_latticeGlow,
      emissive: 0xffc27a,
      emissiveIntensity: 0.2,
      roughness: 0.5,
    }),
    shutter: std({ map: T_shutter, roughness: 0.6, metalness: 0.15 }),
    roof: std({ map: T_roof, roughness: 0.8 }),
    roofG: std({ map: T_roofG, roughness: 0.8, flatShading: true }),
    stone: std({ map: T_stoneWall, roughness: 0.95 }),
    cobble: std({ map: T_cobble, roughness: 0.9 }),
    concrete: std({ map: T_concrete, roughness: 0.9 }),
    plaster: std({ map: T_plaster, roughness: 0.9 }),
    plasterW: std({ map: T_plaster, color: 0xf4f1ea, roughness: 0.85 }),
    metal: std({ map: T_metal, color: 0x9aa0a6, roughness: 0.55, metalness: 0.2 }),
    darkMetal: std({ color: 0x3a3f44, roughness: 0.55, metalness: 0.3 }),
    pole: std({ color: 0x77726a, roughness: 0.85 }),
    glass: std({ color: 0x3a4d5c, roughness: 0.15, metalness: 0.5, emissive: 0x0b1620 }),
    shopGlow: std({ color: 0x2a1a0e, emissive: 0xffa94d, emissiveIntensity: 0.55 }),
    lantern: std({ color: 0xb3121c, emissive: 0xff3a2a, emissiveIntensity: 0.45, roughness: 0.6 }),
    lamp: std({ color: 0xfff2cc, emissive: 0xffe2a8, emissiveIntensity: 0.5 }),
    tail: std({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.4 }),
    redSign: std({
      map: T_redSign,
      emissiveMap: T_redSign,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    }),
    posters: T_posters.map((t) => std({ map: t, roughness: 0.9 })),
    norenB: std({ color: 0x23395d, roughness: 1, side: THREE.DoubleSide }),
    norenR: std({ color: 0x8e1b1b, roughness: 1, side: THREE.DoubleSide }),
    plant: std({ color: 0x3f6b35, roughness: 0.9 }),
    leafPink: std({ color: 0xf0a5bd, roughness: 0.85 }),
    leafGreen: std({ color: 0x4f7d3a, roughness: 0.9 }),
    trunk: std({ color: 0x4a3a2c, roughness: 1 }),
    grass: std({ map: T_grass, roughness: 1 }),
    redPaint: std({ color: 0xb8322a, roughness: 0.55 }),
    white: std({ color: 0xe8e6e0, roughness: 0.6 }),
    black: std({ color: 0x1a1a1c, roughness: 0.8 }),
    tire: std({ color: 0x151515, roughness: 0.9 }),
    gold: std({ color: 0xd8b25a, metalness: 0.5, roughness: 0.35 }),
    copper: std({ color: 0x4f8f7f, metalness: 0.5, roughness: 0.5 }),
    policeBlue: std({ color: 0x1f4fa0, roughness: 0.5 }),
    yellow: std({ color: 0xe0b21c, roughness: 0.55, metalness: 0.2 }),
    hedge: std({ color: 0x335a2a, roughness: 1 }),
    pond: std({ color: 0x2f6470, roughness: 0.1, metalness: 0.4 }),
    fan: std({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.4 }),
    acUnit: std({ color: 0xd8d8d2, roughness: 0.7 }),
    rust: std({ color: 0x7a4a2e, roughness: 0.9 }),
    skin: std({ color: 0xc68e6a, roughness: 0.8 }),
    guardShirt: std({ color: 0x8a1f1f, roughness: 0.9 }),
    copShirt: std({ color: 0x2a3e66, roughness: 0.9 }),
    pants: std({ color: 0x23262b, roughness: 0.9 }),
    fence: std({
      map: T_fence,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      metalness: 0.4,
      roughness: 0.6,
    }),
    stripe: std({ map: T_stripe, roughness: 0.6 }),
    sirenR: std({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 2 }),
    sirenB: std({ color: 0x000040, emissive: 0x2050ff, emissiveIntensity: 0 }),
    beaconRed: std({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 2 }),
    containers: [0xb5462f, 0x2f6fa8, 0x3c8c5a, 0xc48a2a, 0x7a3f8c, 0xcfcfcf, 0x9c2f2f].map((c) =>
      std({ map: T_metal, color: c, roughness: 0.6, metalness: 0.1 })
    ),
    carPaints: [0x8b1e1e, 0x1e3a6b, 0xdedede, 0x222222, 0x5d6d5a, 0xc9a227, 0x6b6f75].map((c) =>
      std({ color: c, roughness: 0.35, metalness: 0.25 })
    ),
  };
  const BODY = [MAT.wood, MAT.wood, MAT.woodDark, MAT.woodWarm, MAT.concrete, MAT.plaster];
  const EMIT: Array<[THREE.MeshStandardMaterial, number, number]> = [
    [MAT.lattice, 0.15, 1.3],
    [MAT.shopGlow, 0.5, 1.6],
    [MAT.lantern, 0.4, 2.6],
    [MAT.lamp, 0.4, 2.8],
    [MAT.redSign, 0.1, 0.9],
    [MAT.tail, 0.3, 1.2],
  ];

  /* ================= geometry helpers ================= */
  function boxW(w: number, h: number, d: number, s = 4) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, (uv.getX(k) * dims[f][0]) / s, (uv.getY(k) * dims[f][1]) / s);
      }
    }
    return g;
  }
  function plane(w: number, h: number, ru = 1, rv = 1) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
    return g;
  }

  const STATIC = new THREE.Group();
  scene.add(STATIC);

  function mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    p: THREE.Object3D = STATIC
  ) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  function box(
    p: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    s = 4
  ) {
    return mesh(boxW(w, h, d, s), mat, x, y, z, p);
  }
  function flat(
    p: THREE.Object3D,
    w: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    s = 6
  ) {
    const m = mesh(plane(w, d, w / s, d / s), mat, x, y, z, p);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  const GABLE = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI / 2);
    geometriesToDispose.push(g);
    return g;
  })();
  function gable(
    p: THREE.Object3D,
    w: number,
    rh: number,
    d: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
    mat: THREE.Material = MAT.roofG
  ) {
    const m = mesh(GABLE, mat, x, y + rh / 3, z, p);
    m.scale.set(w, rh / 1.5, d / 1.732);
    m.rotation.y = ry;
    return m;
  }
  const cyl = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
  const sph = (r: number, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);

  /* ================= physics / footprint registry ================= */
  const COLL: CollBox[] = [];
  const SURF: SurfBox[] = [];
  const FOOT: CityMapFootprint[] = [];
  function addColl(x0: number, x1: number, z0: number, z1: number, h: number, surface = false) {
    COLL.push({ x0, x1, z0, z1, h });
    if (surface) SURF.push({ x0, x1, z0, z1, h });
  }
  function addFoot(x0: number, x1: number, z0: number, z1: number, kind = 'b') {
    FOOT.push({ x0, x1, z0, z1, kind });
  }
  function overlaps(x0: number, x1: number, z0: number, z1: number, m = 0.2) {
    return FOOT.some((f) => x0 < f.x1 + m && x1 > f.x0 - m && z0 < f.z1 + m && z1 > f.z0 - m);
  }
  function aabbColl(x: number, z: number, hw: number, hd: number, ry: number, h: number) {
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const ex = c * hw + s * hd;
    const ez = s * hw + c * hd;
    addColl(x - ex, x + ex, z - ez, z + ez, h);
  }

  /* ================= lights / sky ================= */
  const hemi = addToScene(new THREE.HemisphereLight(0xdde8ff, 0x6a5a48, 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.castShadow = !isSoftwareGl;
  sun.shadow.mapSize.set(shadowExtent <= 30 ? 1024 : 2048, shadowExtent <= 30 ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent,
    right: shadowExtent,
    top: shadowExtent,
    bottom: -shadowExtent,
    near: 1,
    far: 320,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  addToScene(sun);
  addToScene(sun.target);

  const rimLight = addToScene(new THREE.DirectionalLight(0x38bdf8, 0.35));

  const SKY = {
    day: skyTex('#8fb2cf', '#d3dde2', '#e6e4dc'),
    night: skyTex('#03050c', '#121a2e', '#232838'),
  };
  const skyGeo = new THREE.SphereGeometry(800, 32, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: SKY.day,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  geometriesToDispose.push(skyGeo);
  materialsToDispose.push(skyMat);
  const sky = addToScene(new THREE.Mesh(skyGeo, skyMat));

  scene.fog = new THREE.Fog(0xd8dee0, 70, 360);
  const PLIGHTS = [
    [-150, 4.5, -38],
    [-150, 4.5, -88],
    [-150, 5, 12],
    [-50, 6, -42],
    [50, 6, -24],
    [50, 6, -112],
    [150, 6, -28],
    [150, 7, 10],
    [150, 7, 68],
    [124, 6, 154],
    [-150, 14, -140],
    [-50, 6, 12],
    [-145, 16, 145],
  ].map(([x, y, z]) => {
    const l = addToScene(new THREE.PointLight(0xffb066, 0, 36, 1.5));
    l.position.set(x, y, z);
    return l;
  });

  /* ================= ground, water, roads ================= */
  function groundMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ) {
    geometriesToDispose.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    addToScene(m);
    return m;
  }
  groundMesh(plane(420, 375, 70, 62.5), MAT.cobble, 0, 0, -22.5);
  groundMesh(plane(1600, 700), std({ color: 0x5f5c57, roughness: 1 }), 0, -0.15, -185);
  const waterMat = std({
    color: 0x2a5d6e,
    map: T_water,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.93,
  });
  groundMesh(plane(1600, 700), waterMat, 0, -1.2, 515);
  box(STATIC, 420, 3, 2, MAT.stone, 0, -1.48, 164.5, 3);

  const roadMat = std({
    map: T_road,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const asphaltMat = std({
    map: T_asphalt,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const curbMat = std({
    map: T_concrete,
    color: 0xb8b4aa,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const r of CITY_ROADS) {
    const L = r.to - r.from;
    const mid = (r.from + r.to) / 2;
    const m = groundMesh(
      plane(L, 10, L / 10, 1),
      roadMat,
      r.axis === 'x' ? mid : r.at,
      0.03,
      r.axis === 'x' ? r.at : mid
    );
    if (r.axis === 'z') m.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const curb = groundMesh(
        plane(L, 1.4, L / 4, 1),
        curbMat,
        r.axis === 'x' ? mid : r.at + s * 5.7,
        0.07,
        r.axis === 'x' ? r.at + s * 5.7 : mid
      );
      if (r.axis === 'z') curb.rotation.z = Math.PI / 2;
    }
    if (r.axis === 'x') addFoot(r.from, r.to, r.at - 6.2, r.at + 6.2, 'road');
    else addFoot(r.at - 6.2, r.at + 6.2, r.from, r.to, 'road');
  }
  const CROSS: Array<[number, number]> = [];
  for (const a of CITY_ROADS.filter((r) => r.axis === 'x')) {
    for (const b of CITY_ROADS.filter((r) => r.axis === 'z')) {
      if (b.at >= a.from && b.at <= a.to && a.at >= b.from && a.at <= b.to) {
        CROSS.push([b.at, a.at]);
        groundMesh(plane(12.8, 12.8, 1.2, 1.2), asphaltMat, b.at, 0.05, a.at);
      }
    }
  }

  /* ================= small props ================= */
  function lantern(p: THREE.Object3D, x: number, y: number, z: number) {
    const l = mesh(sph(0.28), MAT.lantern, x, y, z, p);
    l.scale.y = 1.35;
    mesh(cyl(0.15, 0.15, 0.08), MAT.black, x, y + 0.4, z, p);
    mesh(cyl(0.15, 0.15, 0.08), MAT.black, x, y - 0.4, z, p);
  }
  function plantPot(p: THREE.Object3D, x: number, z: number) {
    mesh(cyl(0.3, 0.24, 0.5, 8), pick([MAT.rust, MAT.concrete, MAT.white]), x, 0.25, z, p);
    const b = mesh(new THREE.IcosahedronGeometry(R(0.35, 0.55), 0), MAT.plant, x, 0.75, z, p);
    b.scale.y = R(0.8, 1.4);
  }
  function tree(x: number, z: number, pink = true, s = 1, base = 0, p: THREE.Object3D = STATIC) {
    if (inClearRect(x, z, 2)) return;
    const g = new THREE.Group();
    g.position.set(x, base, z);
    p.add(g);
    mesh(cyl(0.25 * s, 0.4 * s, 3.4 * s, 7), MAT.trunk, 0, 1.7 * s, 0, g);
    for (let i = 0; i < 6; i++) {
      const b = mesh(
        new THREE.IcosahedronGeometry(R(1.3, 2.1) * s, 0),
        pink ? MAT.leafPink : MAT.leafGreen,
        R(-1.5, 1.5) * s,
        R(3.3, 4.8) * s,
        R(-1.5, 1.5) * s,
        g
      );
      b.rotation.set(R(0, 3), R(0, 3), 0);
    }
    addColl(x - 0.45, x + 0.45, z - 0.45, z + 0.45, base + 4);
  }
  function person(p: THREE.Object3D, x: number, z: number, ry: number, shirt: THREE.Material, base = 0) {
    if (inClearRect(x, z, 1.5)) return;
    const g = new THREE.Group();
    g.position.set(x, base, z);
    g.rotation.y = ry;
    p.add(g);
    mesh(new THREE.CapsuleGeometry(0.38, 0.7, 4, 8), shirt, 0, 1.3, 0, g);
    mesh(sph(0.26), MAT.skin, 0, 2.05, 0, g);
    for (const s of [-0.17, 0.17]) box(g, 0.22, 0.9, 0.24, MAT.pants, s, 0.45, 0, 1);
    addColl(x - 0.45, x + 0.45, z - 0.45, z + 0.45, base + 2.3);
  }
  function car(
    p: THREE.Object3D,
    x: number,
    z: number,
    ry: number,
    paint: THREE.Material,
    o: { y?: number; rx?: number; rz?: number; police?: boolean; noColl?: boolean } = {}
  ) {
    const g = new THREE.Group();
    g.position.set(x, o.y || 0, z);
    g.rotation.set(o.rx || 0, ry, o.rz || 0);
    p.add(g);
    box(g, 2, 0.8, 4.4, paint, 0, 0.75, 0, 10);
    box(g, 1.8, 0.66, 2.3, MAT.glass, 0, 1.48, -0.2, 10);
    box(g, 1.82, 0.08, 2.2, paint, 0, 1.84, -0.2, 10);
    for (const [wx, wz] of [
      [-1, 1.4],
      [1, 1.4],
      [-1, -1.4],
      [1, -1.4],
    ]) {
      const w = mesh(cyl(0.38, 0.38, 0.3, 12), MAT.tire, wx, 0.38, wz, g);
      w.rotation.z = Math.PI / 2;
    }
    for (const sx of [-0.65, 0.65]) {
      box(g, 0.4, 0.16, 0.05, MAT.lamp, sx, 0.85, 2.21, 1);
      box(g, 0.4, 0.16, 0.05, MAT.tail, sx, 0.85, -2.21, 1);
    }
    if (o.police) {
      box(g, 2.02, 0.22, 4.42, MAT.policeBlue, 0, 0.78, 0, 10);
      box(g, 0.55, 0.18, 0.35, MAT.sirenR, -0.32, 1.97, -0.2, 1);
      box(g, 0.55, 0.18, 0.35, MAT.sirenB, 0.32, 1.97, -0.2, 1);
    }
    if (!o.noColl) aabbColl(x, z, 1.05, 2.25, ry, 2);
    return g;
  }
  function van(p: THREE.Object3D, x: number, z: number, ry: number, paint: THREE.Material) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    p.add(g);
    box(g, 2.3, 2.3, 5.4, paint, 0, 1.55, -0.2, 10);
    box(g, 2.2, 1, 0.1, MAT.glass, 0, 2, 2.52, 10);
    box(g, 2.32, 0.5, 2, MAT.glass, 0, 2.05, 0.9, 10);
    for (const [wx, wz] of [
      [-1.05, 1.7],
      [1.05, 1.7],
      [-1.05, -1.9],
      [1.05, -1.9],
    ]) {
      const w = mesh(cyl(0.42, 0.42, 0.32, 12), MAT.tire, wx, 0.42, wz, g);
      w.rotation.z = Math.PI / 2;
    }
    for (const sx of [-0.75, 0.75]) box(g, 0.4, 0.2, 0.05, MAT.lamp, sx, 1.1, 2.51, 1);
    aabbColl(x, z, 1.2, 2.9, ry, 3);
  }
  function lampPost(x: number, z: number) {
    if (inClearRect(x, z, 1.5)) return;
    mesh(cyl(0.09, 0.12, 5.2, 8), MAT.darkMetal, x, 2.6, z);
    box(STATIC, 0.8, 0.25, 0.45, MAT.darkMetal, x, 5.25, z, 1);
    box(STATIC, 0.6, 0.06, 0.35, MAT.lamp, x, 5.1, z, 1);
    addColl(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 5.5);
  }
  function signBoard(
    p: THREE.Object3D,
    text: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
    bg = '#13203a',
    fg = '#f5e6b8',
    border?: string
  ) {
    const t = textTex(text, bg, fg, 1024, Math.round((1024 * h) / w), border);
    const signMat = std({
      map: t,
      emissiveMap: t,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
      roughness: 0.6,
    });
    const m = mesh(new THREE.PlaneGeometry(w, h), signMat, x, y, z, p);
    m.rotation.y = ry;
    EMIT.push([signMat, 0.12, 0.7]);
    return m;
  }

  /* ================= shop-house generator ================= */
  const FACE: Record<'s' | 'n' | 'e' | 'w', number> = {
    s: 0,
    n: Math.PI,
    e: Math.PI / 2,
    w: -Math.PI / 2,
  };
  function makeShop(
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    face: 's' | 'n' | 'e' | 'w',
    o: { mat?: THREE.Material; flat?: boolean } = {}
  ) {
    const [fw, fd] = face === 'e' || face === 'w' ? [d, w] : [w, d];
    if (rectOverlapsClear(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2, 0.8)) {
      return null;
    }
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = FACE[face];
    STATIC.add(g);
    box(g, w, h, d, o.mat || pick(BODY), 0, h / 2, 0, 3);
    const fz = d / 2;
    const gf = rand();
    if (gf < 0.33) {
      mesh(plane(w * 0.8, 2.8, (w * 0.8) / 3, 1), MAT.shutter, 0, 1.4, fz + 0.05, g);
    } else if (gf < 0.8) {
      mesh(plane(w * 0.72, 2.7), MAT.shopGlow, 0, 1.35, fz + 0.05, g);
      box(g, w * 0.6, 0.9, 0.6, MAT.woodDark, 0, 0.45, fz + 0.35, 2);
      for (let k = 0; k < 3; k++) {
        box(g, R(0.3, 0.6), R(0.2, 0.45), 0.3, pick(MAT.posters), R(-w * 0.25, w * 0.25), 1.05, fz + 0.35, 1);
      }
      if (rand() < 0.6) {
        mesh(plane(w * 0.6, 0.8), rand() < 0.5 ? MAT.norenB : MAT.norenR, 0, 2.45, fz + 0.12, g);
      }
    } else {
      box(g, 1.1, 2.2, 0.1, MAT.woodDark, -w * 0.25, 1.1, fz + 0.06, 2);
      mesh(plane(w * 0.35, 1.2, (w * 0.35) / 1.4, 1), MAT.lattice, w * 0.2, 1.6, fz + 0.05, g);
    }
    const eave = box(g, w + 0.4, 0.12, 1.3, MAT.roof, 0, 3.15, fz + 0.55, 2);
    eave.rotation.x = 0.18;
    for (let y = 4.6; y + 0.9 < h - 0.3; y += 2.9) {
      const ww = w * R(0.5, 0.85);
      mesh(plane(ww, 1.5, ww / 1.5, 1), MAT.lattice, R(-0.08, 0.08) * w, y, fz + 0.05, g);
    }
    if (rand() < 0.4 && h > 6) {
      const ww = d * 0.5;
      const sideWin = mesh(plane(ww, 1.4, ww / 1.4, 1), MAT.lattice, w / 2 + 0.05, h - 2.2, 0, g);
      sideWin.rotation.y = Math.PI / 2;
    }
    if (o.flat || rand() < 0.45) box(g, w + 0.2, 0.5, d + 0.2, MAT.concrete, 0, h + 0.25, 0, 3);
    else gable(g, w + 1.2, R(1.6, 2.8), d + 1.4, 0, h, 0);
    if (rand() < 0.55 && h > 5) {
      const ax = R(-w * 0.3, w * 0.3);
      const ay = Math.min(h - 1.2, R(3.9, h - 1));
      box(g, 1.2, 0.8, 0.55, MAT.acUnit, ax, ay, fz + 0.3, 1);
      mesh(new THREE.CircleGeometry(0.28, 12), MAT.fan, ax - 0.2, ay, fz + 0.58, g);
    }
    if (rand() < 0.5) {
      mesh(
        new THREE.BoxGeometry(0.12, 1.8, 0.7),
        MAT.redSign,
        (rand() < 0.5 ? -1 : 1) * (w / 2 - 0.4),
        R(3.7, Math.max(3.8, h - 1.3)),
        fz + 0.4,
        g
      );
    }
    if (rand() < 0.45) {
      for (const sx of [-w * 0.36, w * 0.36]) {
        if (rand() < 0.7) lantern(g, sx, 2.6, fz + 0.75);
      }
    }
    if (rand() < 0.55) {
      for (let k = RI(1, 2); k > 0; k--) {
        mesh(
          plane(0.9, 1.25),
          pick(MAT.posters),
          (rand() < 0.5 ? -1 : 1) * (w / 2 - 0.55),
          R(0.9, 2.2),
          fz + 0.06,
          g
        );
      }
    }
    if (rand() < 0.5) {
      for (let k = RI(1, 3); k > 0; k--) plantPot(g, R(-w * 0.45, w * 0.45), fz + 0.45);
    }
    if (rand() < 0.1) {
      box(g, 1, 1.9, 0.8, pick([MAT.redPaint, MAT.white, MAT.policeBlue]), w / 2 - 0.7, 0.95, fz + 0.45, 1);
      mesh(plane(0.7, 0.9), MAT.lamp, w / 2 - 0.7, 1.3, fz + 0.86, g);
    }
    addColl(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2, h + 0.5, !!o.flat);
    addFoot(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2, 'b');
    return g;
  }

  function row(axis: 'x' | 'z', from: number, to: number, at: number, face: 's' | 'n' | 'e' | 'w') {
    let p = from + R(0, 1.2);
    while (p < to - 5) {
      const w = Math.min(R(6.5, 11), to - p);
      if (w < 5) break;
      const d = R(9, 13);
      let h = R(5.8, 10.5);
      if (rand() < 0.12) h = R(12, 16);
      const off = face === 's' || face === 'e' ? -d / 2 : d / 2;
      const cx = axis === 'x' ? p + w / 2 : at + off;
      const cz = axis === 'x' ? at + off : p + w / 2;
      const [fw, fd] = axis === 'x' ? [w, d] : [d, w];
      if (!overlaps(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2)) {
        makeShop(cx, cz, w, d, h, face);
      }
      p += w + (rand() < 0.35 ? R(0.4, 1.8) : 0.05);
    }
  }
  function plainBuilding(cx: number, cz: number, w: number, d: number, h: number) {
    if (rectOverlapsClear(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0.8)) {
      return;
    }
    box(STATIC, w, h, d, pick(BODY), cx, h / 2, cz, 3);
    if (rand() < 0.5) gable(STATIC, w + 1, R(1.5, 2.6), d + 1, cx, h, cz);
    else box(STATIC, w + 0.2, 0.5, d + 0.2, MAT.concrete, cx, h + 0.25, cz, 3);
    const sides: Array<[number, number, number, number]> = [
      [0, 1, 0, w],
      [0, -1, Math.PI, w],
      [1, 0, Math.PI / 2, d],
      [-1, 0, -Math.PI / 2, d],
    ];
    for (const [nx, nz, ry, len] of sides) {
      if (rand() < 0.55 && h > 5) {
        const ww = len * 0.6;
        const m = mesh(
          plane(ww, 1.5, ww / 1.5, 1),
          MAT.lattice,
          cx + nx * (w / 2 + 0.05),
          R(3.5, h - 1.2),
          cz + nz * (d / 2 + 0.05)
        );
        m.rotation.y = ry;
      }
    }
    addColl(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h + 0.5);
    addFoot(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 'b');
  }
  function backfill(x0: number, x1: number, z0: number, z1: number) {
    for (let x = x0; x < x1 - 7; x += 11) {
      for (let z = z0; z < z1 - 7; z += 11) {
        if (rand() < 0.25) continue;
        const w = R(7, 10.5);
        const d = R(7, 10.5);
        const cx = x + w / 2 + R(0, 0.5);
        const cz = z + d / 2 + R(0, 0.5);
        if (
          cx + w / 2 > x1 ||
          cz + d / 2 > z1 ||
          overlaps(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0.4)
        ) {
          continue;
        }
        plainBuilding(cx, cz, w, d, R(6, 15));
      }
    }
  }

  /* ================= LANDMARKS ================= */
  function buildHill() {
    const H = 9;
    for (const [x0, x1, z0, z1] of [
      [-200, -106, -200, -125],
      [-200, -154, -125, -108],
      [-146, -106, -125, -108],
    ]) {
      const w = x1 - x0;
      const d = z1 - z0;
      box(STATIC, w, H, d, MAT.stone, (x0 + x1) / 2, H / 2, (z0 + z1) / 2, 4);
      flat(STATIC, w, d, MAT.cobble, (x0 + x1) / 2, H + 0.02, (z0 + z1) / 2);
      addColl(x0, x1, z0, z1, H, true);
      addFoot(x0, x1, z0, z1, 'hill');
    }
    const n = 18;
    const z0 = -125;
    const z1 = -108;
    const st = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const hh = ((i + 1) * H) / n;
      box(STATIC, 8, hh, st, MAT.stone, -150, hh / 2, z1 - (i + 0.5) * st, 2);
    }
    SURF.push({ x0: -154, x1: -146, z0: -125, z1: -108, ramp: true, hz0: H, hz1: 0 });
    addFoot(-154, -146, -125, -108, 'stairs');
    for (let i = 0; i < 6; i++) {
      tree(R(-195, -165), R(-195, -130), rand() < 0.6, R(0.9, 1.3), H);
      tree(R(-135, -110), R(-195, -130), rand() < 0.6, R(0.9, 1.3), H);
    }
    for (const sx of [-155.5, -144.5]) {
      box(STATIC, 0.8, 1, 0.8, MAT.stone, sx, H + 0.5, -127, 1);
      box(STATIC, 0.9, 0.8, 0.9, MAT.lamp, sx, H + 1.4, -127, 1);
      gable(STATIC, 1.3, 0.6, 1.3, sx, H + 1.8, -127);
    }
    const B = H;
    const tz = -168;
    for (const sx of [-4.5, 4.5]) {
      mesh(cyl(0.45, 0.5, 7.5), MAT.redPaint, -150 + sx, B + 3.75, -134);
      addColl(-150 + sx - 0.5, -150 + sx + 0.5, -134.5, -133.5, B + 8);
    }
    box(STATIC, 12, 0.6, 0.8, MAT.redPaint, -150, B + 6.1, -134, 2);
    box(STATIC, 13.5, 0.55, 1.1, MAT.black, -150, B + 7.75, -134, 2);
    for (let z = -138; z > -158; z -= 5) {
      for (const sx of [-5, 5]) {
        box(STATIC, 0.9, 1.4, 0.9, MAT.stone, -150 + sx, B + 0.7, z, 1);
        box(STATIC, 1, 0.8, 1, MAT.lamp, -150 + sx, B + 1.8, z, 1);
        gable(STATIC, 1.4, 0.6, 1.4, -150 + sx, B + 2.2, z);
      }
    }
    flat(STATIC, 4, 22, MAT.stone, -150, B + 0.04, -146, 2);
    box(STATIC, 26, 1.2, 18, MAT.stone, -150, B + 0.6, tz, 3);
    addColl(-163, -137, tz - 9, tz + 9, B + 1.2, true);
    box(STATIC, 20, 6, 13, MAT.woodWarm, -150, B + 4.2, tz - 1, 3);
    addColl(-160, -140, tz - 7.5, tz + 5.5, B + 14);
    for (let i = 0; i < 6; i++) {
      mesh(cyl(0.32, 0.35, 6), MAT.redPaint, -158.5 + i * 3.4, B + 4.2, tz + 6.2);
    }
    mesh(plane(14, 3.5, 6, 1.5), MAT.lattice, -150, B + 4.2, tz + 5.55);
    box(STATIC, 3, 1.2, 1.4, MAT.woodDark, -150, B + 1.8, tz + 7.5, 1);
    gable(STATIC, 26, 3.5, 19, -150, B + 7.2, tz - 1);
    box(STATIC, 14, 2, 9, MAT.woodWarm, -150, B + 10.2, tz - 1, 3);
    gable(STATIC, 18, 3, 12, -150, B + 11.2, tz - 1);
    addFoot(-163, -137, tz - 9, tz + 9, 'lm');
  }

  const WIRES: THREE.Vector3[] = [];
  function buildAlley() {
    addFoot(-153.2, -146.8, -108, -5, 'alley');
    flat(STATIC, 7, 100, MAT.cobble, -150, 0.03, -57, 5);
    for (let z = -15; z > -105; z -= 9) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(new THREE.Vector3(-153.4 + t * 6.8, 5.6 - Math.sin(t * Math.PI) * 0.7, z));
      }
      if (!inClearRect(-150, z, 2)) {
        for (let i = 0; i < pts.length - 1; i++) {
          WIRES.push(pts[i], pts[i + 1]);
        }
        for (let i = 2; i <= 6; i += 2) lantern(STATIC, pts[i].x, pts[i].y - 0.55, z);
      }
    }
    for (let z = -20; z > -105; z -= 18) {
      if (inClearRect(-150, z, 2)) continue;
      for (const sx of [-152.8, -147.2]) box(STATIC, 0.5, 0.7, 0.5, MAT.lamp, sx, 3.8, z, 1);
    }
  }

  function buildPark() {
    const x0 = -93.5;
    const x1 = -6.5;
    const z0 = -83.5;
    const z1 = -6.5;
    const cx = -50;
    const cz = -45;
    addFoot(x0, x1, z0, z1, 'park');
    flat(STATIC, x1 - x0, z1 - z0, MAT.grass, cx, 0.05, cz, 8);
    flat(STATIC, 5, z1 - z0, MAT.cobble, cx, 0.08, cz, 5);
    flat(STATIC, x1 - x0, 5, MAT.cobble, cx, 0.085, cz, 5);
    const hedge = (ax0: number, ax1: number, az0: number, az1: number) => {
      box(STATIC, ax1 - ax0, 1.1, az1 - az0, MAT.hedge, (ax0 + ax1) / 2, 0.55, (az0 + az1) / 2, 2);
      addColl(ax0, ax1, az0, az1, 1.1);
    };
    hedge(x0, cx - 3, z1 - 1.2, z1);
    hedge(cx + 3, x1, z1 - 1.2, z1);
    hedge(x0, cx - 3, z0, z0 + 1.2);
    hedge(cx + 3, x1, z0, z0 + 1.2);
    hedge(x0, x0 + 1.2, z0, cz - 3);
    hedge(x0, x0 + 1.2, cz + 3, z1);
    hedge(x1 - 1.2, x1, z0, cz - 3);
    hedge(x1 - 1.2, x1, cz + 3, z1);
    const pond = mesh(new THREE.CircleGeometry(8, 40), MAT.pond, -68, 0.1, -62);
    pond.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const s = mesh(
        new THREE.DodecahedronGeometry(R(0.5, 0.8), 0),
        MAT.stone,
        -68 + Math.cos(a) * 8.4,
        0.2,
        -62 + Math.sin(a) * 8.4
      );
      s.scale.y = 0.6;
    }
    const gx = -28;
    const gz = -62;
    mesh(cyl(5, 5, 0.5, 8), MAT.woodWarm, gx, 0.25, gz);
    SURF.push({ x0: gx - 3.5, x1: gx + 3.5, z0: gz - 3.5, z1: gz + 3.5, h: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = gx + Math.cos(a) * 4.4;
      const pz = gz + Math.sin(a) * 4.4;
      mesh(cyl(0.18, 0.18, 3.4, 8), MAT.redPaint, px, 2.2, pz);
      addColl(px - 0.2, px + 0.2, pz - 0.2, pz + 0.2, 4);
    }
    const roofc = mesh(new THREE.ConeGeometry(6.2, 2.6, 8), MAT.roofG, gx, 5.2, gz);
    roofc.rotation.y = Math.PI / 8;
    const bench = (x: number, z: number, ry: number) => {
      if (inClearRect(x, z, 2)) return;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      STATIC.add(g);
      box(g, 2.4, 0.12, 0.6, MAT.woodWarm, 0, 0.55, 0, 1);
      box(g, 2.4, 0.5, 0.1, MAT.woodWarm, 0, 0.9, -0.28, 1);
      for (const s of [-1, 1]) box(g, 0.1, 0.55, 0.55, MAT.darkMetal, s, 0.27, 0, 1);
    };
    bench(-56, -20, 0);
    bench(-44, -20, 0);
    bench(-56, -70, Math.PI);
    bench(-60, -50, Math.PI / 2);
    bench(-30, -50, -Math.PI / 2);
    for (const [lx, lz] of [
      [-54, -30],
      [-46, -60],
      [-80, -48],
      [-20, -42],
    ]) {
      lampPost(lx, lz);
    }
    for (let i = 0; i < 9; i++) {
      const bx = -84 + R(-3, 3);
      const bz = -16 + R(-2.5, 2);
      if (inClearRect(bx, bz, 1.5)) continue;
      const b = mesh(
        new THREE.IcosahedronGeometry(R(0.9, 1.5), 1),
        MAT.hedge,
        bx,
        R(0.6, 1),
        bz
      );
      b.scale.y = 0.8;
    }
    for (let i = 0; i < 18; i++) {
      let x: number;
      let z: number;
      let attempts = 0;
      do {
        x = R(x0 + 4, x1 - 4);
        z = R(z0 + 4, z1 - 4);
        attempts++;
      } while (
        attempts < 120 &&
        (Math.abs(x - cx) < 5 ||
          Math.abs(z - cz) < 5 ||
          Math.hypot(x + 68, z + 62) < 11 ||
          Math.hypot(x - gx, z - gz) < 8 ||
          Math.hypot(x + 84, z + 16) < 6 ||
          inClearRect(x, z, 2.5))
      );
      if (attempts < 120) {
        tree(x, z, rand() < 0.65, R(0.9, 1.25));
      }
    }
  }

  function buildMalhotra() {
    addFoot(22, 78, -163, -96.5, 'lm');
    const wall = (x0: number, x1: number, z0: number, z1: number) => {
      if (rectOverlapsClear(x0, x1, z0, z1, 0.2)) return;
      box(STATIC, x1 - x0, 2.6, z1 - z0, MAT.plaster, (x0 + x1) / 2, 1.3, (z0 + z1) / 2, 3);
      box(STATIC, x1 - x0 + 0.2, 0.2, z1 - z0 + 0.2, MAT.roof, (x0 + x1) / 2, 2.7, (z0 + z1) / 2, 2);
      addColl(x0, x1, z0, z1, 2.8);
    };
    wall(25, 47, -110.3, -109.7);
    wall(53, 75, -110.3, -109.7);
    wall(25, 75, -160.3, -159.7);
    wall(24.7, 25.3, -160, -110);
    wall(74.7, 75.3, -160, -110);
    for (const px of [46.4, 53.6]) {
      if (inClearRect(px, -110, 0.5)) continue;
      box(STATIC, 1.2, 3.4, 1.2, MAT.stone, px, 1.7, -110, 1);
      box(STATIC, 0.6, 0.6, 0.6, MAT.lamp, px, 3.7, -110, 1);
      addColl(px - 0.6, px + 0.6, -110.6, -109.4, 3.6);
    }
    if (!inClearRect(47.6, -111.3, 0.5)) {
      const gateL = box(STATIC, 3, 2.2, 0.12, MAT.darkMetal, 46.5 + 1.1, 1.2, -111.3, 1);
      gateL.rotation.y = -1.1;
    }
    if (!inClearRect(57, -108.4, 0.5)) {
      mesh(cyl(0.08, 0.08, 1.2, 6), MAT.darkMetal, 57, 0.6, -108.4);
      box(STATIC, 0.7, 0.5, 0.45, MAT.redPaint, 57, 1.35, -108.4, 1);
      box(STATIC, 0.5, 0.05, 0.1, MAT.black, 57, 1.45, -108.16, 1);
    }
    if (!inClearRect(41, -106, 1.5)) {
      box(STATIC, 2.6, 2.6, 2.6, MAT.plasterW, 41, 1.3, -106, 2);
      box(STATIC, 3, 0.2, 3, MAT.darkMetal, 41, 2.7, -106, 1);
      mesh(plane(1.6, 0.9), MAT.glass, 41, 1.7, -104.68);
      addColl(39.7, 42.3, -107.3, -104.7, 3);
    }
    person(STATIC, 44, -105, Math.PI * 0.1, MAT.copShirt);
    flat(STATIC, 49, 49, MAT.grass, 50, 0.05, -135, 6);
    flat(STATIC, 6, 18, MAT.cobble, 50, 0.08, -119, 4);
    box(STATIC, 28, 4, 22, MAT.plasterW, 50, 2, -139, 3);
    box(STATIC, 22, 3.6, 16, MAT.plasterW, 50, 5.8, -141, 3);
    box(STATIC, 29, 0.3, 23, MAT.darkMetal, 50, 4.15, -139, 4);
    box(STATIC, 23, 0.4, 17, MAT.darkMetal, 50, 7.8, -141, 4);
    mesh(plane(20, 2.4, 6, 1), MAT.glass, 50, 2.1, -127.94);
    mesh(plane(16, 2.2, 5, 1), MAT.glass, 50, 5.8, -132.94);
    box(STATIC, 3, 3, 0.2, MAT.woodWarm, 50, 1.5, -127.9, 1);
    addColl(36, 64, -150, -128, 8);
    addFoot(36, 64, -150, -128, 'lmb');
    const pool = mesh(plane(12, 8), MAT.pond, 64, 0.1, -119);
    pool.rotation.x = -Math.PI / 2;
    if (!inClearRect(38, -120, 1.5)) {
      car(STATIC, 38, -120, 0, MAT.carPaints[3]);
    }
    for (const [tx, tz] of [
      [29, -114],
      [71, -114],
      [29, -155],
      [71, -155],
      [29, -132],
    ]) {
      tree(tx, tz, false, 1.1);
    }
  }

  function buildBank() {
    addFoot(26, 74, -62, -6.5, 'lm');
    addFoot(30, 70, -60, -34, 'lmb');
    const stoneL = std({ map: T_plaster, color: 0xe6dccb, roughness: 0.8 });
    box(STATIC, 40, 14, 26, stoneL, 50, 7, -47, 4);
    addColl(30, 70, -60, -34, 15);
    box(STATIC, 41, 1.2, 27, MAT.concrete, 50, 14.6, -47, 4);
    mesh(new THREE.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.copper, 50, 15.2, -47);
    box(STATIC, 32, 0.4, 8, MAT.concrete, 50, 0.2, -30, 3);
    box(STATIC, 30, 0.4, 4.5, MAT.concrete, 50, 0.6, -31.75, 3);
    SURF.push({ x0: 34, x1: 66, z0: -34, z1: -26, h: 0.4 }, { x0: 35, x1: 65, z0: -34, z1: -29.5, h: 0.8 });
    for (let i = 0; i < 6; i++) {
      const x = 36 + i * 5.6;
      mesh(cyl(0.7, 0.75, 10.4, 14), stoneL, x, 6, -31.5);
      addColl(x - 0.7, x + 0.7, -32.2, -30.8, 12);
    }
    box(STATIC, 32, 1.6, 5, stoneL, 50, 12, -31.8, 3);
    signBoard(STATIC, 'CROWN VAULT BANK', 22, 1.3, 50, 12, -29.27, 0, '#1d2a44', '#f1d27a');
    box(STATIC, 5, 6, 0.3, MAT.gold, 50, 3.8, -33.9, 1);
    for (const x of [38.8, 44.4, 55.6, 61.2]) mesh(plane(2.2, 5), MAT.glass, x, 5, -33.94);
    person(STATIC, 46, -29, 0, MAT.copShirt, 0.8);
    person(STATIC, 54, -29, 0, MAT.copShirt, 0.8);
    for (const x of [32, 68]) lampPost(x, -24);
  }

  function buildPolice() {
    addFoot(128, 172, -62, -8, 'lm');
    addFoot(134, 166, -60, -38, 'lmb');
    box(STATIC, 32, 12, 22, MAT.plasterW, 150, 6, -49, 4);
    addColl(134, 166, -60, -38, 13);
    box(STATIC, 32.3, 1.2, 22.3, MAT.policeBlue, 150, 4.4, -49, 4);
    for (let fl = 0; fl < 2; fl++) {
      for (let i = 0; i < 6; i++) mesh(plane(3.2, 1.8), MAT.glass, 137.5 + i * 5, 7 + fl * 3, -37.94);
    }
    signBoard(STATIC, 'CITY POLICE · ZONE 4', 16, 1.6, 150, 2.6, -37.9, 0, '#1f4fa0', '#ffffff');
    box(STATIC, 10, 0.4, 4, MAT.concrete, 150, 3.6, -36, 2);
    box(STATIC, 3, 2.4, 0.1, MAT.glass, 150, 1.2, -37.9, 1);
    flat(STATIC, 44, 26, std({ map: T_asphalt, roughness: 0.85 }), 150, 0.06, -22, 6);
    for (let i = 0; i < 7; i++) flat(STATIC, 0.15, 5, MAT.white, 134 + i * 5, 0.08, -30, 1);
    car(STATIC, 136.5, -30, 0, MAT.white, { police: true });
    car(STATIC, 141.5, -30, 0, MAT.white, { police: true });
    car(STATIC, 156.5, -30, 0, MAT.carPaints[1]);
    mesh(cyl(0.1, 0.12, 11, 8), MAT.white, 170, 5.5, -36);
    mesh(plane(3, 1.8), std({ color: 0x1f4fa0, side: THREE.DoubleSide }), 171.6, 9.8, -36);
    addColl(169.8, 170.2, -36.2, -35.8, 11);
    person(STATIC, 147, -35, 0, MAT.copShirt);
  }

  function buildRoadblock() {
    for (const z of [-3.2, 0, 3.2]) {
      box(STATIC, 0.5, 1, 2.6, MAT.stripe, 186, 0.9, z, 2);
      for (const dz of [-1, 1]) box(STATIC, 0.15, 0.5, 0.15, MAT.darkMetal, 186, 0.25, z + dz, 1);
    }
    addColl(185.7, 186.3, -4.6, 4.6, 1.3);
    car(STATIC, 190, -2.5, 0.6, MAT.white, { police: true });
    car(STATIC, 190, 3, -0.5, MAT.white, { police: true });
    car(STATIC, 179, 2.5, 1.9, std({ color: 0x3a2a26, roughness: 0.8 }), { y: 2.1, rz: Math.PI });
    for (let i = 0; i < 6; i++) {
      mesh(
        new THREE.ConeGeometry(0.25, 0.7, 10),
        std({ color: 0xff6a1a }),
        182 + R(-1, 1),
        0.35,
        R(-4.5, 4.5)
      );
    }
    person(STATIC, 193, 0, -Math.PI / 2, MAT.copShirt);
  }

  function buildGarage() {
    addFoot(-64, -36, 6.5, 32, 'lm');
    addFoot(-62, -38, 14, 30, 'lmb');
    box(STATIC, 24, 8, 0.5, MAT.metal, -50, 4, 29.75, 3);
    addColl(-62, -38, 29.5, 30, 9);
    for (const x of [-61.75, -38.25]) {
      box(STATIC, 0.5, 8, 16, MAT.metal, x, 4, 22, 3);
      addColl(x - 0.25, x + 0.25, 14, 30, 9);
    }
    box(STATIC, 25, 0.5, 16.6, MAT.darkMetal, -50, 8.25, 22, 4);
    box(STATIC, 24, 1.6, 0.5, MAT.darkMetal, -50, 7.2, 14, 2);
    signBoard(STATIC, "RANDY'S GARAGE", 14, 1.4, -50, 7.2, 13.72, Math.PI, '#1b1b1b', '#9be15d');
    flat(STATIC, 23, 15.5, std({ map: T_concrete, color: 0x777777 }), -50, 0.06, 22, 5);
    van(STATIC, -50, 22, 0, std({ color: 0x3d4f3a, roughness: 0.5, metalness: 0.3 }));
    for (let i = 0; i < 4; i++) {
      mesh(cyl(0.45, 0.45, 0.3, 14), MAT.tire, -59, 0.15 + i * 0.3, 16 + i * 0.05);
    }
    for (let i = 0; i < 3; i++) {
      mesh(cyl(0.45, 0.45, 1.2, 12), pick([MAT.redPaint, MAT.policeBlue, MAT.yellow]), -40, 0.6, 26 - i * 1.1);
    }
    box(STATIC, 0.6, 3, 5, MAT.darkMetal, -60.8, 1.5, 24, 1);
    for (let i = 0; i < 4; i++) {
      box(STATIC, 0.5, 0.4, 0.5, pick(MAT.posters), -60.7, 0.6 + i * 0.7, 22.5 + R(0, 3), 1);
    }
    box(STATIC, 1.2, 1, 0.6, MAT.redPaint, -40, 0.5, 18, 1);
  }

  function buildHideout() {
    addFoot(-160, -140, 6.5, 34, 'lm');
    addFoot(-158, -142, 16, 32, 'lmb');
    box(STATIC, 16, 4.5, 16, MAT.woodDark, -150, 2.25, 24, 3);
    box(STATIC, 17, 4, 15, MAT.wood, -150, 6.5, 24.5, 3);
    gable(STATIC, 18, 2.6, 17, -150, 8.5, 24.5);
    addColl(-158, -142, 16, 32, 11);
    mesh(plane(6, 3.4, 2, 1), MAT.shutter, -153.5, 1.7, 15.94).rotation.y = Math.PI;
    box(STATIC, 1.2, 2.4, 0.1, MAT.woodDark, -146, 1.2, 15.98, 1);
    for (const x of [-154, -146]) {
      mesh(plane(3, 1.6, 2, 1), MAT.lattice, x, 6.5, 16.95).rotation.y = Math.PI;
      const b1 = box(STATIC, 3.3, 0.2, 0.08, MAT.woodWarm, x, 6.5, 17.05, 1);
      b1.rotation.z = 0.4;
      const b2 = box(STATIC, 3.3, 0.2, 0.08, MAT.woodWarm, x, 6.5, 17.05, 1);
      b2.rotation.z = -0.4;
    }
    mesh(cyl(0.05, 0.05, 5, 6), MAT.darkMetal, -144, 13, 26);
    const dish = mesh(
      new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, 0.8),
      MAT.white,
      -155,
      10.8,
      22
    );
    dish.rotation.x = -1;
    for (let i = 0; i < 5; i++) {
      const s = R(0.8, 1.2);
      const cx = -157 + R(0, 3);
      const cz = 12 + R(-1.5, 1.5);
      if (!inClearRect(cx, cz, 0.5)) {
        box(STATIC, s, s, s, MAT.woodWarm, cx, s / 2 + (i > 3 ? 1 : 0), cz, 1);
      }
    }
    addColl(-158, -154, 10.5, 13.5, 1.3);
    box(STATIC, 0.5, 1, 0.5, MAT.lamp, -146.5, 3.6, 16.3, 1);
    mesh(cyl(0.5, 0.5, 1, 12), MAT.rust, -141.5, 0.5, 13);
    addColl(-142, -141, 12.5, 13.5, 1.2);
  }

  function buildWarehouse() {
    addFoot(114, 192, 6.5, 82, 'lm');
    addFoot(125, 175, 30, 60, 'lmb');
    const fence = (x0: number, x1: number, z0: number, z1: number) => {
      if (rectOverlapsClear(x0, x1, z0, z1, 0.4)) return;
      const len = Math.max(x1 - x0, z1 - z0);
      const m = mesh(plane(len, 3, len / 1.5, 2), MAT.fence, (x0 + x1) / 2, 1.5, (z0 + z1) / 2);
      if (x1 - x0 < z1 - z0) m.rotation.y = Math.PI / 2;
      addColl(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15, 3.2);
      for (let t = 0; t <= len; t += 4) {
        const px = x1 - x0 > z1 - z0 ? x0 + t : x0;
        const pz = x1 - x0 > z1 - z0 ? z0 : z0 + t;
        mesh(cyl(0.07, 0.07, 3.2, 6), MAT.darkMetal, px, 1.6, pz);
      }
    };
    fence(115, 143, 14, 14);
    fence(157, 190, 14, 14);
    fence(115, 190, 80, 80);
    fence(115, 115, 14, 80);
    fence(190, 190, 14, 80);
    const wh = std({ map: T_metal, color: 0x8f979e, roughness: 0.6, metalness: 0.15 });
    box(STATIC, 50, 12, 30, wh, 150, 6, 45, 4);
    gable(
      STATIC,
      51,
      3,
      31,
      150,
      12,
      45,
      0,
      std({ map: T_roofG, color: 0x9aa0a6, metalness: 0.2, roughness: 0.5, flatShading: true })
    );
    addColl(125, 175, 30, 60, 15);
    for (const x of [134, 150, 166]) mesh(plane(8, 7, 2.5, 2), MAT.shutter, x, 3.5, 29.94).rotation.y = Math.PI;
    signBoard(STATIC, 'PABLO IMPORTS & EXPORTS', 26, 2, 150, 9.6, 29.92, Math.PI, '#2a1036', '#e6c3ff');
    box(STATIC, 10, 5, 12, MAT.concrete, 181, 2.5, 36, 3);
    addColl(176, 186, 30, 42, 6);
    mesh(plane(3, 1.4), MAT.glass, 181, 3, 29.94).rotation.y = Math.PI;
    for (let i = 0; i < 6; i++) {
      const cx = 122 + i * 11;
      const cz = 70 + (i % 2) * 4;
      if (rectOverlapsClear(cx - 5, cx + 5, cz - 1.5, cz + 1.5, 1)) continue;
      const h = RI(1, 2);
      for (let k = 0; k < h; k++) {
        box(STATIC, 10, 2.6, 2.5, pick(MAT.containers), cx, 1.3 + k * 2.6, cz, 3);
      }
      addColl(cx - 5, cx + 5, cz - 1.25, cz + 1.25, h * 2.6);
    }
    for (let i = 0; i < 4; i++) {
      if (!inClearRect(120 + i * 2, 22, 1)) {
        box(STATIC, 1.4, 0.9, 1.4, MAT.woodWarm, 120 + i * 2, 0.45, 22, 1);
      }
    }
    const ax = 183;
    const az = 22;
    const H = 26;
    for (const [dx, dz] of [
      [-1.2, -1.2],
      [1.2, -1.2],
      [-1.2, 1.2],
      [1.2, 1.2],
    ]) {
      const l = mesh(cyl(0.08, 0.12, H, 6), MAT.darkMetal, ax + dx * 0.55, H / 2, az + dz * 0.55);
      l.rotation.z = -dx * 0.045;
      l.rotation.x = dz * 0.045;
    }
    for (let y = 2; y < H; y += 3) {
      const s = 1.3 * (1 - (y / H) * 0.55);
      box(STATIC, s * 2, 0.07, 0.07, MAT.darkMetal, ax, y, az - s, 1);
      box(STATIC, s * 2, 0.07, 0.07, MAT.darkMetal, ax, y, az + s, 1);
      box(STATIC, 0.07, 0.07, s * 2, MAT.darkMetal, ax - s, y, az, 1);
      box(STATIC, 0.07, 0.07, s * 2, MAT.darkMetal, ax + s, y, az, 1);
    }
    const dish = mesh(
      new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, 0, 0.9),
      MAT.white,
      ax,
      20,
      az - 1
    );
    dish.rotation.x = -1.3;
    mesh(sph(0.3), MAT.beaconRed, ax, H + 0.3, az);
    addColl(ax - 1.4, ax + 1.4, az - 1.4, az + 1.4, H);
    person(STATIC, 150, 25, 0, MAT.guardShirt);
    person(STATIC, 165, 64, Math.PI, MAT.guardShirt);
    person(STATIC, 140, 18, 0.4, MAT.guardShirt);
    lampPost(146, 12);
    lampPost(154, 12);
  }

  const BOAT = addToScene(new THREE.Group());
  const smallBoats: Array<{ group: THREE.Group; ph: number }> = [];
  function buildHarbour() {
    addFoot(6.5, 198, 101.5, 165, 'harbour');
    flat(STATIC, 191, 63, std({ map: T_concrete, color: 0x8a8a84 }), 102, 0.04, 133, 8);
    for (let x = 10; x < 196; x += 12) {
      if (inClearRect(x, 163.4, 0.5)) continue;
      mesh(cyl(0.3, 0.35, 0.7, 10), MAT.darkMetal, x, 0.35, 163.4);
      addColl(x - 0.35, x + 0.35, 163, 163.8, 0.8);
    }
    box(STATIC, 8, 2.8, 37, MAT.woodWarm, 124, -1.1, 181.5, 3);
    SURF.push({ x0: 120, x1: 128, z0: 163, z1: 200, h: 0.3 });
    addFoot(120, 128, 163, 200, 'pier');
    for (let z = 166; z < 200; z += 5) {
      for (const x of [120.3, 127.7]) mesh(cyl(0.25, 0.25, 4, 8), MAT.trunk, x, -1, z);
    }
    box(BOAT, 9, 2.4, 25, MAT.white, 0, -0.4, 0, 4);
    box(BOAT, 9.1, 0.6, 25.1, MAT.policeBlue, 0, -1.2, 0, 4);
    const bow = mesh(cyl(4.5, 0.2, 4, 4), MAT.white, 0, -0.4, 14.5, BOAT);
    bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    bow.scale.set(1, 1, 0.55);
    box(BOAT, 5, 2.6, 7, MAT.plasterW, 0, 2.1, -3, 2);
    mesh(plane(4.2, 1), MAT.glass, 0, 2.6, 0.52, BOAT);
    box(BOAT, 5.4, 0.2, 7.4, MAT.darkMetal, 0, 3.5, -3, 2);
    mesh(cyl(0.1, 0.1, 8, 6), MAT.darkMetal, 0, 7, -3, BOAT);
    mesh(sph(0.25), MAT.lantern, 0, 11, -3, BOAT);
    for (let i = 0; i < 4; i++) box(BOAT, 1, 0.8, 1, MAT.woodWarm, R(-3, 3), 1.2, R(4, 10), 1);
    BOAT.position.set(132.5, 0, 183);
    SURF.push({ x0: 128, x1: 137, z0: 170.5, z1: 195.5, h: 0.8 });
    addColl(130, 135, 176.5, 183.5, 4);
    for (let x = 14; x < 92; x += 13) {
      for (let z = 108; z < 158; z += 7.5) {
        if (rand() < 0.22) continue;
        if (rectOverlapsClear(x, x + 12, z - 1.25, z + 1.25, 1)) continue;
        const h = RI(1, 3);
        for (let k = 0; k < h; k++) {
          box(STATIC, 12, 2.6, 2.5, pick(MAT.containers), x + 6, 1.3 + k * 2.6, z, 3);
        }
        addColl(x, x + 12, z - 1.25, z + 1.25, h * 2.6 + 0.1);
      }
    }
    const cr = MAT.yellow;
    const cx = 160;
    const cz = 152;
    for (const [dx, dz] of [
      [-6, -5],
      [6, -5],
      [-6, 7],
      [6, 7],
    ]) {
      box(STATIC, 1, 22, 1, cr, cx + dx, 11, cz + dz, 2);
      addColl(cx + dx - 0.5, cx + dx + 0.5, cz + dz - 0.5, cz + dz + 0.5, 22);
    }
    box(STATIC, 14, 1.5, 1.5, cr, cx, 22, cz - 5, 2);
    box(STATIC, 14, 1.5, 1.5, cr, cx, 22, cz + 7, 2);
    box(STATIC, 2, 1.5, 50, cr, cx, 23.5, cz + 14, 3);
    box(STATIC, 4, 3, 4, MAT.darkMetal, cx, 21.5, cz + 26, 1);
    for (let i = 0; i < 5; i++) {
      const g = addToScene(new THREE.Group());
      g.position.set(-150 + i * 34 + R(-4, 4), 0, 170);
      smallBoats.push({ group: g, ph: R(0, 6) });
      box(g, 2.6, 0.9, 7, pick([MAT.white, MAT.redPaint, MAT.policeBlue]), 0, -0.9, 0, 2);
      box(g, 1.6, 1, 2, MAT.white, 0, 0.1, -1, 1);
    }
    for (const x of [40, 80, 110]) lampPost(x, 160);
    person(STATIC, 133, 192, Math.PI, MAT.guardShirt, 0.8);
  }

  function buildRooftops() {
    addFoot(-198, -106.5, 101.5, 164, 'roofs');
    const roofs: Array<[number, number, number, number, number, number]> = [
      [-113, -108, 106, 128, 8, 0],
      [-134, -113, 106, 128, 8, 1],
      [-150, -137, 106, 124, 9, 1],
      [-168, -153, 104, 126, 10, 1],
      [-192, -171, 106, 130, 9, 1],
      [-190, -172, 134, 160, 10, 1],
      [-168, -150, 132, 160, 11, 1],
      [-146, -128, 132, 158, 12, 1],
    ];
    for (const [x0, x1, z0, z1, h, full] of roofs) {
      const w = x1 - x0;
      const d = z1 - z0;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      box(
        STATIC,
        w,
        h,
        d,
        full ? pick([MAT.concrete, MAT.wood, MAT.plaster, MAT.woodDark]) : MAT.darkMetal,
        cx,
        h / 2,
        cz,
        3
      );
      box(STATIC, w + 0.1, 0.25, d + 0.1, MAT.concrete, cx, h + 0.12, cz, 3);
      addColl(x0, x1, z0, z1, h + 0.25, true);
      addFoot(x0, x1, z0, z1, 'lmb');
      if (!full) continue;
      for (let y = 2.5; y < h - 1; y += 2.8) {
        mesh(plane(w * 0.7, 1.4, (w * 0.7) / 1.5, 1), MAT.lattice, cx, y, z1 + 0.05);
        const b = mesh(plane(w * 0.7, 1.4, (w * 0.7) / 1.5, 1), MAT.lattice, cx, y, z0 - 0.05);
        b.rotation.y = Math.PI;
        const s1 = mesh(plane(d * 0.7, 1.4, (d * 0.7) / 1.5, 1), MAT.lattice, x0 - 0.05, y, cz);
        s1.rotation.y = -Math.PI / 2;
      }
      const tx = cx + R(-w / 4, w / 4);
      const tz = cz + R(-d / 4, d / 4);
      if (rand() < 0.7 && !inClearRect(tx, tz, 2)) {
        mesh(cyl(1.3, 1.3, 2.4, 14), MAT.rust, tx, h + 2.6, tz);
        for (const [a, b] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          mesh(cyl(0.08, 0.08, 1.4, 6), MAT.darkMetal, tx + a * 0.9, h + 0.9, tz + b * 0.9);
        }
      }
      for (let k = 0; k < 2; k++) {
        const ax = cx + R(-w / 3, w / 3);
        const az = cz + R(-d / 3, d / 3);
        if (!inClearRect(ax, az, 1.5)) {
          box(STATIC, 1.2, 0.8, 0.8, MAT.acUnit, ax, h + 0.65, az, 1);
        }
      }
      if (rand() < 0.6 && !inClearRect(cx, cz, 3)) {
        for (const sx of [-1, 1]) mesh(cyl(0.05, 0.05, 2, 6), MAT.darkMetal, cx + sx * w * 0.3, h + 1.2, cz);
        box(STATIC, w * 0.6, 0.02, 0.02, MAT.black, cx, h + 2, cz, 1);
        for (let k = 0; k < 4; k++) {
          mesh(plane(0.8, 1), pick(MAT.posters), cx - w * 0.25 + k * w * 0.16, h + 1.5, cz);
        }
      }
    }
    const L = Math.hypot(32, 8);
    const ramp = box(STATIC, 5, 0.4, L, MAT.darkMetal, -110.5, 4, 144, 2);
    ramp.rotation.x = Math.atan2(8, 32);
    for (let z = 132; z < 160; z += 6) {
      const hh = (8 * (160 - z)) / 32;
      mesh(cyl(0.12, 0.12, hh, 6), MAT.darkMetal, -112.7, hh / 2, z);
      mesh(cyl(0.12, 0.12, hh, 6), MAT.darkMetal, -108.3, hh / 2, z);
    }
    for (const sx of [-112.9, -108.1]) {
      const r = box(STATIC, 0.08, 0.08, L, MAT.yellow, sx, 5.1, 144, 1);
      r.rotation.x = Math.atan2(8, 32);
    }
    SURF.push({ x0: -113, x1: -108, z0: 128, z1: 160, ramp: true, hz0: 8.25, hz1: 0 });
    box(STATIC, 4, 0.25, 3, MAT.woodWarm, -135.5, 8.6, 115, 1);
    SURF.push({ x0: -137.5, x1: -133.5, z0: 113.5, z1: 116.5, h: 8.75 });
    signBoard(STATIC, 'NO WAY DOWN', 6, 1, -137, 13.2, 158.06, 0, '#111', '#ff5a4e');
  }

  function buildPoles() {
    for (const r of CITY_ROADS) {
      let prev: THREE.Vector3[] | null = null;
      for (let t = r.from + 8; t < r.to - 4; t += 26) {
        const px = r.axis === 'x' ? t : r.at + 5.6;
        const pz = r.axis === 'x' ? r.at + 5.6 : t;
        const nearCross = CROSS.some(([cx, cz]) =>
          r.axis === 'x' ? Math.abs(cx - t) < 9 : Math.abs(cz - t) < 9
        );
        const blockedByFoot = FOOT.some(
          (f) => f.kind !== 'road' && px > f.x0 - 0.3 && px < f.x1 + 0.3 && pz > f.z0 - 0.3 && pz < f.z1 + 0.3
        );
        if (
          nearCross ||
          blockedByFoot ||
          inClearRect(px, pz, 2.5) ||
          (px < -106 && pz > 101 && pz < 165) ||
          pz > 163
        ) {
          prev = null;
          continue;
        }
        mesh(cyl(0.17, 0.22, 9.5, 8), MAT.pole, px, 4.75, pz);
        const bar = box(STATIC, 2.4, 0.15, 0.15, MAT.pole, px, 8.6, pz, 1);
        if (r.axis === 'z') bar.rotation.y = Math.PI / 2;
        if (rand() < 0.3) {
          mesh(cyl(0.4, 0.4, 1.1, 10), MAT.darkMetal, px, 7.4, pz + (r.axis === 'x' ? 0.5 : 0));
        }
        addColl(px - 0.25, px + 0.25, pz - 0.25, pz + 0.25, 9.5);
        const tops = [-1, 0, 1].map(
          (o) =>
            new THREE.Vector3(
              px + (r.axis === 'x' ? 0 : o * 1.1),
              8.7 + (o === 0 ? 0.6 : 0),
              pz + (r.axis === 'x' ? o * 1.1 : 0)
            )
        );
        if (prev) {
          for (let k = 0; k < 3; k++) {
            const a = prev[k];
            const b = tops[k];
            let last = a;
            for (let i = 1; i <= 8; i++) {
              const s = i / 8;
              const p = new THREE.Vector3().lerpVectors(a, b, s);
              p.y -= Math.sin(s * Math.PI) * 0.8;
              WIRES.push(last, p);
              last = p;
            }
          }
        }
        prev = tops;
        if (rand() < 0.35) {
          lampPost(r.axis === 'x' ? t + 13 : r.at - 5.6, r.axis === 'x' ? r.at - 5.6 : t + 13);
        }
      }
    }
  }

  function skyline() {
    for (let i = 0; i < 70; i++) {
      const a = R(-Math.PI * 0.95, -Math.PI * 0.05) + (rand() < 0.3 ? Math.PI * 0.5 : 0);
      const rr = R(270, 380);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (z > 140) continue;
      const w = R(14, 30);
      const h = R(25, 90);
      box(STATIC, w, h, w, pick([MAT.concrete, MAT.glass, MAT.plaster]), x, h / 2, z, 6);
    }
  }

  /* ================= BUILD CITY ================= */
  buildHill();
  buildAlley();
  buildPark();
  buildMalhotra();
  buildBank();
  buildPolice();
  buildRoadblock();
  buildGarage();
  buildHideout();
  buildWarehouse();
  buildHarbour();
  buildRooftops();

  row('z', -106, -8, -153.5, 'e');
  row('z', -106, -8, -146.5, 'w');
  const ROWS: Array<['x' | 'z', number, number, number, 's' | 'n' | 'e' | 'w']> = [
    ['x', -198, -106.5, -6.5, 's'],
    ['z', -106, -6.5, -106.5, 'e'],
    ['z', -83.5, -6.5, 6.5, 'w'],
    ['z', -83.5, -6.5, 93.5, 'e'],
    ['x', 6.5, 93.5, -83.5, 'n'],
    ['x', 6.5, 93.5, -6.5, 's'],
    ['z', -83.5, -6.5, 106.5, 'w'],
    ['x', 106.5, 198, -83.5, 'n'],
    ['x', 106.5, 198, -6.5, 's'],
    ['z', -198, -96.5, 6.5, 'w'],
    ['z', -198, -96.5, 93.5, 'e'],
    ['x', 6.5, 93.5, -96.5, 's'],
    ['z', -198, -96.5, 106.5, 'w'],
    ['x', 106.5, 198, -96.5, 's'],
    ['z', -198, -96.5, -93.5, 'w'],
    ['z', -198, -96.5, -6.5, 'e'],
    ['x', -93.5, -6.5, -96.5, 's'],
    ['x', -93.5, -6.5, 6.5, 'n'],
    ['x', -93.5, -6.5, 88.5, 's'],
    ['z', 6.5, 88.5, -93.5, 'w'],
    ['z', 6.5, 88.5, -6.5, 'e'],
    ['x', 6.5, 93.5, 6.5, 'n'],
    ['x', 6.5, 93.5, 88.5, 's'],
    ['z', 6.5, 88.5, 6.5, 'w'],
    ['z', 6.5, 88.5, 93.5, 'e'],
    ['z', 6.5, 88.5, 106.5, 'w'],
    ['x', 106.5, 198, 88.5, 's'],
    ['x', 106.5, 198, 6.5, 'n'],
    ['x', -198, -106.5, 6.5, 'n'],
    ['x', -198, -106.5, 88.5, 's'],
    ['z', 6.5, 88.5, -106.5, 'e'],
    ['x', -93.5, -6.5, 101.5, 'n'],
    ['z', 101.5, 160, -93.5, 'w'],
    ['z', 101.5, 160, -6.5, 'e'],
  ];
  for (const r of ROWS) row(...r);
  for (const [x0, x1, z0, z1] of [
    [-198, -106.5, -106, -6.5],
    [6.5, 93.5, -83.5, -6.5],
    [106.5, 198, -83.5, -6.5],
    [6.5, 93.5, -198, -96.5],
    [106.5, 198, -198, -96.5],
    [-93.5, -6.5, -198, -96.5],
    [-93.5, -6.5, 6.5, 88.5],
    [6.5, 93.5, 6.5, 88.5],
    [106.5, 198, 6.5, 88.5],
    [-198, -106.5, 6.5, 88.5],
    [-93.5, -6.5, 101.5, 162],
  ]) {
    backfill(x0, x1, z0, z1);
  }
  buildPoles();
  skyline();

  addColl(-205, -199, -205, 170, 50);
  addColl(199, 205, -205, 170, 50);
  addColl(-205, 205, -205, -199, 50);

  const wireGeo = new THREE.BufferGeometry().setFromPoints(WIRES);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1b1b1b });
  geometriesToDispose.push(wireGeo);
  materialsToDispose.push(wireMat);
  addToScene(new THREE.LineSegments(wireGeo, wireMat));

  /* ================= bake static meshes into few draw calls ================= */
  STATIC.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const rawStaticGeos = new Set<THREE.BufferGeometry>();
  STATIC.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    rawStaticGeos.add(o.geometry);
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (g.index) {
      const nonIdx = g.toNonIndexed();
      g.dispose();
      g = nonIdx;
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') {
        g.deleteAttribute(k);
      }
    }
    if (!g.attributes.uv) {
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)
      );
    }
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const list = groups.get(mat) || [];
    list.push(g);
    groups.set(mat, list);
  });
  scene.remove(STATIC);
  rawStaticGeos.forEach((g) => g.dispose());
  for (const [mat, list] of groups) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    geometriesToDispose.push(merged);
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = !mat.transparent && !isSoftwareGl;
    m.receiveShadow = !isSoftwareGl;
    addToScene(m);
  }

  BOAT.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometriesToDispose.push(o.geometry);
      o.castShadow = !isSoftwareGl;
      o.receiveShadow = !isSoftwareGl;
    }
  });
  smallBoats.forEach((b) => {
    b.group.traverse((o) => {
      if (o instanceof THREE.Mesh) geometriesToDispose.push(o.geometry);
    });
  });

  /* ================= groundAt & location markers ================= */
  const STEP = 0.75;
  function groundAt(x: number, z: number, y = 999): number {
    let best = z > 165 ? -6 : 0;
    for (const s of SURF) {
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) {
        const h =
          s.ramp && s.hz0 !== undefined && s.hz1 !== undefined
            ? s.hz0 + ((z - s.z0) / (s.z1 - s.z0)) * (s.hz1 - s.hz0)
            : s.h ?? 0;
        if (h <= y + STEP && h > best) best = h;
      }
    }
    return best;
  }

  if (labelsEl) labelsEl.innerHTML = '';
  const ringGeo = new THREE.RingGeometry(2.4, 3, 48);
  const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 46, 16, 1, true);
  geometriesToDispose.push(ringGeo, beamGeo);

  const runtimeLocs: RuntimeCityLocation[] = CITY_LOCATIONS.map((loc) => {
    const gy = groundAt(loc.marker.x, loc.marker.z);
    let ring: THREE.Mesh | null = null;
    let beam: THREE.Mesh | null = null;
    let el: HTMLDivElement | null = null;

    if (!suppressMarkers) {
      const col = new THREE.Color(loc.color);
      const ringMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beamMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      materialsToDispose.push(ringMat, beamMat);

      ring = addToScene(new THREE.Mesh(ringGeo, ringMat));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(loc.marker.x, gy + 0.12, loc.marker.z);

      beam = addToScene(new THREE.Mesh(beamGeo, beamMat));
      beam.position.set(loc.marker.x, gy + 23, loc.marker.z);
    }

    if (labelsEl) {
      el = document.createElement('div');
      el.className = 'city-label';
      el.style.cssText = `
        position:absolute;left:0;top:0;transform:translate(-50%,-100%);
        pointer-events:none;font-size:12px;font-weight:700;white-space:nowrap;
        padding:3px 9px;border-radius:999px;background:rgba(10,12,16,0.88);
        border:1.5px solid ${loc.color};color:#f1f5f9;will-change:transform;
        font-family:var(--font-sans,system-ui,sans-serif);
      `;
      el.innerHTML = `<span style="color:${loc.color}">${loc.id}</span> ${loc.name}`;
      labelsEl.appendChild(el);
    }

    return { ...loc, gy, ring, beam, el };
  });

  /* ================= crash smoke sprites ================= */
  const SMOKE_AT = new THREE.Vector3(179, 1, 2.5);
  const smokeSprites = [...Array(16)].map((_, i) => {
    const mat = new THREE.SpriteMaterial({
      map: T_smoke,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    });
    materialsToDispose.push(mat);
    const sp = addToScene(new THREE.Sprite(mat));
    sp.userData.t = (i / 16) * 4;
    return sp;
  });

  /* ================= lighting toggle ================= */
  const setNight = (n: boolean) => {
    skyMat.map = n ? SKY.night : SKY.day;
    skyMat.needsUpdate = true;
    const fog = scene.fog as THREE.Fog;
    fog.color.set(n ? 0x121827 : 0xd8dee0);
    fog.near = n ? 34 : 75;
    fog.far = n ? 240 : 360;
    hemi.intensity = n ? 0.55 : 1.5;
    hemi.color.set(n ? 0x6c7eb5 : 0xcfe0ff);
    sun.intensity = n ? 0.85 : 2.35;
    sun.color.set(n ? 0x9eb8ff : 0xffe2b8);
    rimLight.intensity = n ? 0.65 : 0.25;
    for (const [m, d, nn] of EMIT) m.emissiveIntensity = n ? nn : d;
    PLIGHTS.forEach((l) => {
      l.intensity = n ? 60 : 0;
    });
    if (scene.environment) {
      scene.environmentIntensity = n ? 0.24 : 0.72;
    }
    renderer.toneMappingExposure = n ? 0.96 : 1.02;
  };
  setNight(initialNight);

  const mapBgCanvas = buildCityMapBackgroundCanvas(FOOT, 900);
  const tmp = new THREE.Vector3();

  function blocked(x: number, z: number, y: number, radius = 0.45): boolean {
    if (x < -198.5 || x > 198.5 || z < -198.5) return true;
    for (const c of COLL) {
      if (y >= c.h - STEP) continue;
      if (x + radius > c.x0 && x - radius < c.x1 && z + radius > c.z0 && z - radius < c.z1) {
        return true;
      }
    }
    return false;
  }

  function cameraClipDistance(
    tx: number,
    ty: number,
    tz: number,
    cdx: number,
    cdy: number,
    cdz: number,
    maxDist: number
  ): number {
    let dist = maxDist;
    for (let d = 0.6; d <= maxDist; d += 0.4) {
      const x = tx + cdx * d;
      const y = ty + cdy * d;
      const z = tz + cdz * d;
      if (
        COLL.some(
          (c) =>
            y < c.h &&
            (c.x1 - c.x0 > 1.2 || c.z1 - c.z0 > 1.2) &&
            x > c.x0 - 0.2 &&
            x < c.x1 + 0.2 &&
            z > c.z0 - 0.2 &&
            z < c.z1 + 0.2
        )
      ) {
        dist = Math.max(0.6, d - 0.5);
        break;
      }
    }
    return dist;
  }

  function updateWorld(
    timeSec: number,
    camX: number,
    camY: number,
    camZ: number,
    focusX: number,
    focusY: number,
    focusZ: number
  ) {
    sky.position.set(camX, camY, camZ);
    sun.position.set(focusX + 42, focusY + 75, focusZ + 32);
    sun.target.position.set(focusX, focusY, focusZ);
    sun.target.updateMatrixWorld();
    rimLight.position.set(focusX - 24, focusY + 28, focusZ - 26);

    T_water.offset.set(timeSec * 0.004, timeSec * 0.006);
    BOAT.position.y = Math.sin(timeSec * 1.1) * 0.12;
    BOAT.rotation.z = Math.sin(timeSec * 0.8) * 0.015;
    for (const b of smallBoats) {
      b.group.position.y = Math.sin(timeSec * 1.3 + b.ph) * 0.15;
      b.group.rotation.z = Math.sin(timeSec + b.ph) * 0.04;
    }
    const blink = Math.floor(timeSec * 4) % 2;
    MAT.sirenR.emissiveIntensity = blink ? 3 : 0.1;
    MAT.sirenB.emissiveIntensity = blink ? 0.1 : 3;
    MAT.beaconRed.emissiveIntensity = Math.floor(timeSec * 1.5) % 2 ? 3 : 0.2;

    for (const sp of smokeSprites) {
      const t = ((sp.userData.t + timeSec) % 4) / 4;
      sp.position.set(
        SMOKE_AT.x + Math.sin(t * 6 + sp.userData.t) * 0.6,
        SMOKE_AT.y + t * 9,
        SMOKE_AT.z + t * 1.5
      );
      sp.scale.setScalar(1 + t * 4);
      sp.material.opacity = (1 - t) * 0.55;
    }

    for (const L of runtimeLocs) {
      if (L.ring) {
        const pulse = 1 + Math.sin(timeSec * 3 + L.id) * 0.08;
        L.ring.scale.set(pulse, pulse, 1);
        L.ring.rotation.z = timeSec * 0.5;
      }
    }
  }

  function updateLabels(camera: THREE.Camera, width: number, height: number) {
    for (const L of runtimeLocs) {
      if (!L.el) continue;
      tmp.set(L.marker.x, L.gy + L.labelHeightOffset, L.marker.z);
      const d = camera.position.distanceTo(tmp);
      tmp.project(camera);
      if (tmp.z > 1 || d > 260 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) {
        L.el.style.display = 'none';
        continue;
      }
      L.el.style.display = 'block';
      L.el.style.opacity = String(Math.max(0.35, 1 - d / 300));
      L.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * width}px,${(-tmp.y * 0.5 + 0.5) * height}px) translate(-50%,-100%)`;
    }
  }

  function getLayoutJson(): string {
    return JSON.stringify(
      {
        units: CITY_MAP_LAYOUT.units,
        spawn: { x: runtimeLocs[0].spawn.x, z: runtimeLocs[0].spawn.z },
        locations: runtimeLocs.map((L) => ({
          id: L.id,
          name: L.name,
          levels: L.levels,
          marker: { x: L.marker.x, y: +L.gy.toFixed(2), z: L.marker.z },
          spawn: { x: L.spawn.x, z: L.spawn.z },
        })),
        roads: CITY_ROADS.map((r) => ({ ...r })),
      },
      null,
      2
    );
  }

  function dispose() {
    sceneObjectsToRemove.forEach((o) => scene.remove(o));
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    texturesToDispose.forEach((t) => t.dispose());
    if (labelsEl) labelsEl.innerHTML = '';
  }

  return {
    runtimeLocs,
    footprints: FOOT,
    mapBgCanvas,
    setNight,
    updateWorld,
    groundAt,
    blocked,
    cameraClipDistance,
    updateLabels,
    getLayoutJson,
    dispose,
  };
}
