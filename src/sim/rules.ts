/** Football tuning. Distances are metres, speeds m/s, accelerations m/s². */
export const ENGINE_VERSION = 'football-0.9';
export const TICK_RATE = 60;
export const SECONDS_PER_TICK = 1 / TICK_RATE;
export const PLAYERS_PER_TEAM = 11;

export const FIELD = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  postRadius: 0.06,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  penaltySpotDistance: 11,
} as const;

export const MOVEMENT = {
  maximumSpeed: 7,
  playerRadius: 0.4,
  guardingPace: 0.8,
  acceleration: 18,
  boundaryInset: 0.4,
  arrivalDistance: 0.025,
  arrivalSpeed: 0.2,
  facingUpdateSpeed: 0.1,
} as const;

export const BALL_CONTROL = {
  radius: 0.11,
  carryingOffset: 0.65,
  receivingRadius: 0.9,
  groundDeceleration: 1.4,
  minimumKickSpeed: 2,
  maximumKickSpeed: 30,
  maximumLoftSpeed: 8,
  gravity: 9.81,
  bounceRestitution: 0.45,
  minimumBounceSpeed: 0.5,
  maximumFootControlHeight: 0.65,
  maximumFootControlSpeed: 18,
  bodyHeight: 1.8,
  bodyDeflectionRestitution: 0.55,
  frameRestitution: 0.75,
  collisionSeparation: 0.001,
  // A kicker cannot immediately capture the ball they just released.
  kickerRecaptureDelayTicks: 18,
} as const;

export const ORDER_LIFETIME = {
  persistentTicks: 3 * TICK_RATE,
  instantaneousTicks: 1,
} as const;

export const NUMERIC_TOLERANCE = {
  vectorLength: 1e-9,
  squaredVectorLength: 1e-18,
  contactTimeFraction: 1e-9,
} as const;

// An off-timeline timestamp makes unperformed kicks older than any cooldown.
export const BEFORE_MATCH_TICK = -1000;

export const MATCH_TIMING = {
  halfPlayingTicks: 60 * TICK_RATE,
  restartSetupTicks: 2 * TICK_RATE,
  restartDeliveryTicks: 6 * TICK_RATE,
  halftimeTicks: 3 * TICK_RATE,
} as const;

export const RESTART_RULES = {
  opponentDistance: 9.15,
  throwInOpponentDistance: 2,
  teammateDistance: 1.5,
  throwReleaseHeight: 1.7,
  maximumThrowSpeed: 18,
} as const;

export const KEEPER = {
  guardingReach: 1.6,
  guardingHeight: 2.4,
  handHeight: 1.2,
  maximumHoldTicks: 8 * TICK_RATE,
  countdownTicks: 5 * TICK_RATE,
  deliveries: {
    roll: { maximumSpeed: 12, maximumLoft: 0 },
    throw: { maximumSpeed: 18, maximumLoft: 6 },
    punt: { maximumSpeed: 30, maximumLoft: 8 },
  },
} as const;

export const TACKLE = {
  ballReach: 1.25,
  maximumOpponentDistance: 1.8,
  recoveryTicks: 30,
} as const;

/** Our contact model, not a numerical definition of the official Laws. */
export const REFEREE = {
  minimumPlayers: 7,
  recklessClosingSpeed: 5,
  excessiveClosingSpeed: 10,
  offsideTolerance: 0.01,
} as const;
