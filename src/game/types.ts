export type AppScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type OutcomeKind = 'none' | 'victory' | 'busted' | 'cutscene' | 'finale';

export type CrewId = 'roman' | 'brock' | 'john' | 'randy';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: 'wall' | 'building' | 'hedge' | 'crate' | 'vault_door' | 'table' | 'roof';
  label?: string;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  tone?: 'crew' | 'handler' | 'target' | 'villain' | 'note';
}

export interface RoleAssignment {
  plateA: CrewId;
  plateB: CrewId;
  driver: CrewId;
}

export interface GuardActor {
  id: string;
  name: string;
  kind: 'shasha' | 'guard' | 'swat' | 'cartel' | 'pablo' | 'shamus';
  x: number;
  y: number;
  angle: number;
  speed: number;
  fov: number; // radians
  range: number;
  waypoints: Vec2[];
  waypointIndex: number;
  waitTimer: number;
  pauseAtWaypoint: number;
  hp: number;
  maxHp: number;
  koTimer: number;
  hitFlash: number;
  attackCooldown: number;
  telegraphTimer: number;
  color: string;
}

export interface PlayerActor {
  id: CrewId;
  name: string;
  role: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
  color: string;
  carryingBag: boolean;
  hp: number;
  maxHp: number;
  dashTimer: number;
  dashCooldown: number;
  hitFlash: number;
  walkPhase: number;
}

export interface ZoneMarker {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  kind:
    | 'photo_spot'
    | 'letterbox'
    | 'wait_spot'
    | 'envelope'
    | 'plate_a'
    | 'plate_b'
    | 'van'
    | 'antenna'
    | 'boat'
    | 'exit'
    | 'roadblock'
    | 'rooftop_finish';
  active: boolean;
  completed: boolean;
  progress: number;
  requiredTime: number;
}

export interface CashBag {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  delivered: boolean;
}

export interface TrafficCar {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx: number;
  kind: 'civilian' | 'police' | 'cartel' | 'roadblock';
  hp: number;
}

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  life: number;
  color: string;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'rain' | 'spark' | 'smoke' | 'flash' | 'dust';
}

export interface RooftopGap {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelConfig {
  id: number; // 1..10
  title: string;
  subtitle: string;
  mode:
    | 'stealth_photo'      // L1
    | 'stealth_drop'       // L2
    | 'blueprint_plan'     // L3
    | 'dual_plate_heist'   // L4
    | 'timed_raid_escape'  // L5
    | 'highway_chase'      // L6
    | 'wiretap_stealth'    // L7
    | 'harbour_run'        // L8
    | 'warehouse_war'      // L9
    | 'rooftop_chase';     // L10
  worldWidth: number;
  worldHeight: number;
  ambience: 'city_night' | 'mansion' | 'hideout' | 'bank' | 'highway' | 'warehouse' | 'harbour' | 'rooftop';
  dialogue: DialogueLine[];
  objectiveSummary: string;
  hint: string;
  timeLimit: number; // 0 if no timer
  maxSpots: number;
}

export interface LevelRuntime {
  levelId: number;
  config: LevelConfig;
  players: PlayerActor[];
  activePlayerIndex: number;
  guards: GuardActor[];
  walls: Rect[];
  zones: ZoneMarker[];
  bags: CashBag[];
  cars: TrafficCar[];
  rooftopGaps: RooftopGap[];
  bullets: Bullet[];
  particles: Particle[];
  particleCursor: number;

  // Dynamic simulation state
  elapsed: number;
  timerRemaining: number;
  spottedCount: number;
  spotCooldown: number;
  alertFlash: number;
  vaultOpen: boolean;
  phase: number; // sub-step progress inside multi-step levels
  bagsDelivered: number;
  totalBags: number;
  highwayDistance: number;
  highwayTarget: number;
  playerCarX: number;
  playerCarY: number;
  playerCarSpeed: number;
  cameraFlash: number;
  shakeTrauma: number;
  hitstopTimer: number;
  shootCooldown: number;
  shamusEscapeX: number;
  shamusEscapeY: number;
  shamusJumped: boolean;

  // Outcome
  outcome: OutcomeKind;
  outcomeReason: string;
  objectiveText: string;
  objectiveProgress: number; // 0..1
  roleAssignment: RoleAssignment;
  activeDialogueIndex: number;
  dialogueTimer: number;
}

export interface HudSnapshot {
  levelId: number;
  levelTitle: string;
  objectiveText: string;
  objectiveProgress: number;
  timerRemaining: number;
  hasTimer: boolean;
  spottedCount: number;
  maxSpots: number;
  activeCrewName: string;
  activeCrewRole: string;
  canSwitchCrew: boolean;
  carryingBag: boolean;
  bagsDelivered: number;
  totalBags: number;
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  bossMaxHp: number;
  vaultOpen: boolean;
  phase: number;
  elapsed: number;
  dialogue: DialogueLine | null;
  outcome: OutcomeKind;
  outcomeReason: string;
  highwayProgress: number;
}
