import type { Rect, Vec2 } from './types';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a: number, b: number): number {
  return normalizeAngle(a - b);
}

export function lerpAngle(from: number, to: number, t: number): number {
  return from + angleDiff(to, from) * clamp(t, 0, 1);
}

export function circleIntersectsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

export function resolveCircleRects(
  x: number,
  y: number,
  radius: number,
  walls: Rect[],
  worldW: number,
  worldH: number,
  clampBounds = false
): Vec2 {
  let nx = clampBounds ? clamp(x, radius + 4, worldW - radius - 4) : x;
  let ny = clampBounds ? clamp(y, radius + 4, worldH - radius - 4) : y;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < walls.length; i++) {
      const rect = walls[i];
      if (rect.kind === 'table') continue; // tables are low props in blueprint view or optional
      const closestX = clamp(nx, rect.x, rect.x + rect.w);
      const closestY = clamp(ny, rect.y, rect.y + rect.h);
      const dx = nx - closestX;
      const dy = ny - closestY;
      const d2 = dx * dx + dy * dy;

      if (d2 < radius * radius) {
        const d = Math.sqrt(d2);
        if (d > 0.0001) {
          const overlap = radius - d;
          nx += (dx / d) * overlap;
          ny += (dy / d) * overlap;
        } else {
          // Inside rect: push out along nearest edge
          const leftPen = nx - rect.x;
          const rightPen = rect.x + rect.w - nx;
          const topPen = ny - rect.y;
          const bottomPen = rect.y + rect.h - ny;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) nx = rect.x - radius;
          else if (minPen === rightPen) nx = rect.x + rect.w + radius;
          else if (minPen === topPen) ny = rect.y - radius;
          else ny = rect.y + rect.h + radius;
        }
      }
    }
  }

  return {
    x: clampBounds ? clamp(nx, radius + 4, worldW - radius - 4) : nx,
    y: clampBounds ? clamp(ny, radius + 4, worldH - radius - 4) : ny,
  };
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-8) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

export function segmentIntersectsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: Rect
): boolean {
  // Quick bounding check
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  if (maxX < rect.x || minX > rect.x + rect.w || maxY < rect.y || minY > rect.y + rect.h) {
    return false;
  }

  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;

  return (
    segmentsIntersect(ax, ay, bx, by, x1, y1, x2, y1) ||
    segmentsIntersect(ax, ay, bx, by, x2, y1, x2, y2) ||
    segmentsIntersect(ax, ay, bx, by, x2, y2, x1, y2) ||
    segmentsIntersect(ax, ay, bx, by, x1, y2, x1, y1)
  );
}

export function hasLineOfSight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  walls: Rect[]
): boolean {
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.kind === 'hedge' || w.kind === 'table' || w.kind === 'roof') continue;
    if (segmentIntersectsRect(ax, ay, bx, by, w)) {
      return false;
    }
  }
  return true;
}

export function isPointInVisionCone(
  px: number,
  py: number,
  gx: number,
  gy: number,
  gAngle: number,
  fov: number,
  range: number,
  walls: Rect[]
): boolean {
  const d = dist(gx, gy, px, py);
  if (d > range) return false;
  if (d < 14) return hasLineOfSight(gx, gy, px, py, walls);
  const angleToPoint = Math.atan2(py - gy, px - gx);
  if (Math.abs(angleDiff(angleToPoint, gAngle)) > fov * 0.5) {
    return false;
  }
  return hasLineOfSight(gx, gy, px, py, walls);
}

export function raycastConeDistance(
  gx: number,
  gy: number,
  angle: number,
  maxRange: number,
  walls: Rect[]
): number {
  const step = 10;
  for (let d = step; d <= maxRange; d += step) {
    const rx = gx + Math.cos(angle) * d;
    const ry = gy + Math.sin(angle) * d;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.kind === 'hedge' || w.kind === 'table' || w.kind === 'roof') continue;
      if (rx >= w.x && rx <= w.x + w.w && ry >= w.y && ry <= w.y + w.h) {
        return Math.max(8, d - step * 0.5);
      }
    }
  }
  return maxRange;
}
