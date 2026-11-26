/** Personalidades achadas por `npm run evolve` (arredondadas), pra comparar no torneio antes de adotar no jogo. */
import { CLASSIC, type Personality } from '../src/config';

/** Busca A: partindo do guloso. */
export const EVOLVED_A: Personality = {
  ...CLASSIC,
  label: 'evoluído A',
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

/** Busca B: partindo do clássico. */
export const EVOLVED_B: Personality = {
  ...CLASSIC,
  label: 'evoluído B',
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

/** Média das duas buscas: o que ambas concordam, com os parâmetros que divergiram no meio-termo. */
export const EVOLVED_MEAN: Personality = {
  ...CLASSIC,
  label: 'evoluído médio',
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

// ---- Versão anterior das personalidades do jogo (antes da busca evolutiva), guardada pra comparação ----

const OLD_SMART: Personality = { ...CLASSIC, label: 'inteligente (antigo)', planTries: 40, dodge: 0.9, leaderBias: 0.5 };

export const LEGACY_HUNTER: Personality = {
  ...OLD_SMART,
  label: 'caçador (antigo)',
  leaderBias: 1,
  huntFlagP: 0.5,
  chaseP: 0.1,
  chaseSteps: 3,
  defend: 0.3,
};
export const LEGACY_CAUTIOUS: Personality = { ...OLD_SMART, label: 'cauteloso (antigo)', loopMul: 0.85, riskWeight: 1, dodge: 0.95 };
export const LEGACY_GREEDY: Personality = { ...OLD_SMART, label: 'guloso (antigo)', loopMul: 1.3 };
