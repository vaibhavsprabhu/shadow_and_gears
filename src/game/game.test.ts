import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelRuntime, stepSimulation, type InputState } from './engine';
import { LEVEL_CONFIGS } from './levels';
import { hasLineOfSight, isPointInVisionCone } from './math';

const IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  actionJustPressed: false,
  actionHeld: false,
  switchJustPressed: false,
  aimX: null,
  aimY: null,
  fireJustPressed: false,
};

test('all 10 levels exist and use updated character names with zero legacy names', () => {
  assert.equal(LEVEL_CONFIGS.length, 10);
  const fullText = JSON.stringify(LEVEL_CONFIGS);
  assert.ok(fullText.includes('Roman'));
  assert.ok(fullText.includes('Brock'));
  assert.ok(fullText.includes('Shasha'));
  assert.ok(fullText.includes('Shamus'));
  assert.ok(!fullText.includes('Wire'));
  assert.ok(!fullText.includes('Ritu'));
  assert.ok(!fullText.includes('Rathore'));
});

test('vision cone respects wall occlusion', () => {
  const walls = [{ x: 100, y: 0, w: 30, h: 200 }];
  assert.equal(hasLineOfSight(50, 100, 180, 100, walls), false);
  assert.equal(isPointInVisionCone(180, 100, 50, 100, 0, Math.PI / 2, 250, walls), false);
  assert.equal(isPointInVisionCone(80, 100, 50, 100, 0, Math.PI / 2, 250, walls), true);
});

test('Level 1 completes when Roman holds still at the photo spot for 3 seconds', () => {
  const rt = createLevelRuntime(1);
  const photo = rt.zones[0];
  rt.players[0].x = photo.x;
  rt.players[0].y = photo.y;

  // Step 3.2 seconds in 0.04s increments
  for (let i = 0; i < 80; i++) {
    stepSimulation(rt, 0.04, IDLE_INPUT);
  }
  assert.equal(rt.outcome, 'victory');
});

test('Level 4 vault opens only when both operatives stand on Plate A and Plate B', () => {
  const rt = createLevelRuntime(4, { plateA: 'roman', plateB: 'brock', driver: 'randy' });
  const plateA = rt.zones.find((z) => z.kind === 'plate_a')!;
  const plateB = rt.zones.find((z) => z.kind === 'plate_b')!;

  rt.players[0].x = plateA.x;
  rt.players[0].y = plateA.y;
  stepSimulation(rt, 0.03, IDLE_INPUT);
  assert.equal(rt.vaultOpen, false);

  rt.players[1].x = plateB.x;
  rt.players[1].y = plateB.y;
  stepSimulation(rt, 0.03, IDLE_INPUT);
  assert.equal(rt.vaultOpen, true);
});

test('Level 6 triggers cutscene when highway distance reaches roadblock target', () => {
  const rt = createLevelRuntime(6);
  rt.highwayDistance = rt.highwayTarget - 5;
  stepSimulation(rt, 0.03, IDLE_INPUT);
  assert.equal(rt.outcome, 'cutscene');
});

test('Selectable operatives deploy into levels and Level 9 spawns Roman, John, and Brock', () => {
  const l1John = createLevelRuntime(1, undefined, 'john');
  assert.equal(l1John.players[0].id, 'john');
  assert.equal(l1John.guards[0].kind, 'shasha');

  const l5 = createLevelRuntime(5, undefined, 'brock');
  assert.equal(l5.players[0].id, 'brock');
  assert.equal(l5.guards[0].kind, 'shamus');

  const l9 = createLevelRuntime(9);
  assert.deepEqual(
    l9.players.map((p) => p.id),
    ['roman', 'john', 'brock']
  );
  assert.ok(l9.guards.some((g) => g.kind === 'pablo'));
});

import { findCityLocationAtNormalizedCoord } from './cityMap2d';
import {
  CITY_LOCATIONS,
  CITY_MAP_LAYOUT,
  CITY_ROADS,
  LEVEL_CITY_ANCHORS,
  findNearbyCityLocation,
  getAllLevelClearPropRects,
  getLevelCityAnchor,
} from './cityMapData';

test('city map layout exposes 12 locations, 6 roads, and canonical spawn/proximity detection', () => {
  assert.equal(CITY_LOCATIONS.length, 12);
  assert.equal(CITY_ROADS.length, 6);
  assert.deepEqual(CITY_MAP_LAYOUT.spawn, { x: -150, z: 7 });

  for (const loc of CITY_LOCATIONS) {
    assert.ok(loc.primaryLevelId >= 1 && loc.primaryLevelId <= 10);
  }

  const nearHideout = findNearbyCityLocation(-150, 0, 10);
  assert.equal(nearHideout?.id, 1);
  assert.equal(nearHideout?.name, 'Crew Hideout');

  const nearRooftop = findNearbyCityLocation(-137, 12.25, 150);
  assert.equal(nearRooftop?.id, 12);
  assert.equal(nearRooftop?.primaryLevelId, 10);

  // Height check prevents false rooftop trigger from ground level
  const groundBelowRooftop = findNearbyCityLocation(-137, 0, 150);
  assert.equal(groundBelowRooftop, null);
});

test('all 10 heist levels anchor to valid 3D city districts and clear-prop rectangles', () => {
  const validIds = new Set(CITY_LOCATIONS.map((l) => l.id));
  for (let levelId = 1; levelId <= 10; levelId++) {
    const anchor = getLevelCityAnchor(levelId);
    assert.equal(anchor.levelId, levelId);
    assert.ok(validIds.has(anchor.locationId), `L${levelId} invalid locationId`);
    assert.ok(Number.isFinite(anchor.anchorX) && Math.abs(anchor.anchorX) <= 200);
    assert.ok(Number.isFinite(anchor.anchorY) && anchor.anchorY >= 0);
    assert.ok(Number.isFinite(anchor.anchorZ) && Math.abs(anchor.anchorZ) <= 200);
    assert.ok(anchor.districtName.length > 0);
    assert.ok(LEVEL_CITY_ANCHORS[levelId]);
  }

  const clearRects = getAllLevelClearPropRects();
  assert.equal(clearRects.length, 10);
  for (const r of clearRects) {
    assert.ok(r.x1 > r.x0 && r.z1 > r.z0);
  }

  // Normalized map click near Crown Vault Bank (50, -26) -> (250/400 = 0.625, 174/400 = 0.435)
  const clickedBank = findCityLocationAtNormalizedCoord(250 / 400, 174 / 400);
  assert.equal(clickedBank?.id, 6);
  assert.equal(clickedBank?.name, 'Crown Vault Bank');
});

import {
  canDeployLevel,
  clampHighestUnlocked,
  clampRequestedLevel,
  getLevelLockMessage,
  getUnlockedLevelAfterCompletion,
} from './progression';

test('levels 2-10 stay strictly locked until level 1 and preceding levels are completed', () => {
  assert.equal(clampHighestUnlocked(NaN), 1);
  assert.equal(clampHighestUnlocked(0), 1);
  assert.equal(clampHighestUnlocked(15), 10);

  // When highestUnlocked is 1, only Level 1 can be deployed
  assert.equal(canDeployLevel(1, 1), true);
  for (let lvl = 2; lvl <= 10; lvl++) {
    assert.equal(canDeployLevel(lvl, 1), false, `Level ${lvl} must be locked before L1 completion`);
    assert.equal(clampRequestedLevel(lvl, 1), 1);
    assert.equal(getLevelLockMessage(lvl, 1), 'Complete Level 1 first to unlock');
  }

  // Completing Level 1 unlocks Level 2, but keeps Levels 3-10 locked
  const afterL1 = getUnlockedLevelAfterCompletion(1, 1);
  assert.equal(afterL1, 2);
  assert.equal(canDeployLevel(2, afterL1), true);
  assert.equal(canDeployLevel(3, afterL1), false);
  assert.equal(getLevelLockMessage(3, afterL1), 'Complete Level 2 first to unlock');

  // Cannot skip ahead by claiming completion of an unreached level
  assert.equal(getUnlockedLevelAfterCompletion(1, 4), 1);
});

test('camera-relative 3D moveVec drives operative smoothly in world coordinates', () => {
  const rt = createLevelRuntime(1);
  const startX = rt.players[0].x;
  const startY = rt.players[0].y;

  // Simulate pressing W with camera rotated 90 deg east (moveVecX = 1, moveVecY = 0)
  stepSimulation(rt, 0.05, {
    ...IDLE_INPUT,
    up: true,
    moveVecX: 1,
    moveVecY: 0,
  });

  assert.ok(rt.players[0].x > startX, 'Player should move east along camera-relative forward vector');
  assert.equal(Math.round(rt.players[0].y), Math.round(startY));
});




