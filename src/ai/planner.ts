import { CFG } from '../config';
import { enclosedFaces, loopLength, nearestNode, shortestPaths } from '../map/graph';
import { leader } from '../rules/match';
import type { Agent, GameState } from '../types';

/** Window (in px) around the bot where we draw the center of each candidate loop. */
const SEARCH_W = 600;
const SEARCH_H = 450;
/** Radius of the candidate loop: between MIN and MIN+SPAN. */
const RADIUS_MIN = 70;
const RADIUS_SPAN = 120;

/** An enemy closer than this (px) to a flag of the loop starts to weigh as risk. */
const RISK_RADIUS = 300;
/** How much (in px of equivalent perimeter) having an enemy stuck to a flag costs. */
const RISK_COST = 300;

/**
 * Risk of a loop: sums, for each pair (living enemy, flag), how close the enemy is.
 * Reaching a flag destroys the entire chain, so loops with opponents nearby are worth less.
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
 * Plans a conquest: draws `persona.planTries` loops of 3 to 5 flags
 * near the bot and keeps the one with the best `gain / (perimeter + distance·0.6 + 200 + risk)`.
 *
 * @param node the node the bot is at right now
 * @returns flags to plant, starting from the nearest one and ending back
 *   at it (to close the loop); or `null` if nothing yielded a gain.
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
      // Stealing is worth more than taking free land; from the leader, even more.
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

  // Start from the flag closest to whoever is going to plant it.
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
