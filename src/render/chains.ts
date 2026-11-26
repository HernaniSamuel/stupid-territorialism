import { enclosedFaces, path } from '../map/graph';
import type { Agent, Face, GameState } from '../types';

/** Geometry derived from an agent's flag chain, only for drawing. */
export interface ChainInfo {
  /** Key of the flags, used to know whether the cache is still valid. */
  key: string;
  /** Nodes of the stretch already "built" (from the 1st to the last flag). */
  open: number[];
  /** Nodes of the stretch that would close the loop (from the last back to the 1st). */
  close: number[];
  /** Blocks that would be captured if the loop closed right now. */
  fill: Face[];
}

const caches = new WeakMap<GameState, Map<number, ChainInfo>>();

/** Computes (cached per match) the agent's chain geometry. */
export function chainInfo(state: GameState, ag: Agent): ChainInfo {
  let perAgent = caches.get(state);
  if (!perAgent) caches.set(state, (perAgent = new Map()));
  const key = ag.flags.join(',');
  const hit = perAgent.get(ag.id);
  if (hit && hit.key === key) return hit;

  const { world } = state;
  const open: number[] = [];
  for (let i = 0; i < ag.flags.length - 1; i++) {
    const p = path(world, ag.flags[i], ag.flags[i + 1]);
    open.push(...(i ? p.slice(1) : p));
  }
  const close = ag.flags.length >= 3 ? path(world, ag.flags[ag.flags.length - 1], ag.flags[0]) : [];
  const info: ChainInfo = { key, open, close, fill: enclosedFaces(world, ag.flags) };
  perAgent.set(ag.id, info);
  return info;
}
