/**
 * Cérebro dos bots. Toda vez que um bot chega a um cruzamento, `botPick` decide a
 * próxima rua, em três camadas:
 *
 *  1. **Reação** — um inimigo chegou perto das minhas bandeiras? Largo o plano e vou
 *     interceptá-lo (`persona.defend`).
 *  2. **Deliberação** — sem rota, decide o que fazer: seguir o plano, caçar bandeira,
 *     perseguir ou planejar uma conquista (`botThink`).
 *  3. **Desvio** — a rua escolhida está na linha de fogo de alguém? Pega uma lateral
 *     (`persona.dodge`).
 *
 * O estado de cada bot é `plan` (bandeiras a fincar) e `route` (nós até o destino imediato).
 * Os "quanto" de cada comportamento vêm da personalidade (`bot.persona`).
 */
import { CFG } from '../config';
import { nearestNode, path, shortestPaths } from '../map/graph';
import { leader } from '../rules/match';
import { plant } from '../rules/territory';
import type { Agent, GameState } from '../types';
import { chainThreat, edgeExposed, incomingFire } from './perception';
import { planClaim } from './planner';

/** Não vale interceptar quem está a mais que isso (distância de rua) de mim. */
const MAX_INTERCEPT_DIST = 500;

/** Chegou ao próximo ponto do plano? Então finca a bandeira (a última do plano fecha o laço). */
function botArrive(state: GameState, bot: Agent, node: number): void {
  if (bot.plan.length && bot.plan[0] === node) {
    plant(state, bot, node);
    bot.plan.shift();
    bot.route = [];
    if (!bot.plan.length) bot.flags = [];
  }
}

/** Camada 1: se um inimigo ameaça minhas bandeiras, a rota vira "ir até ele". */
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

/** Camada 2: define o que fazer a seguir quando não há rota. */
function botThink(state: GameState, bot: Agent, node: number): void {
  const { world, rng, agents } = state;
  const persona = bot.persona;
  if (bot.plan.length) {
    bot.route = path(world, node, bot.plan[0]).slice(1);
    return;
  }

  const r = rng();
  const foes = agents.filter((o) => o !== bot && o.alive);
  // Quem lidera é alvo preferido: a "distância" até ele é dividida por (1 + leaderBias).
  const lead = leader(state);
  const appeal = (o: Agent) => (o === lead ? 1 + persona.leaderBias : 1);

  if (r < persona.huntFlagP) {
    // Ir até a bandeira inimiga mais próxima (por rua) e destruir a cadeia.
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
    // Perseguir o inimigo mais próximo, só os primeiros passos da rota (depois reavalia).
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
 * Camada 3: se a rua escolhida passa pela linha de fogo de alguém e existe uma saída
 * fora dela, troca pela saída que deixa mais perto do destino. A rota é descartada,
 * então no próximo cruzamento o bot replaneja a partir de onde estiver.
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

/** Escolhe a próxima rua do bot no cruzamento `node` (é o `PickFn` dele). */
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
  // Sem rota nenhuma: vira numa rua qualquer, pra nunca ficar parado.
  const chosen = next === undefined ? world.adj[node][(rng() * world.adj[node].length) | 0].to : next;

  return bot.persona.dodge > 0 && rng() < bot.persona.dodge ? dodge(state, bot, node, chosen, goal) : chosen;
}
