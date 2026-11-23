import { raycastConeDistance } from './math';
import type { GuardActor, LevelRuntime, PlayerActor } from './types';

function getFloorPalette(ambience: string): { bg: string; grid: string; accent: string } {
  switch (ambience) {
    case 'bank':
      return { bg: '#0D131C', grid: 'rgba(148, 163, 184, 0.08)', accent: '#E5A93B' };
    case 'mansion':
      return { bg: '#0E1714', grid: 'rgba(52, 211, 153, 0.06)', accent: '#34D399' };
    case 'hideout':
      return { bg: '#0A1320', grid: 'rgba(56, 189, 248, 0.11)', accent: '#38BDF8' };
    case 'harbour':
      return { bg: '#08121E', grid: 'rgba(56, 189, 248, 0.08)', accent: '#38BDF8' };
    case 'rooftop':
      return { bg: '#0B0F17', grid: 'rgba(148, 163, 184, 0.07)', accent: '#F87171' };
    case 'warehouse':
      return { bg: '#111116', grid: 'rgba(168, 85, 247, 0.07)', accent: '#A855F7' };
    case 'highway':
      return { bg: '#0E1015', grid: 'rgba(255, 255, 255, 0.05)', accent: '#F59E0B' };
    default:
      return { bg: '#0A0E17', grid: 'rgba(148, 163, 184, 0.07)', accent: '#E5A93B' };
  }
}

function drawVisionCone(
  ctx: CanvasRenderingContext2D,
  g: GuardActor,
  runtime: LevelRuntime
): void {
  const rays = 16;
  const startAng = g.angle - g.fov * 0.5;
  const stepAng = g.fov / rays;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);

  for (let i = 0; i <= rays; i++) {
    const a = startAng + stepAng * i;
    const d = raycastConeDistance(g.x, g.y, a, g.range, runtime.walls);
    ctx.lineTo(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d);
  }
  ctx.closePath();

  const isAlert = runtime.alertFlash > 0;
  if (isAlert) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
  } else if (g.kind === 'shasha') {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.20)';
  } else if (g.kind === 'shamus' || g.kind === 'swat') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.20)';
  } else if (g.color === '#22C55E') {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
  } else {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.20)';
  }
  ctx.fill();
  ctx.restore();
}

function drawTopDownCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  label: string,
  isActive: boolean,
  hitFlash: boolean,
  carryingBag: boolean,
  walkPhase = 0,
  telegraph = false
): void {
  ctx.save();
  ctx.translate(x, y);

  if (isActive) {
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(229, 169, 59, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (telegraph) {
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(angle);

  // Subtle shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(-2, 3, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stride feet
  const stride = Math.sin(walkPhase) * 4;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(stride - 3, -9, 6, 4);
  ctx.fillRect(-stride - 3, 5, 6, 4);

  // Shoulders
  ctx.fillStyle = hitFlash ? '#FFFFFF' : color;
  ctx.beginPath();
  ctx.roundRect(-8, -11, 16, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#090B10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Head
  ctx.fillStyle = hitFlash ? '#FFFFFF' : '#F8FAFC';
  ctx.beginPath();
  ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Visor / Direction marker
  ctx.fillStyle = '#090B10';
  ctx.fillRect(5, -3.5, 4, 7);

  if (carryingBag) {
    ctx.fillStyle = '#E5A93B';
    ctx.fillRect(-13, -7, 7, 14);
  }

  ctx.restore();

  // Name label (fast fixed-estimate pill avoids measureText every frame)
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(9, 11, 16, 0.85)';
  const tw = label.length * 6.8 + 12;
  ctx.fillRect(-tw / 2, -31, tw, 15);
  ctx.fillStyle = isActive ? '#FDE68A' : '#E2E8F0';
  ctx.fillText(label, 0, -20);

  ctx.restore();
}

function renderHighwayChase(
  ctx: CanvasRenderingContext2D,
  runtime: LevelRuntime
): void {
  const W = runtime.config.worldWidth;
  const H = runtime.config.worldHeight;

  // Asphalt & shoulders
  ctx.fillStyle = '#090B10';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#181C26';
  ctx.fillRect(210, 0, 580, H);

  // Guardrails
  ctx.fillStyle = '#334155';
  ctx.fillRect(204, 0, 8, H);
  ctx.fillRect(788, 0, 8, H);

  // Scrolling lane dividers
  const offset = (runtime.highwayDistance * 1.1) % 70;
  ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
  for (let lane = 1; lane <= 3; lane++) {
    const lx = 210 + lane * 145;
    for (let y = -70 + offset; y < H + 70; y += 70) {
      ctx.fillRect(lx - 2, y, 4, 38);
    }
  }

  // Shamus Roadblock at end of stretch
  const remaining = runtime.highwayTarget - runtime.highwayDistance;
  if (remaining < 620) {
    const ry = runtime.playerCarY - remaining;
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(230, ry - 26, 540, 52);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(230, ry - 26, 540, 52);

    // Police barrier stripes & flashing lights
    const flash = Math.floor(runtime.elapsed * 10) % 2 === 0;
    ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
    ctx.fillRect(310, ry - 12, 32, 24);
    ctx.fillStyle = flash ? '#3B82F6' : '#EF4444';
    ctx.fillRect(658, ry - 12, 32, 24);

    ctx.font = '700 13px "Oswald", sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText('SHAMUS POLICE ROADBLOCK', 500, ry + 5);
    ctx.restore();
  }

  // Traffic cars
  for (let i = 0; i < runtime.cars.length; i++) {
    const c = runtime.cars[i];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = c.kind === 'police' ? '#1E293B' : '#475569';
    ctx.beginPath();
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (c.kind === 'police') {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-c.w / 2 + 4, -14, c.w - 8, 28);
      const flash = Math.floor(runtime.elapsed * 12 + i) % 2 === 0;
      ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
      ctx.fillRect(-14, -4, 14, 8);
      ctx.fillStyle = flash ? '#3B82F6' : '#EF4444';
      ctx.fillRect(0, -4, 14, 8);
    }
    ctx.restore();
  }

  // Player Getaway Van (Randy & John)
  ctx.save();
  ctx.translate(runtime.playerCarX, runtime.playerCarY);
  ctx.fillStyle = '#E5A93B';
  ctx.beginPath();
  ctx.roundRect(-24, -44, 48, 88, 9);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-18, -32, 36, 18); // windshield
  // Headlights
  ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
  ctx.beginPath();
  ctx.moveTo(-18, -44);
  ctx.lineTo(-44, -170);
  ctx.lineTo(44, -170);
  ctx.lineTo(18, -44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  runtime: LevelRuntime,
  viewportWidth: number,
  viewportHeight: number
): void {
  const W = runtime.config.worldWidth;
  const H = runtime.config.worldHeight;

  ctx.save();
  ctx.fillStyle = '#07090D';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Fit world cleanly in viewport
  const scale = Math.min(viewportWidth / W, viewportHeight / H);
  const offsetX = (viewportWidth - W * scale) * 0.5;
  const offsetY = (viewportHeight - H * scale) * 0.5;

  const shakeMag = runtime.shakeTrauma * runtime.shakeTrauma * 12;
  const sx = shakeMag > 0.2 ? Math.sin(runtime.elapsed * 55) * shakeMag : 0;
  const sy = shakeMag > 0.2 ? Math.cos(runtime.elapsed * 49) * shakeMag : 0;

  ctx.translate(offsetX + sx, offsetY + sy);
  ctx.scale(scale, scale);

  // Clip to world rect
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  if (runtime.config.mode === 'highway_chase') {
    renderHighwayChase(ctx, runtime);
  } else {
    const pal = getFloorPalette(runtime.config.ambience);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle tactical floor grid (single batched path)
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Ambience-specific floor landmarks
    if (runtime.levelId === 1) {
      // Park grass on right side
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fillRect(670, 50, 300, 520);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.strokeRect(670, 50, 300, 520);
      ctx.font = '600 12px "Oswald", sans-serif';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.fillText('ASHOKA PARK', 688, 74);
    }

    if (runtime.config.ambience === 'harbour') {
      // Midnight water on right edge
      ctx.fillStyle = '#041E2B';
      ctx.fillRect(830, 0, 170, H);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      for (let wy = 40; wy < H; wy += 60) {
        const shift = Math.sin(runtime.elapsed * 2 + wy) * 8;
        ctx.beginPath();
        ctx.moveTo(855 + shift, wy);
        ctx.lineTo(955 + shift, wy);
        ctx.stroke();
      }
    }

    if (runtime.config.mode === 'rooftop_chase') {
      // Rooftop chasm gaps
      for (let i = 0; i < runtime.rooftopGaps.length; i++) {
        const gap = runtime.rooftopGaps[i];
        ctx.fillStyle = '#030407';
        ctx.fillRect(gap.x, gap.y, gap.w, gap.h);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gap.x, gap.y, gap.w, gap.h);
        ctx.save();
        ctx.translate(gap.x + gap.w / 2, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
        ctx.textAlign = 'center';
        ctx.fillText('ALLEY GAP · SPACE TO LEAP', 0, 4);
        ctx.restore();
      }
    }

    // Level 3 & 4 Blueprint Guard Route in GREEN
    if (runtime.levelId === 3 || runtime.levelId === 4) {
      const guard = runtime.guards[0];
      if (guard && guard.waypoints.length > 1) {
        ctx.save();
        ctx.strokeStyle =
          runtime.levelId === 3 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(34, 197, 94, 0.22)';
        ctx.lineWidth = runtime.levelId === 3 ? 3 : 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(guard.waypoints[0].x, guard.waypoints[0].y);
        for (let i = 1; i < guard.waypoints.length; i++) {
          ctx.lineTo(guard.waypoints[i].x, guard.waypoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Zones (photo spots, plates, van, antenna, boat)
    for (let i = 0; i < runtime.zones.length; i++) {
      const z = runtime.zones[i];
      if (!z.active && !z.completed) continue;
      ctx.save();
      const pulse = 1 + Math.sin(runtime.elapsed * 4) * 0.06;
      const color = z.completed
        ? '#22C55E'
        : z.kind === 'antenna'
          ? '#38BDF8'
          : z.kind === 'van' || z.kind === 'boat'
            ? '#22C55E'
            : '#E5A93B';

      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = z.completed
        ? 'rgba(34, 197, 94, 0.18)'
        : 'rgba(229, 169, 59, 0.14)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Progress ring if holding
      if (z.progress > 0 && z.requiredTime > 0.2) {
        ctx.beginPath();
        ctx.arc(
          z.x,
          z.y,
          z.radius + 6,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * z.progress) / z.requiredTime
        );
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Draw van / boat silhouette inside drop zone
      if (z.kind === 'van') {
        ctx.fillStyle = '#E5A93B';
        ctx.beginPath();
        ctx.roundRect(z.x - 24, z.y - 14, 48, 28, 5);
        ctx.fill();
      } else if (z.kind === 'boat') {
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.moveTo(z.x - 26, z.y - 14);
        ctx.lineTo(z.x + 28, z.y);
        ctx.lineTo(z.x - 26, z.y + 14);
        ctx.closePath();
        ctx.fill();
      }

      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(z.label, z.x, z.y + z.radius + 14);
      ctx.restore();
    }

    // Cash Bags
    for (let i = 0; i < runtime.bags.length; i++) {
      const b = runtime.bags[i];
      if (b.collected) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.roundRect(-11, -8, 22, 16, 4);
      ctx.fill();
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
      ctx.restore();
    }

    // Vision cones (drawn under walls for clean clipping look)
    for (let i = 0; i < runtime.guards.length; i++) {
      const g = runtime.guards[i];
      if (g.hp <= 0 || g.koTimer > 0) continue;
      if (runtime.config.mode !== 'warehouse_war') {
        drawVisionCone(ctx, g, runtime);
      }
    }

    // Architectural walls & obstacles
    for (let i = 0; i < runtime.walls.length; i++) {
      const w = runtime.walls[i];
      ctx.save();
      if (w.kind === 'hedge') {
        ctx.fillStyle = '#153A29';
        ctx.strokeStyle = '#2E6F51';
      } else if (w.kind === 'vault_door') {
        ctx.fillStyle = '#92400E';
        ctx.strokeStyle = '#F59E0B';
      } else if (w.kind === 'crate') {
        ctx.fillStyle = '#2A3040';
        ctx.strokeStyle = '#64748B';
      } else {
        ctx.fillStyle = '#1C2536';
        ctx.strokeStyle = '#475569';
      }
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.w, w.h);

      if (w.label && w.w > 60) {
        ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
        ctx.textAlign = 'center';
        ctx.fillText(w.label, w.x + w.w / 2, w.y + w.h / 2 + 4);
      }
      ctx.restore();
    }

    // Guards & Villains
    for (let i = 0; i < runtime.guards.length; i++) {
      const g = runtime.guards[i];
      if (g.hp <= 0) continue;
      drawTopDownCharacter(
        ctx,
        g.x,
        g.y,
        g.angle,
        g.color,
        g.name,
        false,
        g.hitFlash > 0,
        false,
        runtime.elapsed * 6,
        g.telegraphTimer > 0
      );
    }

    // Level 10 fleeing Inspector Shamus on rooftop edge
    if (runtime.levelId === 10 && !runtime.shamusJumped) {
      drawTopDownCharacter(
        ctx,
        runtime.shamusEscapeX,
        runtime.shamusEscapeY,
        0,
        '#EF4444',
        'Shamus',
        false,
        false,
        false,
        runtime.elapsed * 9
      );
    }

    // Players
    for (let i = 0; i < runtime.players.length; i++) {
      const p: PlayerActor = runtime.players[i];
      drawTopDownCharacter(
        ctx,
        p.x,
        p.y,
        p.angle,
        p.color,
        p.name,
        i === runtime.activePlayerIndex && runtime.levelId !== 3,
        p.hitFlash > 0,
        p.carryingBag,
        p.walkPhase
      );
    }

    // Bullets
    for (let i = 0; i < runtime.bullets.length; i++) {
      const b = runtime.bullets[i];
      if (!b.active) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pooled particles (rain & bursts)
  for (let i = 0; i < runtime.particles.length; i++) {
    const p = runtime.particles[i];
    if (!p.active) continue;
    ctx.fillStyle = p.color;
    if (p.kind === 'rain') {
      ctx.fillRect(p.x, p.y, 1.2, 9);
    } else {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Camera shutter or alert edge vignette
  if (runtime.cameraFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${runtime.cameraFlash * 0.85})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (runtime.alertFlash > 0) {
    ctx.strokeStyle = `rgba(239, 68, 68, ${runtime.alertFlash * 0.9})`;
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, W, H);
  }

  ctx.restore();
}

export function renderTitleBackdrop(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  viewportWidth: number,
  viewportHeight: number
): void {
  ctx.save();
  ctx.fillStyle = '#090B10';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Subtle architectural blueprint pan on right 60%
  const panX = Math.sin(elapsed * 0.18) * 35;
  const panY = Math.cos(elapsed * 0.14) * 20;

  ctx.translate(panX, panY);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
  ctx.lineWidth = 1;
  for (let x = -80; x < viewportWidth + 120; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, -80);
    ctx.lineTo(x, viewportHeight + 120);
    ctx.stroke();
  }
  for (let y = -80; y < viewportHeight + 120; y += 48) {
    ctx.beginPath();
    ctx.moveTo(-80, y);
    ctx.lineTo(viewportWidth + 120, y);
    ctx.stroke();
  }

  // Blueprint vault rooms on right side (leaving left negative space calm)
  const bx = viewportWidth * 0.52;
  const by = viewportHeight * 0.18;
  ctx.strokeStyle = 'rgba(229, 169, 59, 0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, 440, 340);
  ctx.strokeRect(bx + 280, by + 40, 130, 260);

  // Sweeping searchlight cone on blueprint
  const cx = bx + 180 + Math.cos(elapsed * 0.65) * 90;
  const cy = by + 170 + Math.sin(elapsed * 0.65) * 70;
  const ang = elapsed * 0.9;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 210);
  grad.addColorStop(0, 'rgba(34, 197, 94, 0.22)');
  grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 210, ang - 0.38, ang + 0.38);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
