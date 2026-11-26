/**
 * Bot brain. Every time a bot reaches an intersection, `botPick` decides the
 * next street, in three layers:
 *
 *  1. **Reaction** — has an enemy come close to my flags? I drop the plan and go
 *     intercept it (`persona.defend`).
 *  2. **Deliberation** — with no route, decides what to do: follow the plan, hunt a flag,
 *     chase, or plan a new conquest (`botThink`).
 *  3. **Dodge** — is the chosen street in someone's line of fire? Take a side street
 *     (`persona.dodge`).
 *
 * Each bot's state is `plan` (flags to plant) and `route` (nodes to the immediate destination).
 * The "how much" of each behavior comes from the personality (`bot.persona`).
 */
import { CFG } from '../config';
import { nearestNode, path, shortestPaths } from '../map/graph';
import { leader } from '../rules/match';
import { plant } from '../rules/territory';
import type { Agent, GameState } from '../types';
import { chainThreat, edgeExposed, incomingFire } from './perception';
import { planClaim } from './planner';

/** Not worth intercepting someone more than this far (street distance) from me. */
const MAX_INTERCEPT_DIST = 500;

/** Reached the next point of the plan? Then plant the flag (the last one in the plan closes the loop). */
function botArrive(state: GameState, bot: Agent, node: number): void {
  if (bot.plan.length && bot.plan[0] === node) {
    plant(state, bot, node);
    bot.plan.shift();
    bot.route = [];
    if (!bot.plan.length) bot.flags = [];
  }
}

/** Layer 1: if an enemy threatens my flags, the route becomes "go to them". */
function reactToThreat(state: GameState, bot: Agent, node: number): void {
  const p = bot.persona;
  if (p.defend <= 0) return;
  const threat = chainThreat(state, bot);
  if (!threat || state.rng() >= p.defend) return;
  const { world } = state;
  const target = nearestNode(world, threat.x, threat.y);
  if (shortestPaths(world, node).dist[target] > MAX_INTERCEPT_DIST) return;
  bot.route = path(world, node, target).slice(1, 1 + CFG.botInterceptSteps);
}

/** Layer 2: decides what to do next when there is no route. */
function botThink(state: GameState, bot: Agent, node: number): void {
  const { world, rng, agents } = state;
  const persona = bot.persona;
  if (bot.plan.length) {
    bot.route = path(world, node, bot.plan[0]).slice(1);
    return;
  }

  const r = rng();
  const foes = agents.filter((o) => o !== bot && o.alive);
  // The leader is a preferred target: the "distance" to them is divided by (1 + leaderBias).
  const lead = leader(state);
  const appeal = (o: Agent) => (o === lead ? 1 + persona.leaderBias : 1);

  if (r < persona.huntFlagP) {
    // Go to the nearest enemy flag (by street) and destroy the chain.
    let target = -1;
    let bestScore = 1e12;
    const dist = shortestPaths(world, node).dist;
    for (const o of foes) {
      for (const flagNode of o.flags) {
        const d = dist[flagNode];
        if (d >= CFG.botFlagRange) continue;
        if (d / appeal(o) < bestScore) {
          bestScore = d / appeal(o);
          target = flagNode;
        }
      }
    }
    if (target >= 0) {
      bot.route = path(world, node, target).slice(1);
      return;
    }
  }

  if (r < persona.huntFlagP + persona.chaseP && foes.length) {
    // Chase the nearest enemy, only the first steps of the route (then reassess).
    let target: Agent | null = null;
    let bestScore = 1e12;
    for (const o of foes) {
      const d = Math.hypot(o.x - bot.x, o.y - bot.y) / appeal(o);
      if (d < bestScore) {
        bestScore = d;
        target = o;
      }
    }
    if (target) {
      bot.route = path(world, node, nearestNode(world, target.x, target.y)).slice(1, 1 + persona.chaseSteps);
      if (bot.route.length) return;
    }
  }

  const plan = planClaim(state, bot, node);
  if (plan) {
    bot.plan = plan;
    bot.route = path(world, node, plan[0]).slice(1);
  }
}

/**
 * Layer 3: if the chosen street runs through someone's line of fire and there is an exit
 * outside of it, swap it for the exit that gets closest to the destination. The route is discarded,
 * so at the next intersection the bot replans from wherever it is.
 */
function dodge(state: GameState, bot: Agent, node: number, intended: number, goal: number): number {
  const { world, rng } = state;
  const lines = incomingFire(state, bot);
  if (!lines.length || !edgeExposed(world, node, intended, lines)) return intended;

  let best = -1;
  let bestCost = 1e12;
  for (const e of world.adj[node]) {
    if (e.to === intended || edgeExposed(world, node, e.to, lines)) continue;
    const cost = goal >= 0 ? e.len + shortestPaths(world, e.to).dist[goal] : rng() * 100;
    if (cost < bestCost) {
      bestCost = cost;
      best = e.to;
    }
  }
  if (best < 0) return intended;
  bot.route = [];
  return best;
}

/** Picks the bot's next street at intersection `node` (this is its `PickFn`). */
export function botPick(state: GameState, bot: Agent, node: number): number {
  const { world, rng } = state;
  botArrive(state, bot, node);
  reactToThreat(state, bot, node);
  if (!bot.route.length) {
    botThink(state, bot, node);
    botArrive(state, bot, node);
    if (!bot.route.length && bot.plan.length) bot.route = path(world, node, bot.plan[0]).slice(1);
  }

  const goal = bot.route.length ? bot.route[bot.route.length - 1] : bot.plan.length ? bot.plan[0] : -1;
  while (bot.route.length && bot.route[0] === node) bot.route.shift();
  const next = bot.route.shift();
  // No route at all: turn onto any street, so it never stands still.
  const chosen = next === undefined ? world.adj[node][(rng() * world.adj[node].length) | 0].to : next;

  return bot.persona.dodge > 0 && rng() < bot.persona.dodge ? dodge(state, bot, node, chosen, goal) : chosen;
}
