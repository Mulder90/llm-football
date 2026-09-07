/** Football tuning. Distances are metres, speeds m/s, accelerations m/s². */
export const ENGINE_VERSION = 'football-0.1';
export const TICK_RATE = 60;
export const SECONDS_PER_TICK = 1 / TICK_RATE;
export const PLAYERS_PER_TEAM = 11;

export const FIELD = {
  length: 105,
  width: 68,
} as const;

export const MOVEMENT = {
  maximumSpeed: 7,
  acceleration: 18,
  boundaryInset: 0.4,
  arrivalDistance: 0.025,
  arrivalSpeed: 0.2,
  facingUpdateSpeed: 0.1,
} as const;

export const BALL_CONTROL = {
  radius: 0.11,
  carryingOffset: 0.65,
  kickReleaseOffset: 0.8,
  receivingRadius: 0.9,
  groundDeceleration: 1.4,
  minimumKickSpeed: 2,
  maximumKickSpeed: 30,
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
