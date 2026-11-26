/**
 * Game parameters. Feel free to tweak them to test the "fun".
 * Units: distances in world pixels, times in seconds, speeds in px/s.
 */

/** 'street': the shot goes forward following the street. 'free': straight line in the direction of the mouse. */
export type ShotMode = 'street' | 'free';

export interface Config {
  // --- procedural map --------------------------------------------------------
  /** Columns of the intersection grid. */
  cols: number;
  /** Rows of the intersection grid. */
  rows: number;
  /** Average distance between neighboring intersections. */
  sp: number;
  /** How much each inner intersection is displaced (fraction of `sp`). */
  jit: number;
  /** Chance of keeping each street of the grid (removed ones only come back if they isolate the map). */
  keepEdge: number;
  /** Chance of each block getting a diagonal street. */
  diag: number;
  /** Chance of a block being a park (only changes the color). */
  parkP: number;
  /** Blocks smaller than this (in px²) are ignored. Depends on the map scale. */
  minFaceArea: number;

  // --- movement --------------------------------------------------------------
  /** Player speed. */
  speed: number;
  /** Bot speed. */
  botSpeed: number;
  /** Speed multiplier when walking on your own territory. */
  ownBonus: number;

  // --- match -----------------------------------------------------------------
  /** Maximum number of flags in each player's chain. */
  maxFlags: number;
  /** Number of bots (maximum 3: there are 4 spawn corners). */
  botCount: number;
  /** Match duration. */
  round: number;
  /** Percentage of the map that ends the match with an early victory. */
  winPct: number;
  /** Maximum distance from an intersection to be able to plant a flag. */
  plantReach: number;

  // --- shooting --------------------------------------------------------------
  shotMode: ShotMode;
  /** (free) projectile speed. */
  bulletSpeed: number;
  /** (free) projectile range. */
  bulletRange: number;
  /** Player reload. */
  shotCd: number;
  /** Bot reload. */
  botShotCd: number;
  /** (free) bots' aiming error, in radians. */
  botAimErr: number;
  /** (free) maximum distance at which a bot can see targets. */
  botSight: number;
  /** (street) shot range along the street. */
  streetRange: number;
  /** (street) projectile speed. */
  streetBulletSpeed: number;
  /** (street) maximum turn, in degrees, the shot accepts when passing an intersection. */
  streetMaxTurn: number;

  // --- combat and rules ------------------------------------------------------
  /** Hit radius of a shot on an agent. */
  hitR: number;
  /** Radius within which touching an enemy flag destroys its chain. */
  flagR: number;
  /** Dead time until respawning. */
  respawn: number;
  /** Invulnerability after respawning. */
  invuln: number;

  // --- bots ------------------------------------------------------------------
  /** 'smart': each bot has a personality and reacts to the game. 'classic': all identical, no reaction (old behavior). */
  botBrain: 'smart' | 'classic';
  /** Maximum perimeter (in px) of a loop planned by a bot (multiplied by the personality's `loopMul`). */
  botMaxLoop: number;
  /** Only considers enemy flags within this street distance. */
  botFlagRange: number;
  /** An enemy closer than this (px) to a bot's planted flag triggers the defense. */
  botDefendRange: number;
  /** How many route steps a bot takes each time it goes to intercept an enemy. */
  botInterceptSteps: number;
}

/**
 * A bot's way of playing. All fields are "how much", so you can create
 * variations by mixing values. `CLASSIC` reproduces the original behavior.
 */
export interface Personality {
  label: string;
  /** Multiplies `botMaxLoop`: bigger loops pay more, but leave flags exposed for longer. */
  loopMul: number;
  /** How many random loops it evaluates when planning a conquest. */
  planTries: number;
  /** How much it penalizes loops with enemies near the flags (0 = ignores risk). */
  riskWeight: number;
  /** Gain multiplier for blocks already owned by someone else (1 = no preference for stealing). */
  stealBonus: number;
  /** Extra attention to the scoreboard leader when stealing, hunting flags and chasing (0 = ignores the leader). */
  leaderBias: number;
  /** Chance, when deciding, of going after an enemy flag. */
  huntFlagP: number;
  /** Chance, when deciding, of chasing an enemy (added to the one above). */
  chaseP: number;
  /** How many steps of the chase route it follows before reassessing. */
  chaseSteps: number;
  /** 0..1: chance of dodging when the street it was going to take is in someone's line of fire. */
  dodge: number;
  /** 0..1: chance of dropping the plan and going after an enemy who came close to its flags. */
  defend: number;
}

export const CFG: Config = {
  cols: 13,
  rows: 9,
  sp: 96,
  jit: 0.2,
  keepEdge: 0.9,
  diag: 0.14,
  parkP: 0.12,
  minFaceArea: 150,

  speed: 150,
  botSpeed: 132,
  ownBonus: 1.2,

  maxFlags: 6,
  botCount: 3,
  round: 240,
  winPct: 50,
  plantReach: 30,

  shotMode: 'street',
  bulletSpeed: 700,
  bulletRange: 330,
  shotCd: 0.45,
  botShotCd: 1.0,
  botAimErr: 0.14,
  botSight: 250,
  streetRange: 300,
  streetBulletSpeed: 420,
  streetMaxTurn: 35,

  hitR: 12,
  flagR: 14,
  respawn: 3,
  invuln: 1.6,

  botBrain: 'smart',
  botMaxLoop: 950,
  botFlagRange: 700,
  botDefendRange: 120,
  botInterceptSteps: 2,
};

/** The original bot behavior: no reaction, no risk, all identical. */
export const CLASSIC: Personality = {
  label: 'classic',
  loopMul: 1,
  planTries: 14,
  riskWeight: 0,
  stealBonus: 1.3,
  leaderBias: 0,
  huntFlagP: 0.35,
  chaseP: 0.15,
  chaseSteps: 2,
  dodge: 0,
  defend: 0,
};

/**
 * Base for 'smart' bots: the average of two evolutionary searches (`npm run evolve`) that started from very different points
 * (the greedy one and the classic one) and reached similar regions. In unseen matches it wins ~83% against the classic and ~60%
 * against the previous version of the best bot. What converged: planning with ~50 attempts, giving a lot of weight to risk,
 * preferring to steal, moderate loops and little flag hunting. Details in docs/BOTS.md.
 */
const SMART: Personality = {
  ...CLASSIC,
  label: 'smart',
  loopMul: 1.2,
  planTries: 50,
  riskWeight: 2.1,
  stealBonus: 1.5,
  leaderBias: 0.5,
  huntFlagP: 0.1,
  chaseP: 0.1,
  chaseSteps: 1,
  dodge: 0.6,
  defend: 0.3,
};

/** Goes after flags and whoever is leading, chases lightly and defends its own flags from anyone approaching. */
export const HUNTER: Personality = {
  ...SMART,
  label: 'hunter',
  leaderBias: 1,
  huntFlagP: 0.25,
  chaseP: 0.12,
  chaseSteps: 2,
  defend: 0.45,
};

/** Smaller loops, far from enemies, and almost always dodges shots. */
export const CAUTIOUS: Personality = {
  ...SMART,
  label: 'cautious',
  loopMul: 1.05,
  riskWeight: 2.8,
  dodge: 0.9,
};

/** Large loops: goes for a lot of territory at once. */
export const GREEDY: Personality = {
  ...SMART,
  label: 'greedy',
  loopMul: 1.35,
  stealBonus: 1.6,
};

/** Personality of each bot when `CFG.botBrain` is 'smart', in the order of ids 1, 2, 3. */
export const BOT_LINEUP: Personality[] = [HUNTER, CAUTIOUS, GREEDY];

/** Teams, in agent id order: 0 is the human player. */
export const TEAMS = [
  { name: 'You', color: '#1a73e8' },
  { name: 'Red', color: '#ea4335' },
  { name: 'Purple', color: '#9334e6' },
  { name: 'Orange', color: '#f29900' },
] as const;
