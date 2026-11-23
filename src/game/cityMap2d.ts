import { CITY_LOCATIONS, CITY_ROADS, type CityLocationSpec } from './cityMapData';

export interface CityMapFootprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  kind: string;
}

export interface CityMap2DOptions {
  full: boolean;
  player?: {
    x: number;
    z: number;
    face: number;
  } | null;
  activeLocationId?: number | null;
  highestUnlocked?: number;
  pulseTimeSec?: number;
}

const DEFAULT_FOOTPRINTS: CityMapFootprint[] = [
  // Hilltop & Lantern Alley
  { x0: -200, x1: -106, z0: -200, z1: -108, kind: 'hill' },
  { x0: -163, x1: -137, z0: -177, z1: -159, kind: 'lmb' },
  { x0: -153.2, x1: -146.8, z0: -108, z1: -5, kind: 'alley' },
  // Sakura Park
  { x0: -93.5, x1: -6.5, z0: -83.5, z1: -6.5, kind: 'park' },
  // Malhotra Villa
  { x0: 22, x1: 78, z0: -163, z1: -96.5, kind: 'park' },
  { x0: 36, x1: 64, z0: -150, z1: -128, kind: 'lmb' },
  // Crown Vault Bank
  { x0: 26, x1: 74, z0: -62, z1: -6.5, kind: 'lm' },
  { x0: 30, x1: 70, z0: -60, z1: -34, kind: 'lmb' },
  // Police HQ
  { x0: 128, x1: 172, z0: -62, z1: -8, kind: 'lm' },
  { x0: 134, x1: 166, z0: -60, z1: -38, kind: 'lmb' },
  // Randy's Garage
  { x0: -64, x1: -36, z0: 6.5, z1: 32, kind: 'lm' },
  { x0: -62, x1: -38, z0: 14, z1: 30, kind: 'lmb' },
  // Crew Hideout
  { x0: -160, x1: -140, z0: 6.5, z1: 34, kind: 'lm' },
  { x0: -158, x1: -142, z0: 16, z1: 32, kind: 'lmb' },
  // Pablo's Warehouse
  { x0: 114, x1: 192, z0: 6.5, z1: 82, kind: 'lm' },
  { x0: 125, x1: 175, z0: 30, z1: 60, kind: 'lmb' },
  // Harbour & Pier
  { x0: 6.5, x1: 198, z0: 101.5, z1: 165, kind: 'harbour' },
  { x0: 120, x1: 128, z0: 163, z1: 200, kind: 'pier' },
  // Rooftops
  { x0: -198, x1: -106.5, z0: 101.5, z1: 164, kind: 'roofs' },
  { x0: -192, x1: -108, z0: 104, z1: 130, kind: 'lmb' },
  { x0: -190, x1: -128, z0: 132, z1: 160, kind: 'lmb' },
];

export function buildCityMapBackgroundCanvas(
  footprints: ReadonlyArray<CityMapFootprint> = DEFAULT_FOOTPRINTS,
  resolution = 900
): HTMLCanvasElement {
  const scale = resolution / 400;
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const g = canvas.getContext('2d')!;

  const toMap = (x: number, z: number): [number, number] => [(x + 200) * scale, (z + 200) * scale];
  const drawRect = (f: { x0: number; x1: number; z0: number; z1: number }, color: string) => {
    const [a, b] = toMap(f.x0, f.z0);
    g.fillStyle = color;
    g.fillRect(a, b, (f.x1 - f.x0) * scale, (f.z1 - f.z0) * scale);
  };

  g.fillStyle = '#2c2a27';
  g.fillRect(0, 0, resolution, resolution);
  g.fillStyle = '#1d4656';
  g.fillRect(0, (165 + 200) * scale, resolution, resolution);

  for (const f of footprints) {
    if (f.kind === 'hill') drawRect(f, '#4a5238');
    else if (f.kind === 'park') drawRect(f, '#355f34');
    else if (f.kind === 'harbour') drawRect(f, '#4a4a46');
    else if (f.kind === 'pier') drawRect(f, '#7a5c3e');
    else if (f.kind === 'roofs') drawRect(f, '#373b44');
    else if (f.kind === 'alley' || f.kind === 'stairs') drawRect(f, '#6b5f55');
  }

  for (const r of CITY_ROADS) {
    g.fillStyle = '#5b5e63';
    if (r.axis === 'x') {
      const [a, b] = toMap(r.from, r.at - 5);
      g.fillRect(a, b, (r.to - r.from) * scale, 10 * scale);
    } else {
      const [a, b] = toMap(r.at - 5, r.from);
      g.fillRect(a, b, 10 * scale, (r.to - r.from) * scale);
    }
  }

  for (const f of footprints) {
    if (f.kind === 'b') drawRect(f, '#7b6a5a');
    else if (f.kind === 'lmb') drawRect(f, '#a89a86');
  }

  // Harbour getaway boat silhouette
  drawRect({ x0: 128, x1: 137, z0: 170.5, z1: 195.5 }, '#e8e8e8');

  g.font = `600 ${(11 * scale) / 2}px system-ui,sans-serif`;
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.textAlign = 'center';
  for (const r of CITY_ROADS) {
    g.save();
    if (r.axis === 'x') {
      const [a, b] = toMap(r.from + 30, r.at);
      g.translate(a, b + 4);
    } else {
      const [a, b] = toMap(r.at, r.from + 40);
      g.translate(a + 4, b);
      g.rotate(Math.PI / 2);
    }
    g.fillText(r.name.toUpperCase(), 0, 0);
    g.restore();
  }

  return canvas;
}

export function drawCityMap2D(
  ctx: CanvasRenderingContext2D,
  bgCanvas: HTMLCanvasElement,
  size: number,
  opts: CityMap2DOptions
): void {
  const s = size / 400;
  ctx.drawImage(bgCanvas, 0, 0, size, size);

  const t = opts.pulseTimeSec ?? 0;

  for (const loc of CITY_LOCATIONS) {
    const x = (loc.marker.x + 200) * s;
    const y = (loc.marker.z + 200) * s;
    const isActive = opts.activeLocationId === loc.id;
    const isLocked =
      opts.highestUnlocked !== undefined && loc.primaryLevelId > opts.highestUnlocked;
    const r = opts.full ? (isActive ? 15 : 13) : isActive ? 7.5 : 5.5;

    if (isActive) {
      const ringR = r + (opts.full ? 9 : 4.5) + Math.sin(t * 4) * (opts.full ? 2.5 : 1.2);
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = opts.full ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = isLocked ? '#64748b' : loc.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = opts.full ? 2.2 : 1.3;
      ctx.stroke();
    }

    ctx.fillStyle = '#111';
    ctx.font = `700 ${opts.full ? 13 : 7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(loc.id), x, y + 0.5);

    if (opts.full) {
      ctx.font = isActive ? '700 14px system-ui,sans-serif' : '600 14px system-ui,sans-serif';
      ctx.fillStyle = isActive ? '#fde68a' : isLocked ? '#cbd5e1' : '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,.88)';
      ctx.lineWidth = 4;
      const ly = loc.marker.z > 150 || loc.id === 9 ? y - 24 : y + 26;
      const label = isActive ? `${loc.name} · ACTIVE` : loc.name;
      const labelWidth = ctx.measureText(label).width;
      const margin = 12;
      const tx = Math.max(labelWidth / 2 + margin, Math.min(size - labelWidth / 2 - margin, x));
      ctx.strokeText(label, tx, ly);
      ctx.fillText(label, tx, ly);
    }
  }

  if (opts.player) {
    const px = (opts.player.x + 200) * s;
    const pz = (opts.player.z + 200) * s;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-opts.player.face + Math.PI);
    const a = opts.full ? 12 : 6.5;
    ctx.fillStyle = '#1de9b6';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.lineTo(a * 0.7, a * 0.8);
    ctx.lineTo(0, a * 0.4);
    ctx.lineTo(-a * 0.7, a * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

export function findCityLocationAtNormalizedCoord(
  normX: number,
  normZ: number,
  maxRadiusMeters = 18
): CityLocationSpec | null {
  const worldX = normX * 400 - 200;
  const worldZ = normZ * 400 - 200;
  let best: CityLocationSpec | null = null;
  let bestDist = maxRadiusMeters;
  for (const loc of CITY_LOCATIONS) {
    const dist = Math.hypot(loc.marker.x - worldX, loc.marker.z - worldZ);
    if (dist < bestDist) {
      bestDist = dist;
      best = loc;
    }
  }
  return best;
}
