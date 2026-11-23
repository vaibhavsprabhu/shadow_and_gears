export interface CityRoadSpec {
  name: string;
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  width: number;
}

export interface CityLocationSpec {
  id: number;
  name: string;
  levels: string;
  primaryLevelId: number;
  marker: {
    x: number;
    y: number;
    z: number;
  };
  spawn: {
    x: number;
    z: number;
  };
  labelHeightOffset: number;
  color: string;
  brief: string;
}

export interface CityMapLayoutJson {
  units: string;
  spawn: { x: number; z: number };
  locations: Array<{
    id: number;
    name: string;
    levels: string;
    marker: { x: number; y: number; z: number };
    spawn: { x: number; z: number };
  }>;
  roads: CityRoadSpec[];
}

export const CITY_ROADS: CityRoadSpec[] = [
  { name: 'Station Road', axis: 'x', at: 0, from: -200, to: 200, width: 10 },
  { name: 'Hill Road', axis: 'x', at: -90, from: -105, to: 200, width: 10 },
  { name: 'Dock Road', axis: 'x', at: 95, from: -200, to: 200, width: 10 },
  { name: 'Market Avenue', axis: 'z', at: 0, from: -200, to: 162, width: 10 },
  { name: 'Old Town Lane', axis: 'z', at: -100, from: -200, to: 162, width: 10 },
  { name: 'Industrial Road', axis: 'z', at: 100, from: -200, to: 162, width: 10 },
];

export const CITY_LOCATIONS: CityLocationSpec[] = [
  {
    id: 1,
    name: 'Crew Hideout',
    levels: 'LEVEL 3 · LEVEL 5',
    primaryLevelId: 3,
    marker: { x: -150, y: 0, z: 12 },
    spawn: { x: -150, z: 7 },
    labelHeightOffset: 12,
    color: '#ffb347',
    brief:
      "Static's safehouse. Study the blueprint and assign roles here (L3). Inspector Shamus raids it in L5 — carry the bags out before his team surrounds you.",
  },
  {
    id: 2,
    name: 'Lantern Alley',
    levels: 'LEVEL 1',
    primaryLevelId: 1,
    marker: { x: -150, y: 0, z: -55 },
    spawn: { x: -150, z: -12 },
    labelHeightOffset: 9,
    color: '#ff5a4e',
    brief:
      "Shasha's Thursday route. Tail her up the cobbled alley without stepping into her vision cone.",
  },
  {
    id: 3,
    name: 'Hilltop Temple',
    levels: 'LEVEL 1',
    primaryLevelId: 1,
    marker: { x: -150, y: 9, z: -150 },
    spawn: { x: -150, z: -130 },
    labelHeightOffset: 22,
    color: '#f2c14e',
    brief:
      "Where Shasha says she's going every Thursday. She never actually goes in.",
  },
  {
    id: 4,
    name: 'Sakura Park · Photo Spot',
    levels: 'LEVEL 1',
    primaryLevelId: 1,
    marker: { x: -80, y: 0, z: -20 },
    spawn: { x: -50, z: -11 },
    labelHeightOffset: 7,
    color: '#ff9ecf',
    brief:
      'The secret meeting. Hide behind the bushes at the photo spot and hold still for 3 seconds.',
  },
  {
    id: 5,
    name: 'Malhotra House',
    levels: 'LEVEL 2',
    primaryLevelId: 2,
    marker: { x: 57, y: 0, z: -106 },
    spawn: { x: 50, z: -100 },
    labelHeightOffset: 14,
    color: '#7fd1ff',
    brief:
      'Drop the photos in the letterbox by the gate without the house guard seeing you, then come back for the blueprint envelope.',
  },
  {
    id: 6,
    name: 'Crown Vault Bank',
    levels: 'LEVEL 4',
    primaryLevelId: 4,
    marker: { x: 50, y: 0.4, z: -26 },
    spawn: { x: 50, z: -14 },
    labelHeightOffset: 20,
    color: '#ffd700',
    brief:
      'Dual-key vault: two players on two pressure plates at the same moment. One life — caught once = busted.',
  },
  {
    id: 7,
    name: "Randy's Garage",
    levels: 'LEVEL 4 · LEVEL 8',
    primaryLevelId: 4,
    marker: { x: -50, y: 0, z: 18 },
    spawn: { x: -50, z: 8 },
    labelHeightOffset: 12,
    color: '#9be15d',
    brief:
      'Home of the getaway van. Escape point after the robbery, and where the harbour run starts.',
  },
  {
    id: 8,
    name: 'Police HQ',
    levels: 'LEVEL 5',
    primaryLevelId: 5,
    marker: { x: 150, y: 0, z: -30 },
    spawn: { x: 150, z: -12 },
    labelHeightOffset: 16,
    color: '#5b8cff',
    brief:
      "Inspector Shamus's station. He doesn't take bribes, and he doesn't let go.",
  },
  {
    id: 9,
    name: 'Highway Roadblock',
    levels: 'LEVEL 6',
    primaryLevelId: 6,
    marker: { x: 184, y: 0, z: 0 },
    spawn: { x: 166, z: 0 },
    labelHeightOffset: 8,
    color: '#ff7a1a',
    brief:
      'Shamus blocks the east highway. Break through the roadblock — the crash that changes everything happens here.',
  },
  {
    id: 10,
    name: "Pablo's Warehouse",
    levels: 'LEVEL 7 · LEVEL 9',
    primaryLevelId: 7,
    marker: { x: 176, y: 0, z: 22 },
    spawn: { x: 150, z: 8 },
    labelHeightOffset: 30,
    color: '#c77dff',
    brief:
      "Stand by the antenna for 5 seconds without Pablo's men seeing you to tap the line (L7). Come back in L9 for the gang war.",
  },
  {
    id: 11,
    name: 'Harbour',
    levels: 'LEVEL 8',
    primaryLevelId: 8,
    marker: { x: 124, y: 0.3, z: 182 },
    spawn: { x: 124, z: 158 },
    labelHeightOffset: 9,
    color: '#2ec4b6',
    brief:
      'Midnight boat that asks no questions. Load the bags before the timer runs out.',
  },
  {
    id: 12,
    name: 'Rooftop District',
    levels: 'LEVEL 10',
    primaryLevelId: 10,
    marker: { x: -137, y: 12.25, z: 150 },
    spawn: { x: -110, z: 163 },
    labelHeightOffset: 20,
    color: '#e8e8e8',
    brief:
      'Climb the fire-escape ramp, then chase Shamus roof to roof. He jumps from this last roof and disappears.',
  },
];

export const CITY_MAP_LAYOUT: CityMapLayoutJson = {
  units: 'metres (three.js units), y up, -z = north',
  spawn: { x: CITY_LOCATIONS[0].spawn.x, z: CITY_LOCATIONS[0].spawn.z },
  locations: CITY_LOCATIONS.map((loc) => ({
    id: loc.id,
    name: loc.name,
    levels: loc.levels,
    marker: { ...loc.marker },
    spawn: { ...loc.spawn },
  })),
  roads: CITY_ROADS.map((road) => ({ ...road })),
};

export interface LevelCityAnchor {
  levelId: number;
  locationId: number;
  districtName: string;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  defaultNight: boolean;
  clearPropRect?: { x0: number; x1: number; z0: number; z1: number };
}

export const LEVEL_CITY_ANCHORS: Record<number, LevelCityAnchor> = {
  1: {
    levelId: 1,
    locationId: 4,
    districtName: 'Sakura Park · Lantern District',
    anchorX: -50,
    anchorY: 0,
    anchorZ: -45,
    defaultNight: false,
    clearPropRect: { x0: -67, x1: -33, z0: -56, z1: -34 },
  },
  2: {
    levelId: 2,
    locationId: 5,
    districtName: 'Malhotra Residence',
    anchorX: 50,
    anchorY: 0,
    anchorZ: -116,
    defaultNight: false,
    clearPropRect: { x0: 33, x1: 67, z0: -127, z1: -105 },
  },
  3: {
    levelId: 3,
    locationId: 1,
    districtName: 'Crew Hideout · Station Road',
    anchorX: -150,
    anchorY: 0,
    anchorZ: 0,
    defaultNight: false,
    clearPropRect: { x0: -166, x1: -134, z0: -9.5, z1: 9.5 },
  },
  4: {
    levelId: 4,
    locationId: 6,
    districtName: 'Crown Vault Bank Plaza',
    anchorX: 50,
    anchorY: 0.4,
    anchorZ: -20,
    defaultNight: true,
    clearPropRect: { x0: 33, x1: 67, z0: -30, z1: -10 },
  },
  5: {
    levelId: 5,
    locationId: 1,
    districtName: 'Crew Hideout · Raid Zone',
    anchorX: -150,
    anchorY: 0,
    anchorZ: 0,
    defaultNight: true,
    clearPropRect: { x0: -166, x1: -134, z0: -9.5, z1: 9.5 },
  },
  6: {
    levelId: 6,
    locationId: 9,
    districtName: 'Station Road · Highway Blockade',
    anchorX: 150,
    anchorY: 0,
    anchorZ: 0,
    defaultNight: true,
    clearPropRect: { x0: 133, x1: 167, z0: -10, z1: 10 },
  },
  7: {
    levelId: 7,
    locationId: 10,
    districtName: "Pablo's Warehouse Compound",
    anchorX: 150,
    anchorY: 0,
    anchorZ: 18,
    defaultNight: true,
    clearPropRect: { x0: 133, x1: 167, z0: 8, z1: 28 },
  },
  8: {
    levelId: 8,
    locationId: 11,
    districtName: 'Harbour Wharf & Midnight Pier',
    anchorX: 124,
    anchorY: 0.3,
    anchorZ: 148,
    defaultNight: true,
    clearPropRect: { x0: 107, x1: 141, z0: 137, z1: 159 },
  },
  9: {
    levelId: 9,
    locationId: 10,
    districtName: "Pablo's Warehouse Yard",
    anchorX: 150,
    anchorY: 0,
    anchorZ: 70,
    defaultNight: true,
    clearPropRect: { x0: 133, x1: 167, z0: 59, z1: 81 },
  },
  10: {
    levelId: 10,
    locationId: 12,
    districtName: 'Rooftop District Skyline',
    anchorX: -150,
    anchorY: 12.25,
    anchorZ: 146,
    defaultNight: true,
    clearPropRect: { x0: -167, x1: -133, z0: 135, z1: 157 },
  },
};

export function getLevelCityAnchor(levelId: number): LevelCityAnchor {
  return LEVEL_CITY_ANCHORS[levelId] ?? LEVEL_CITY_ANCHORS[1];
}

export function getAllLevelClearPropRects(): Array<{ x0: number; x1: number; z0: number; z1: number }> {
  const rects: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
  for (const anchor of Object.values(LEVEL_CITY_ANCHORS)) {
    if (anchor.clearPropRect) rects.push(anchor.clearPropRect);
  }
  return rects;
}

export function findNearbyCityLocation(
  x: number,
  y: number,
  z: number,
  locations: ReadonlyArray<CityLocationSpec> = CITY_LOCATIONS,
  groundYOverrides?: Record<number, number>
): CityLocationSpec | null {
  let near: CityLocationSpec | null = null;
  let bestDist = 14;
  for (const loc of locations) {
    const gy = groundYOverrides?.[loc.id] ?? loc.marker.y;
    const dist = Math.hypot(x - loc.marker.x, z - loc.marker.z);
    if (dist < bestDist && Math.abs(y - gy) < 6) {
      bestDist = dist;
      near = loc;
    }
  }
  return near;
}

