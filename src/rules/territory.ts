/**
 * Game rules: flags, loops, chain destruction, death and respawn.
 * Nothing here draws, plays sound or writes to the screen: everything the UI needs to know
 * comes out as an event in `state.events`.
 */
import { CFG } from '../config';
import { enclosedFaces } from '../map/graph';
import { place } from '../entities/agent';
import type { Agent, GameState } from '../types';

/**
 * Plants a flag of `ag` on the node. With 3 or more flags, planting on the first one closes the loop.
 * @returns whether something changed (flag planted or loop closed).
 */
export function plant(state: GameState, ag: Agent, node: number): boolean {
  if (!ag.alive) return false;
  const f = ag.flags;
  if (f.length >= 3 && node === f[0]) {
    closeLoop(state, ag);
    return true;
  }
  if (f.includes(node)) {
    state.events.push({ type: 'plantRejected', agent: ag, reason: 'duplicate' });
    return false;
  }
  if (f.length >= CFG.maxFlags) {
    state.events.push({ type: 'plantRejected', agent: ag, reason: 'maxFlags' });
    return false;
  }
  f.push(node);
  state.events.push({ type: 'plant', agent: ag });
  if (f.length === 3) state.events.push({ type: 'loopReady', agent: ag });
  return true;
}

/** Closes the flag loop: the enclosed blocks become the agent's. */
export function closeLoop(state: GameState, ag: Agent): void {
  const { world } = state;
  let gain = 0;
  for (const face of enclosedFaces(world, ag.flags)) {
    if (face.owner !== ag.id) {
      gain += face.area;
      face.owner = ag.id;
      face.flash = 1;
    }
  }
  ag.flags = [];
  if (gain > 0) state.events.push({ type: 'claim', agent: ag, pct: (gain / world.totalArea) * 100 });
  else state.events.push({ type: 'claimEmpty', agent: ag });
}

/** `by` touched a flag of `owner`: the owner's entire chain is lost. */
export function destroyChain(state: GameState, owner: Agent, by: Agent): void {
  if (!owner.flags.length) return;
  owner.flags = [];
  owner.plan = [];
  owner.route = [];
  state.events.push({ type: 'chainDestroyed', owner, by });
}

/** `killer` takes down `victim`: they lose their flags and stay out until they respawn. */
export function kill(state: GameState, victim: Agent, killer: Agent): void {
  if (!victim.alive) return;
  victim.alive = false;
  victim.respawnT = CFG.respawn;
  victim.flags = [];
  victim.plan = [];
  victim.route = [];
  victim.deaths++;
  killer.kills++;
  const { rng } = state;
  for (let i = 0; i < 16; i++) {
    const ang = rng() * 6.283;
    const speed = 40 + rng() * 140;
    state.particles.push({
      x: victim.x,
      y: victim.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0.6 + rng() * 0.4,
      color: victim.color,
    });
  }
  state.events.push({ type: 'kill', victim, killer });
}

/** Respawns on a node of the agent's own territory (or at the base, if it has none). */
export function respawn(state: GameState, ag: Agent): void {
  const { world, rng } = state;
  const candidates: number[] = [];
  for (const f of world.faces) if (f.owner === ag.id) for (const n of f.loop) candidates.push(n);
  const n = candidates.length ? candidates[(rng() * candidates.length) | 0] : ag.base;
  ag.a = n;
  ag.b = world.adj[n][0].to;
  ag.d = 0;
  ag.mv = 0;
  ag.alive = true;
  ag.invT = CFG.invuln;
  ag.cd = 0.4;
  place(world, ag);
}
