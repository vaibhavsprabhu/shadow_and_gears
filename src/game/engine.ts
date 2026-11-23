import { buildLevelEntities, LEVEL_CONFIGS } from './levels';
import {
  circleIntersectsRect,
  clamp,
  dist,
  hasLineOfSight,
  isPointInVisionCone,
  lerpAngle,
  resolveCircleRects,
} from './math';
import type {
  Bullet,
  HudSnapshot,
  LevelRuntime,
  Particle,
  RoleAssignment,
} from './types';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  moveVecX?: number;
  moveVecY?: number;
  actionJustPressed: boolean;
  actionHeld: boolean;
  switchJustPressed: boolean;
  aimX: number | null;
  aimY: number | null;
  fireJustPressed: boolean;
}

export interface StepEvents {
  spotted: boolean;
  shutter: boolean;
  pickup: boolean;
  vaultOpened: boolean;
  shot: boolean;
  crash: boolean;
  victory: boolean;
  defeat: boolean;
  step: boolean;
}

const PARTICLE_POOL_SIZE = 160;
const BULLET_POOL_SIZE = 48;

function createParticlePool(ambience: string): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const isRain = ambience !== 'bank' && ambience !== 'hideout' && i < 65;
    pool.push({
      active: isRain,
      x: (i * 173) % 1000,
      y: (i * 97) % 620,
      vx: isRain ? -35 : 0,
      vy: isRain ? 290 + (i % 5) * 30 : 0,
      life: isRain ? 1 : 0,
      maxLife: 1,
      size: isRain ? 1.4 : 3,
      color: isRain ? 'rgba(148, 163, 184, 0.28)' : '#F59E0B',
      kind: isRain ? 'rain' : 'spark',
    });
  }
  return pool;
}

function createBulletPool(): Bullet[] {
  const pool: Bullet[] = [];
  for (let i = 0; i < BULLET_POOL_SIZE; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fromPlayer: true,
      life: 0,
      color: '#FBBF24',
    });
  }
  return pool;
}

export function spawnBurst(
  runtime: LevelRuntime,
  x: number,
  y: number,
  count: number,
  color: string,
  kind: Particle['kind'] = 'spark',
  speed = 130
): void {
  for (let i = 0; i < count; i++) {
    // Keep indices 0..64 for rain if ambient rain exists
    const idx = 65 + (runtime.particleCursor % (PARTICLE_POOL_SIZE - 65));
    runtime.particleCursor = (runtime.particleCursor + 1) % (PARTICLE_POOL_SIZE - 65);
    const p = runtime.particles[idx];
    const ang = (Math.PI * 2 * i) / count + (i % 3) * 0.21;
    const spd = speed * (0.55 + ((i * 37) % 100) / 140);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd;
    p.maxLife = 0.35 + ((i * 17) % 10) * 0.03;
    p.life = p.maxLife;
    p.size = kind === 'smoke' ? 7 : 3;
    p.color = color;
    p.kind = kind;
  }
}

function spawnBullet(
  runtime: LevelRuntime,
  x: number,
  y: number,
  vx: number,
  vy: number,
  fromPlayer: boolean,
  color: string
): void {
  for (let i = 0; i < runtime.bullets.length; i++) {
    const b = runtime.bullets[i];
    if (!b.active) {
      b.active = true;
      b.x = x;
      b.y = y;
      b.vx = vx;
      b.vy = vy;
      b.fromPlayer = fromPlayer;
      b.life = 1.6;
      b.color = color;
      return;
    }
  }
}

export function createLevelRuntime(
  levelId: number,
  roleAssignment: RoleAssignment = {
    plateA: 'roman',
    plateB: 'brock',
    driver: 'randy',
  },
  leadCrew: 'roman' | 'brock' | 'john' | 'randy' = 'roman'
): LevelRuntime {
  const config =
    LEVEL_CONFIGS.find((l) => l.id === levelId) ?? LEVEL_CONFIGS[0];
  const data = buildLevelEntities(config.id, roleAssignment, leadCrew);

  return {
    levelId: config.id,
    config,
    players: data.players,
    activePlayerIndex: 0,
    guards: data.guards,
    walls: data.walls,
    zones: data.zones,
    bags: data.bags,
    cars: data.cars,
    rooftopGaps: data.rooftopGaps,
    bullets: createBulletPool(),
    particles: createParticlePool(config.ambience),
    particleCursor: 0,
    elapsed: 0,
    timerRemaining: config.timeLimit,
    spottedCount: 0,
    spotCooldown: 0,
    alertFlash: 0,
    vaultOpen: false,
    phase: 0,
    bagsDelivered: 0,
    totalBags: data.bags.length,
    highwayDistance: 0,
    highwayTarget: data.highwayTarget,
    playerCarX: data.playerCarX,
    playerCarY: data.playerCarY,
    playerCarSpeed: 420,
    cameraFlash: 0,
    shakeTrauma: 0,
    hitstopTimer: 0,
    shootCooldown: 0,
    shamusEscapeX: 890,
    shamusEscapeY: 310,
    shamusJumped: false,
    outcome: 'none',
    outcomeReason: '',
    objectiveText: config.objectiveSummary,
    objectiveProgress: 0,
    roleAssignment,
    activeDialogueIndex: 0,
    dialogueTimer: 0,
  };
}

function triggerSpot(runtime: LevelRuntime, reason: string, events: StepEvents): void {
  if (runtime.spotCooldown > 0 || runtime.outcome !== 'none') return;
  runtime.spottedCount += 1;
  runtime.spotCooldown = 1.35;
  runtime.alertFlash = 0.45;
  runtime.shakeTrauma = Math.min(1, runtime.shakeTrauma + 0.55);
  runtime.hitstopTimer = 0.045;
  events.spotted = true;

  const active = runtime.players[runtime.activePlayerIndex];
  if (active) {
    spawnBurst(runtime, active.x, active.y, 12, '#EF4444', 'spark', 150);
  }

  if (runtime.spottedCount >= runtime.config.maxSpots) {
    runtime.outcome = 'busted';
    runtime.outcomeReason = reason;
    events.defeat = true;
  }
}

function updateParticles(runtime: LevelRuntime, dt: number): void {
  for (let i = 0; i < runtime.particles.length; i++) {
    const p = runtime.particles[i];
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'rain') {
      if (p.y > runtime.config.worldHeight) {
        p.y = -10;
        p.x = (p.x + 137) % runtime.config.worldWidth;
      }
      if (p.x < 0) p.x += runtime.config.worldWidth;
    } else {
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
      }
    }
  }
}

function updateGuards(runtime: LevelRuntime, dt: number): void {
  for (let i = 0; i < runtime.guards.length; i++) {
    const g = runtime.guards[i];
    if (g.hitFlash > 0) g.hitFlash = Math.max(0, g.hitFlash - dt);
    if (g.koTimer > 0) {
      g.koTimer = Math.max(0, g.koTimer - dt);
      continue;
    }
    if (g.hp <= 0) continue;
    if (g.waypoints.length === 0) continue;

    if (g.waitTimer > 0) {
      g.waitTimer -= dt;
      continue;
    }

    const target = g.waypoints[g.waypointIndex];
    const dx = target.x - g.x;
    const dy = target.y - g.y;
    const d = Math.hypot(dx, dy);

    if (d < 4) {
      g.x = target.x;
      g.y = target.y;
      g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
      g.waitTimer = g.pauseAtWaypoint;
    } else {
      const targetAngle = Math.atan2(dy, dx);
      g.angle = lerpAngle(g.angle, targetAngle, Math.min(1, dt * 8));
      const move = Math.min(d, g.speed * dt);
      g.x += (dx / d) * move;
      g.y += (dy / d) * move;
    }
  }
}

export function stepSimulation(
  runtime: LevelRuntime,
  rawDt: number,
  input: InputState
): StepEvents {
  const events: StepEvents = {
    spotted: false,
    shutter: false,
    pickup: false,
    vaultOpened: false,
    shot: false,
    crash: false,
    victory: false,
    defeat: false,
    step: false,
  };

  const dt = Math.min(rawDt, 0.05);

  // Decay visual timers in real dt even during hitstop
  if (runtime.cameraFlash > 0) runtime.cameraFlash = Math.max(0, runtime.cameraFlash - dt * 2.2);
  if (runtime.alertFlash > 0) runtime.alertFlash = Math.max(0, runtime.alertFlash - dt);
  if (runtime.shakeTrauma > 0) runtime.shakeTrauma = Math.max(0, runtime.shakeTrauma - dt * 1.8);
  updateParticles(runtime, dt);

  if (runtime.outcome !== 'none') {
    return events;
  }

  if (runtime.hitstopTimer > 0) {
    runtime.hitstopTimer = Math.max(0, runtime.hitstopTimer - dt);
    return events;
  }

  runtime.elapsed += dt;
  if (runtime.spotCooldown > 0) runtime.spotCooldown = Math.max(0, runtime.spotCooldown - dt);
  if (runtime.shootCooldown > 0) runtime.shootCooldown = Math.max(0, runtime.shootCooldown - dt);

  // Advance radio dialogue lines automatically every 6s
  if (runtime.config.dialogue.length > 1) {
    runtime.dialogueTimer += dt;
    if (runtime.dialogueTimer > 6.5) {
      runtime.dialogueTimer = 0;
      runtime.activeDialogueIndex =
        (runtime.activeDialogueIndex + 1) % runtime.config.dialogue.length;
    }
  }

  // Timed level countdown
  if (runtime.config.timeLimit > 0) {
    runtime.timerRemaining = Math.max(0, runtime.timerRemaining - dt);
    if (runtime.timerRemaining <= 0) {
      runtime.outcome = 'busted';
      runtime.outcomeReason =
        runtime.levelId === 5
          ? "Inspector Shamus's squad sealed off the block before you escaped."
          : runtime.levelId === 8
            ? 'Midnight passed—the smuggling boat left without the cash.'
            : runtime.levelId === 6
              ? 'Police interceptors boxed in the getaway van.'
              : 'Shamus slipped away into the city fog.';
      events.defeat = true;
      return events;
    }
  }

  // Level 3: Blueprint planning simulation only
  if (runtime.config.mode === 'blueprint_plan') {
    updateGuards(runtime, dt);
    runtime.objectiveText = 'Study the green guard loop and assign crew roles below.';
    return events;
  }

  // Level 6: Highway Car Chase
  if (runtime.config.mode === 'highway_chase') {
    const steerX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accelY = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    runtime.playerCarSpeed = clamp(
      runtime.playerCarSpeed + accelY * 260 * dt,
      290,
      620
    );
    runtime.playerCarX = clamp(runtime.playerCarX + steerX * 320 * dt, -300, 1300);
    runtime.playerCarY = clamp(runtime.playerCarY - accelY * 120 * dt, 160, 560);
    runtime.highwayDistance += runtime.playerCarSpeed * dt;
    runtime.objectiveProgress = clamp(
      runtime.highwayDistance / runtime.highwayTarget,
      0,
      1
    );
    runtime.objectiveText =
      runtime.highwayDistance < runtime.highwayTarget * 0.85
        ? 'Dodge police interceptors on the Ring Road'
        : 'Break through Inspector Shamus’s roadblock ahead!';

    // Move & recycle traffic cars
    for (let i = 0; i < runtime.cars.length; i++) {
      const car = runtime.cars[i];
      car.y += (runtime.playerCarSpeed - car.vy) * dt;
      if (car.kind === 'police') {
        // Gentle lane tracking toward van
        const dx = runtime.playerCarX - car.x;
        car.x += clamp(dx, -65, 65) * dt;
      }
      if (car.y > runtime.config.worldHeight + 110 && runtime.highwayDistance < runtime.highwayTarget - 450) {
        car.y = -110 - ((i * 150) % 300);
        const lanes = [290, 415, 540, 675];
        car.x = lanes[(i + Math.floor(runtime.elapsed * 3)) % lanes.length];
      }

      // Van collision check
      if (
        Math.abs(car.x - runtime.playerCarX) < car.w * 0.5 + 20 &&
        Math.abs(car.y - runtime.playerCarY) < car.h * 0.5 + 34
      ) {
        car.y = -240;
        triggerSpot(runtime, 'Getaway van disabled by police collision!', events);
        events.crash = true;
      }
    }

    if (runtime.highwayDistance >= runtime.highwayTarget) {
      runtime.cameraFlash = 1.0;
      runtime.shakeTrauma = 1.0;
      events.crash = true;
      events.victory = true;
      runtime.outcome = 'cutscene';
      runtime.outcomeReason =
        'John rammed through the police cruiser blocking the highway. Moments too late, Static’s warning cut out—Shamus’s family was inside that car.';
    }
    return events;
  }

  // Switch active player (Level 4 dual-plate heist)
  if (input.switchJustPressed && runtime.players.length > 1) {
    runtime.activePlayerIndex =
      (runtime.activePlayerIndex + 1) % runtime.players.length;
  }

  const activePlayer = runtime.players[runtime.activePlayerIndex];
  if (!activePlayer) return events;

  // Player movement (supports camera-relative 3D movement vector when provided)
  let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (
    typeof input.moveVecX === 'number' &&
    typeof input.moveVecY === 'number' &&
    (Math.abs(input.moveVecX) > 0.001 || Math.abs(input.moveVecY) > 0.001)
  ) {
    moveX = input.moveVecX;
    moveY = input.moveVecY;
  }
  let isMoving = false;

  if (activePlayer.dashCooldown > 0) {
    activePlayer.dashCooldown = Math.max(0, activePlayer.dashCooldown - dt);
  }
  if (activePlayer.dashTimer > 0) {
    activePlayer.dashTimer = Math.max(0, activePlayer.dashTimer - dt);
  }
  if (activePlayer.hitFlash > 0) {
    activePlayer.hitFlash = Math.max(0, activePlayer.hitFlash - dt);
  }

  // Rooftop leap or combat fire with Space/action
  if (runtime.config.mode === 'rooftop_chase' && input.actionJustPressed && activePlayer.dashCooldown <= 0) {
    activePlayer.dashTimer = 0.34;
    activePlayer.dashCooldown = 0.65;
    spawnBurst(runtime, activePlayer.x, activePlayer.y, 8, '#94A3B8', 'dust', 90);
  }

  if (moveX !== 0 || moveY !== 0) {
    isMoving = true;
    const len = Math.hypot(moveX, moveY);
    const nx = moveX / len;
    const ny = moveY / len;
    const speedMult = activePlayer.dashTimer > 0 ? 1.85 : activePlayer.carryingBag ? 0.88 : 1.0;
    const rawX = activePlayer.x + nx * activePlayer.speed * speedMult * dt;
    const rawY = activePlayer.y + ny * activePlayer.speed * speedMult * dt;

    const resolved = resolveCircleRects(
      rawX,
      rawY,
      activePlayer.radius,
      runtime.walls,
      runtime.config.worldWidth,
      runtime.config.worldHeight,
      false
    );

    const prevPhase = Math.floor(activePlayer.walkPhase / Math.PI);
    activePlayer.walkPhase += Math.hypot(resolved.x - activePlayer.x, resolved.y - activePlayer.y) * 0.14;
    if (Math.floor(activePlayer.walkPhase / Math.PI) !== prevPhase) {
      events.step = true;
    }

    activePlayer.x = resolved.x;
    activePlayer.y = resolved.y;
    activePlayer.angle = Math.atan2(ny, nx);
  }

  // Aim toward mouse in combat level if cursor is over canvas
  if (runtime.config.mode === 'warehouse_war' && input.aimX !== null && input.aimY !== null) {
    activePlayer.angle = Math.atan2(input.aimY - activePlayer.y, input.aimX - activePlayer.x);
  }

  // Update guards
  updateGuards(runtime, dt);

  // Vision cone detection for stealth modes
  const stealthModes = [
    'stealth_photo',
    'stealth_drop',
    'dual_plate_heist',
    'timed_raid_escape',
    'wiretap_stealth',
    'harbour_run',
    'rooftop_chase',
  ];

  if (stealthModes.includes(runtime.config.mode)) {
    for (let gIdx = 0; gIdx < runtime.guards.length; gIdx++) {
      const g = runtime.guards[gIdx];
      if (g.koTimer > 0 || g.hp <= 0) continue;
      for (let pIdx = 0; pIdx < runtime.players.length; pIdx++) {
        const p = runtime.players[pIdx];
        if (
          isPointInVisionCone(
            p.x,
            p.y,
            g.x,
            g.y,
            g.angle,
            g.fov,
            g.range,
            runtime.walls
          )
        ) {
          triggerSpot(runtime, `Spotted by ${g.name}!`, events);
        }
      }
    }
  }

  // Mode-specific mechanics
  switch (runtime.config.mode) {
    case 'stealth_photo': {
      const photoZone = runtime.zones[0];
      if (photoZone) {
        const inZone = dist(activePlayer.x, activePlayer.y, photoZone.x, photoZone.y) <= photoZone.radius;
        if (inZone && !isMoving) {
          photoZone.progress = Math.min(photoZone.requiredTime, photoZone.progress + dt);
          runtime.objectiveProgress = photoZone.progress / photoZone.requiredTime;
          runtime.objectiveText = `Hold still to photograph Shasha (${photoZone.progress.toFixed(1)}s / 3.0s)`;
          if (photoZone.progress >= photoZone.requiredTime) {
            photoZone.completed = true;
            runtime.cameraFlash = 1.0;
            events.shutter = true;
            events.victory = true;
            runtime.outcome = 'victory';
            runtime.outcomeReason = 'Secret meeting photographed! Shasha’s leverage is secured.';
          }
        } else if (inZone && isMoving) {
          runtime.objectiveText = 'Stop moving inside the photo spot to focus the lens!';
        } else {
          photoZone.progress = Math.max(0, photoZone.progress - dt * 0.5);
          runtime.objectiveProgress = photoZone.progress / photoZone.requiredTime;
          runtime.objectiveText = 'Tail Shasha to the park and stand still in the photo spot (3s).';
        }
      }
      break;
    }

    case 'stealth_drop': {
      const letterbox = runtime.zones.find((z) => z.kind === 'letterbox');
      const waitSpot = runtime.zones.find((z) => z.kind === 'wait_spot');
      const envelope = runtime.zones.find((z) => z.kind === 'envelope');

      if (runtime.phase === 0 && letterbox) {
        runtime.objectiveText = 'Sneak to the letterbox to drop the blackmail photos.';
        if (dist(activePlayer.x, activePlayer.y, letterbox.x, letterbox.y) <= letterbox.radius) {
          letterbox.progress += dt;
          runtime.objectiveProgress = (letterbox.progress / letterbox.requiredTime) * 0.33;
          if (letterbox.progress >= letterbox.requiredTime) {
            letterbox.completed = true;
            letterbox.active = false;
            if (waitSpot) waitSpot.active = true;
            runtime.phase = 1;
            events.pickup = true;
            spawnBurst(runtime, letterbox.x, letterbox.y, 10, '#E5A93B', 'spark', 100);
          }
        }
      } else if (runtime.phase === 1 && waitSpot) {
        runtime.objectiveText = `Wait out of sight in the bushes (${waitSpot.progress.toFixed(1)}s / 2.5s)`;
        if (dist(activePlayer.x, activePlayer.y, waitSpot.x, waitSpot.y) <= waitSpot.radius) {
          waitSpot.progress += dt;
          runtime.objectiveProgress = 0.33 + (waitSpot.progress / waitSpot.requiredTime) * 0.34;
          if (waitSpot.progress >= waitSpot.requiredTime) {
            waitSpot.completed = true;
            waitSpot.active = false;
            if (envelope) envelope.active = true;
            runtime.phase = 2;
            events.pickup = true;
          }
        }
      } else if (runtime.phase === 2 && envelope) {
        runtime.objectiveText = 'Grab the vault blueprint envelope Shasha left at the porch!';
        if (dist(activePlayer.x, activePlayer.y, envelope.x, envelope.y) <= envelope.radius) {
          envelope.completed = true;
          runtime.objectiveProgress = 1;
          events.pickup = true;
          events.victory = true;
          runtime.outcome = 'victory';
          runtime.outcomeReason = 'Crown Vault blueprints acquired. Shasha complied.';
        }
      }
      break;
    }

    case 'dual_plate_heist': {
      const plateA = runtime.zones.find((z) => z.kind === 'plate_a');
      const plateB = runtime.zones.find((z) => z.kind === 'plate_b');
      const van = runtime.zones.find((z) => z.kind === 'van');

      if (!runtime.vaultOpen && plateA && plateB && runtime.players.length >= 2) {
        const p0 = runtime.players[0];
        const p1 = runtime.players[1];
        const aPressed =
          dist(p0.x, p0.y, plateA.x, plateA.y) <= plateA.radius ||
          dist(p1.x, p1.y, plateA.x, plateA.y) <= plateA.radius;
        const bPressed =
          dist(p0.x, p0.y, plateB.x, plateB.y) <= plateB.radius ||
          dist(p1.x, p1.y, plateB.x, plateB.y) <= plateB.radius;

        plateA.completed = aPressed;
        plateB.completed = bPressed;

        if (aPressed && bPressed) {
          runtime.vaultOpen = true;
          // Remove vault_door wall
          runtime.walls = runtime.walls.filter((w) => w.kind !== 'vault_door');
          if (van) van.active = true;
          events.vaultOpened = true;
          runtime.shakeTrauma = 0.45;
          spawnBurst(runtime, 657, 310, 20, '#E5A93B', 'spark', 160);
        } else {
          runtime.objectiveText = `Press both Plates A & B at once (Tab/Q switches operative).`;
          runtime.objectiveProgress = (aPressed ? 0.25 : 0) + (bPressed ? 0.25 : 0);
        }
      } else {
        // Collect cash bags in vault
        let collectedCount = 0;
        for (let i = 0; i < runtime.bags.length; i++) {
          const b = runtime.bags[i];
          if (!b.collected) {
            for (let pIdx = 0; pIdx < runtime.players.length; pIdx++) {
              const p = runtime.players[pIdx];
              if (dist(p.x, p.y, b.x, b.y) <= 26) {
                b.collected = true;
                p.carryingBag = true;
                events.pickup = true;
                spawnBurst(runtime, b.x, b.y, 10, '#22C55E', 'spark', 110);
              }
            }
          }
          if (b.collected) collectedCount++;
        }

        if (collectedCount < runtime.totalBags) {
          runtime.objectiveText = `Vault open! Grab the cash (${collectedCount}/${runtime.totalBags}).`;
          runtime.objectiveProgress = 0.5 + (collectedCount / runtime.totalBags) * 0.3;
        } else {
          runtime.objectiveText = 'All cash secured! Get to the getaway van outside!';
          runtime.objectiveProgress = 0.85;
          if (
            van &&
            runtime.players.some((p) => dist(p.x, p.y, van.x, van.y) <= van.radius)
          ) {
            runtime.bagsDelivered = runtime.totalBags;
            runtime.objectiveProgress = 1;
            events.victory = true;
            runtime.outcome = 'victory';
            runtime.outcomeReason = 'Crown Vault cleared without blowing the crew cover.';
          }
        }
      }
      break;
    }

    case 'timed_raid_escape':
    case 'harbour_run': {
      const dropZone = runtime.zones[0];
      for (let i = 0; i < runtime.bags.length; i++) {
        const b = runtime.bags[i];
        if (!b.collected && dist(activePlayer.x, activePlayer.y, b.x, b.y) <= 26) {
          b.collected = true;
          activePlayer.carryingBag = true;
          events.pickup = true;
          spawnBurst(runtime, b.x, b.y, 10, '#E5A93B', 'spark', 120);
        }
      }

      if (dropZone && dist(activePlayer.x, activePlayer.y, dropZone.x, dropZone.y) <= dropZone.radius) {
        let deliveredNow = false;
        for (let i = 0; i < runtime.bags.length; i++) {
          const b = runtime.bags[i];
          if (b.collected && !b.delivered) {
            b.delivered = true;
            runtime.bagsDelivered++;
            deliveredNow = true;
          }
        }
        if (deliveredNow) {
          activePlayer.carryingBag = false;
          events.pickup = true;
          spawnBurst(runtime, dropZone.x, dropZone.y, 14, '#22C55E', 'spark', 140);
        }
      }

      runtime.objectiveProgress = runtime.totalBags > 0 ? runtime.bagsDelivered / runtime.totalBags : 0;
      const targetName = runtime.levelId === 5 ? "Randy's van" : 'the midnight boat';
      runtime.objectiveText = `Deliver cash bags to ${targetName} (${runtime.bagsDelivered}/${runtime.totalBags})`;

      if (runtime.bagsDelivered >= runtime.totalBags) {
        events.victory = true;
        runtime.outcome = 'victory';
        runtime.outcomeReason =
          runtime.levelId === 5
            ? 'Crew and cash loaded into the van moments before Shamus breached the alley.'
            : 'All cash bags loaded onto the boat—the haul is heading offshore.';
      }
      break;
    }

    case 'wiretap_stealth': {
      const antenna = runtime.zones.find((z) => z.kind === 'antenna');
      const exitZone = runtime.zones.find((z) => z.kind === 'exit');

      if (runtime.phase === 0 && antenna) {
        const inZone = dist(activePlayer.x, activePlayer.y, antenna.x, antenna.y) <= antenna.radius;
        if (inZone) {
          antenna.progress = Math.min(antenna.requiredTime, antenna.progress + dt);
          runtime.objectiveProgress = (antenna.progress / antenna.requiredTime) * 0.8;
          runtime.objectiveText = `Splicing Pablo's phone line (${antenna.progress.toFixed(1)}s / 5.0s)`;
          if (antenna.progress >= antenna.requiredTime) {
            antenna.completed = true;
            antenna.active = false;
            if (exitZone) exitZone.active = true;
            runtime.phase = 1;
            runtime.activeDialogueIndex = 1; // Switch to Shamus line
            events.pickup = true;
            spawnBurst(runtime, antenna.x, antenna.y, 16, '#38BDF8', 'spark', 140);
          }
        } else {
          runtime.objectiveText = "Reach the warehouse antenna and hold for 5s to tap Pablo's call.";
        }
      } else if (runtime.phase === 1 && exitZone) {
        runtime.objectiveText = 'Wiretap complete! They’re hunting all four—extract to the alley.';
        runtime.objectiveProgress = 0.85;
        if (dist(activePlayer.x, activePlayer.y, exitZone.x, exitZone.y) <= exitZone.radius) {
          runtime.objectiveProgress = 1;
          events.victory = true;
          runtime.outcome = 'victory';
          runtime.outcomeReason = 'Brock intercepted Shamus & Pablo’s pact and escaped clean.';
        }
      }
      break;
    }

    case 'warehouse_war': {
      // Player firing
      if ((input.actionJustPressed || input.fireJustPressed) && runtime.shootCooldown <= 0) {
        runtime.shootCooldown = 0.24;
        const speed = 560;
        spawnBullet(
          runtime,
          activePlayer.x + Math.cos(activePlayer.angle) * 16,
          activePlayer.y + Math.sin(activePlayer.angle) * 16,
          Math.cos(activePlayer.angle) * speed,
          Math.sin(activePlayer.angle) * speed,
          true,
          '#FBBF24'
        );
        events.shot = true;
      }

      // Enemy AI combat & telegraphed bursts
      let aliveEnemies = 0;
      let totalEnemyMaxHp = 0;
      let totalEnemyHp = 0;
      for (let i = 0; i < runtime.guards.length; i++) {
        const g = runtime.guards[i];
        totalEnemyMaxHp += g.maxHp;
        if (g.hp <= 0) continue;
        aliveEnemies++;
        totalEnemyHp += g.hp;

        const los = hasLineOfSight(g.x, g.y, activePlayer.x, activePlayer.y, runtime.walls);
        if (los) {
          const ang = Math.atan2(activePlayer.y - g.y, activePlayer.x - g.x);
          g.angle = lerpAngle(g.angle, ang, dt * 8);
          if (g.telegraphTimer > 0) {
            g.telegraphTimer -= dt;
            if (g.telegraphTimer <= 0) {
              const burstCount = g.kind === 'pablo' ? 3 : 1;
              for (let b = 0; b < burstCount; b++) {
                const spread = (b - (burstCount - 1) / 2) * 0.16;
                spawnBullet(
                  runtime,
                  g.x + Math.cos(ang + spread) * 16,
                  g.y + Math.sin(ang + spread) * 16,
                  Math.cos(ang + spread) * 340,
                  Math.sin(ang + spread) * 340,
                  false,
                  '#EF4444'
                );
              }
              events.shot = true;
              g.attackCooldown = g.kind === 'pablo' ? 1.35 : 1.75;
            }
          } else {
            g.attackCooldown -= dt;
            if (g.attackCooldown <= 0) {
              g.telegraphTimer = 0.42; // clear 420ms windup telegraph
            }
          }
        }
      }

      // Update bullets
      for (let i = 0; i < runtime.bullets.length; i++) {
        const b = runtime.bullets[i];
        if (!b.active) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;

        if (
          b.life <= 0 ||
          b.x < -3000 ||
          b.x > 4000 ||
          b.y < -3000 ||
          b.y > 4000
        ) {
          b.active = false;
          continue;
        }

        // Wall collision
        let hitWall = false;
        for (let w = 0; w < runtime.walls.length; w++) {
          if (circleIntersectsRect(b.x, b.y, 4, runtime.walls[w])) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          b.active = false;
          spawnBurst(runtime, b.x, b.y, 5, '#94A3B8', 'spark', 80);
          continue;
        }

        if (b.fromPlayer) {
          for (let gIdx = 0; gIdx < runtime.guards.length; gIdx++) {
            const g = runtime.guards[gIdx];
            if (g.hp <= 0) continue;
            if (dist(b.x, b.y, g.x, g.y) <= 18) {
              b.active = false;
              g.hp = Math.max(0, g.hp - 25);
              g.hitFlash = 0.08;
              runtime.hitstopTimer = g.hp === 0 ? 0.05 : 0.025;
              runtime.shakeTrauma = Math.min(1, runtime.shakeTrauma + 0.25);
              spawnBurst(runtime, b.x, b.y, g.hp === 0 ? 18 : 8, '#EF4444', 'spark', 150);
              break;
            }
          }
        } else {
          if (dist(b.x, b.y, activePlayer.x, activePlayer.y) <= activePlayer.radius + 4) {
            b.active = false;
            activePlayer.hp = Math.max(0, activePlayer.hp - 18);
            activePlayer.hitFlash = 0.1;
            runtime.alertFlash = 0.25;
            runtime.shakeTrauma = Math.min(1, runtime.shakeTrauma + 0.35);
            spawnBurst(runtime, activePlayer.x, activePlayer.y, 10, '#EF4444', 'spark', 120);
            if (activePlayer.hp <= 0) {
              runtime.outcome = 'busted';
              runtime.outcomeReason = "Pinned down inside Pablo's warehouse.";
              events.defeat = true;
              return events;
            }
          }
        }
      }

      runtime.objectiveProgress =
        totalEnemyMaxHp > 0 ? 1 - totalEnemyHp / totalEnemyMaxHp : 1;
      const pablo = runtime.guards.find((g) => g.kind === 'pablo');
      runtime.objectiveText =
        pablo && pablo.hp > 0
          ? `Eliminate Pablo and his cartel guards (Pablo HP: ${pablo.hp})`
          : `Clear remaining cartel guards (${aliveEnemies} left)`;

      if (aliveEnemies === 0) {
        events.victory = true;
        runtime.outcome = 'victory';
        runtime.outcomeReason = 'Pablo is down. Shamus has lost his muscle.';
      }
      break;
    }

    case 'rooftop_chase': {
      // Shamus dashes ahead across the rooftop toward the east edge
      const targetX = clamp(activePlayer.x + 210, 420, 940);
      runtime.shamusEscapeX += (targetX - runtime.shamusEscapeX) * dt * 2.2;
      runtime.shamusEscapeY = 310 + Math.sin(runtime.elapsed * 2.2) * 65;

      // Check rooftop gap hazards unless dashing
      if (activePlayer.dashTimer <= 0) {
        for (let i = 0; i < runtime.rooftopGaps.length; i++) {
          const gap = runtime.rooftopGaps[i];
          if (
            activePlayer.x > gap.x + 6 &&
            activePlayer.x < gap.x + gap.w - 6 &&
            activePlayer.y > gap.y &&
            activePlayer.y < gap.y + gap.h
          ) {
            // Fell into alley gap: pull back to left ledge and cost 1 spot
            activePlayer.x = gap.x - 16;
            triggerSpot(runtime, 'Fell between the rooftops! Press Space to leap gaps.', events);
          }
        }
      }

      const finish = runtime.zones.find((z) => z.kind === 'rooftop_finish');
      runtime.objectiveProgress = clamp((activePlayer.x - 75) / (920 - 75), 0, 1);
      runtime.objectiveText = 'Chase Shamus across the rooftops! Press Space to leap gaps.';

      if (finish && dist(activePlayer.x, activePlayer.y, finish.x, finish.y) <= finish.radius + 10) {
        runtime.shamusJumped = true;
        runtime.objectiveProgress = 1;
        events.victory = true;
        runtime.outcome = 'finale';
        runtime.outcomeReason =
          'Shamus vaulted off the skyline parapet and vanished into the rain below. Radio static crackled: "This isn’t over, Roman. I’ll be waiting."';
      }
      break;
    }
  }

  return events;
}

export function extractHudSnapshot(runtime: LevelRuntime): HudSnapshot {
  const active = runtime.players[runtime.activePlayerIndex];
  const pablo = runtime.guards.find((g) => g.kind === 'pablo');

  return {
    levelId: runtime.levelId,
    levelTitle: runtime.config.title,
    objectiveText: runtime.objectiveText,
    objectiveProgress: runtime.objectiveProgress,
    timerRemaining: Math.ceil(runtime.timerRemaining),
    hasTimer: runtime.config.timeLimit > 0,
    spottedCount: runtime.spottedCount,
    maxSpots: runtime.config.maxSpots,
    activeCrewName: active ? active.name : 'Roman',
    activeCrewRole: active ? active.role : 'P1',
    canSwitchCrew: runtime.players.length > 1,
    carryingBag: active ? active.carryingBag : false,
    bagsDelivered: runtime.bagsDelivered,
    totalBags: runtime.totalBags,
    playerHp: active ? active.hp : 100,
    playerMaxHp: active ? active.maxHp : 100,
    bossHp: pablo ? pablo.hp : 0,
    bossMaxHp: pablo ? pablo.maxHp : 0,
    vaultOpen: runtime.vaultOpen,
    phase: runtime.phase,
    elapsed: runtime.elapsed,
    dialogue: runtime.config.dialogue[runtime.activeDialogueIndex] ?? null,
    outcome: runtime.outcome,
    outcomeReason: runtime.outcomeReason,
    highwayProgress:
      runtime.highwayTarget > 0
        ? clamp(runtime.highwayDistance / runtime.highwayTarget, 0, 1)
        : 0,
  };
}
