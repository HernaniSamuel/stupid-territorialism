/**
 * Regras do jogo: bandeiras, laços, destruição de cadeias, morte e renascimento.
 * Nada aqui desenha, toca som ou escreve na tela: tudo que a UI precisa saber
 * sai como evento em `state.events`.
 */
import { CFG } from '../config';
import { enclosedFaces } from '../map/graph';
import { place } from '../entities/agent';
import type { Agent, GameState } from '../types';

/**
 * Finca uma bandeira de `ag` no nó. Com 3 ou mais bandeiras, fincar na primeira fecha o laço.
 * @returns se algo mudou (bandeira fincada ou laço fechado).
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

/** Fecha o laço de bandeiras: os quarteirões cercados passam a ser do agente. */
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

/** `by` encostou numa bandeira de `owner`: a cadeia inteira dele é perdida. */
export function destroyChain(state: GameState, owner: Agent, by: Agent): void {
  if (!owner.flags.length) return;
  owner.flags = [];
  owner.plan = [];
  owner.route = [];
  state.events.push({ type: 'chainDestroyed', owner, by });
}

/** `killer` derruba `victim`: ele perde as bandeiras e fica fora até renascer. */
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

/** Renasce num nó do próprio território (ou na base, se não tiver nenhum). */
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
