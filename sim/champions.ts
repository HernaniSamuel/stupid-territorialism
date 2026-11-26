/** Personalities found by `npm run evolve` (rounded), to compare in the tournament before adopting them in the game. */
import { CLASSIC, type Personality } from '../src/config';

/** Search A: starting from greedy. */
export const EVOLVED_A: Personality = {
  ...CLASSIC,
  label: 'evolved A',
  loopMul: 1.14,
  planTries: 53,
  riskWeight: 1.9,
  stealBonus: 1.59,
  leaderBias: 0.72,
  huntFlagP: 0.11,
  chaseP: 0.12,
  chaseSteps: 1,
  dodge: 0.79,
  defend: 0.49,
};

/** Search B: starting from classic. */
export const EVOLVED_B: Personality = {
  ...CLASSIC,
  label: 'evolved B',
  loopMul: 1.31,
  planTries: 48,
  riskWeight: 2.33,
  stealBonus: 1.41,
  leaderBias: 0.31,
  huntFlagP: 0.1,
  chaseP: 0.09,
  chaseSteps: 2,
  dodge: 0.37,
  defend: 0.12,
};

/** Average of the two searches: what both agree on, with the parameters that diverged taken at the midpoint. */
export const EVOLVED_MEAN: Personality = {
  ...CLASSIC,
  label: 'evolved mean',
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

// ---- Previous version of the game's personalities (before evolutionary search), kept for comparison ----

const OLD_SMART: Personality = { ...CLASSIC, label: 'smart (old)', planTries: 40, dodge: 0.9, leaderBias: 0.5 };

export const LEGACY_HUNTER: Personality = {
  ...OLD_SMART,
  label: 'hunter (old)',
  leaderBias: 1,
  huntFlagP: 0.5,
  chaseP: 0.1,
  chaseSteps: 3,
  defend: 0.3,
};
export const LEGACY_CAUTIOUS: Personality = { ...OLD_SMART, label: 'cautious (old)', loopMul: 0.85, riskWeight: 1, dodge: 0.95 };
export const LEGACY_GREEDY: Personality = { ...OLD_SMART, label: 'greedy (old)', loopMul: 1.3 };
