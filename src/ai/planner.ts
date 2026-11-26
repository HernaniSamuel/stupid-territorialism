import { CFG } from '../config';
import { enclosedFaces, loopLength, nearestNode, shortestPaths } from '../map/graph';
import { leader } from '../rules/match';
import type { Agent, GameState } from '../types';

/** Janela (em px) em volta do bot onde sorteamos o centro de cada laço candidato. */
const SEARCH_W = 600;
const SEARCH_H = 450;
/** Raio do laço candidato: entre MIN e MIN+SPAN. */
const RADIUS_MIN = 70;
const RADIUS_SPAN = 120;

/** Um inimigo a menos que isso (px) de uma bandeira do laço começa a pesar como risco. */
const RISK_RADIUS = 300;
/** Quanto custa (em px de perímetro equivalente) ter um inimigo colado numa bandeira. */
const RISK_COST = 300;

/**
 * Risco de um laço: soma, por par (inimigo vivo, bandeira), de quão perto o inimigo está.
 * Chegar a uma bandeira destrói a cadeia inteira, então laços com adversários por perto valem menos.
 */
function loopRisk(state: GameState, bot: Agent, flags: number[]): number {
  let risk = 0;
  for (const o of state.agents) {
    if (o === bot || !o.alive) continue;
    for (const f of flags) {
      const n = state.world.nodes[f];
      risk += Math.max(0, 1 - Math.hypot(o.x - n.x, o.y - n.y) / RISK_RADIUS) * RISK_COST;
    }
  }
  return risk;
}

/**
 * Planeja uma conquista: sorteia `persona.planTries` laços de 3 a 5 bandeiras
 * perto do bot e fica com o de melhor `ganho / (perímetro + distância·0,6 + 200 + risco)`.
 *
 * @param node nó em que o bot está agora
 * @returns bandeiras a fincar, já começando pela mais próxima e terminando de
 *   novo nela (pra fechar o laço); ou `null` se nada rendeu ganho.
 */
export function planClaim(state: GameState, bot: Agent, node: number): number[] | null {
  const { world, rng } = state;
  const persona = bot.persona;
  const maxLoop = CFG.botMaxLoop * persona.loopMul;
  const lead = leader(state);
  let best: number[] | null = null;
  let bestScore = -1;

  for (let t = 0; t < persona.planTries; t++) {
    const c = world.nodes[nearestNode(world, bot.x + (rng() - 0.5) * SEARCH_W, bot.y + (rng() - 0.5) * SEARCH_H)];
    const k = 3 + ((rng() * 3) | 0);
    const R = RADIUS_MIN + rng() * RADIUS_SPAN;
    const a0 = rng() * 6.283;
    const pts = new Set<number>();
    for (let i = 0; i < k; i++) {
      const ang = a0 + (i * 6.283) / k + (rng() - 0.5) * 0.5;
      pts.add(nearestNode(world, c.x + Math.cos(ang) * R, c.y + Math.sin(ang) * R));
    }
    const flags = [...pts];
    if (flags.length < 3) continue;

    const len = loopLength(world, flags);
    if (len > maxLoop) continue;

    let gain = 0;
    for (const f of enclosedFaces(world, flags)) {
      if (f.owner === bot.id) continue;
      // Roubar vale mais que tomar terra livre; do líder, mais ainda.
      const steal = f.owner < 0 ? 1 : persona.stealBonus * (f.owner === lead?.id ? 1 + persona.leaderBias * 0.5 : 1);
      gain += f.area * steal;
    }
    if (gain <= 0) continue;

    const dist = Math.hypot(world.nodes[flags[0]].x - world.nodes[node].x, world.nodes[flags[0]].y - world.nodes[node].y);
    const score = gain / (len + dist * 0.6 + 200 + persona.riskWeight * loopRisk(state, bot, flags));
    if (score > bestScore) {
      bestScore = score;
      best = flags;
    }
  }
  if (!best) return null;

  // Começa pela bandeira mais próxima de quem vai fincar.
  const chosen = best;
  const fromHere = shortestPaths(world, node).dist;
  let start = 0;
  let startDist = 1e12;
  chosen.forEach((n, i) => {
    if (fromHere[n] < startDist) {
      startDist = fromHere[n];
      start = i;
    }
  });
  const rotated = chosen.slice(start).concat(chosen.slice(0, start));
  return rotated.concat([rotated[0]]);
}
