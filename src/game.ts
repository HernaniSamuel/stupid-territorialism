/**
 * Orchestrates the simulation: creates a match and advances one frame at a time.
 * Does not depend on DOM, canvas or audio, so it runs the same in the browser and in the tests.
 */
import { botCombat } from './ai/combat';
import { botPick } from './ai/bot';
import { BOT_LINEUP, CFG, CLASSIC, type Personality } from './config';
import { createRng } from './core/rng';
import { advance, makeAgent, onOwnTurf, place } from './entities/agent';
import { shoot } from './entities/bullets';
import { pickPlayerEdge, steerPlayer } from './entities/player';
import { proceduralSource } from './map/procedural';
import type { MapSource } from './map/source';
import { buildWorld } from './map/world';
import { stepBullets } from './rules/combat';
import { checkVictory, endMatch } from './rules/match';
import { destroyChain, respawn } from './rules/territory';
import type { GameState, PlayerCommand } from './types';

export interface GameOptions {
  /** Where the map comes from (default: procedural). */
  source?: MapSource;
  /** `false` makes agent 0 a bot too (used in tournament simulations). Default: `true`. */
  human?: boolean;
  /** Personality of each agent, by id. Default: `CFG.botBrain` decides. */
  personalities?: Personality[];
}

/** Personalities of agents 0..botCount according to `CFG.botBrain`. Index 0 (human) is ignored. */
function defaultPersonalities(): Personality[] {
  const bots = CFG.botBrain === 'smart' ? BOT_LINEUP : [];
  return [CLASSIC, ...Array.from({ length: CFG.botCount }, (_, i) => bots[i] ?? CLASSIC)];
}

/** Creates a new match. The same seed and the same options generate the same map and the same decisions. */
export function createGame(seed: number, options: GameOptions = {}): GameState {
  const { source = proceduralSource, human = true } = options;
  const personas = options.personalities ?? defaultPersonalities();
  const rng = createRng(seed);
  const world = buildWorld(source.build(rng), rng);
  const agents = [];
  for (let i = 0; i <= CFG.botCount; i++) agents.push(makeAgent(world, i, i === 0 && human, personas[i] ?? CLASSIC));
  agents.forEach((a) => place(world, a));
  return {
    seed,
    rng,
    world,
    agents,
    player: agents[0],
    bullets: [],
    particles: [],
    timeLeft: CFG.round,
    over: false,
    events: [],
  };
}

/** Advances the simulation by `dt` seconds. `cmd` is what the human player is asking for. */
export function update(state: GameState, dt: number, cmd: PlayerCommand): void {
  const { world, agents } = state;

  // Visual effects keep going even after the match ends.
  for (const f of world.faces) if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 1.2);
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.over) return;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endMatch(state);
    return;
  }

  for (const ag of agents) {
    if (!ag.alive) {
      ag.respawnT -= dt;
      if (ag.respawnT <= 0) respawn(state, ag);
      continue;
    }
    ag.cd = Math.max(0, ag.cd - dt);
    ag.invT = Math.max(0, ag.invT - dt);
    const px = ag.x;
    const py = ag.y;
    const speedMul = onOwnTurf(world, ag) ? CFG.ownBonus : 1;

    if (ag.human) {
      steerPlayer(world, ag, cmd.dir);
      advance(world, ag, CFG.speed * speedMul * dt, (n) => pickPlayerEdge(world, n, cmd.dir));
      if (cmd.fire) shoot(state, ag, cmd.aim.x, cmd.aim.y);
    } else {
      advance(world, ag, CFG.botSpeed * speedMul * dt, (n) => botPick(state, ag, n));
      botCombat(state, ag);
    }

    place(world, ag);
    if (ag.mv !== 0) ag.face = ag.mv;
    ag.vx += ((ag.x - px) / dt - ag.vx) * Math.min(1, dt * 10);
    ag.vy += ((ag.y - py) / dt - ag.vy) * Math.min(1, dt * 10);
    if (ag.mv !== 0) {
      const A = world.nodes[ag.a];
      const B = world.nodes[ag.b];
      const target = Math.atan2((B.y - A.y) * ag.mv, (B.x - A.x) * ag.mv);
      let diff = target - ag.ang;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      ag.ang += diff * Math.min(1, dt * 14);
    }
  }

  // Touching an enemy flag destroys the owner's entire chain.
  for (const ag of agents) {
    if (!ag.alive) continue;
    for (const owner of agents) {
      if (owner === ag || !owner.flags.length) continue;
      for (const flagNode of owner.flags) {
        const n = world.nodes[flagNode];
        if (Math.hypot(n.x - ag.x, n.y - ag.y) < CFG.flagR) {
          destroyChain(state, owner, ag);
          break;
        }
      }
    }
  }

  stepBullets(state, dt);
  checkVictory(state);
}
