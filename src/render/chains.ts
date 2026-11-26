import { enclosedFaces, path } from '../map/graph';
import type { Agent, Face, GameState } from '../types';

/** Geometria derivada da cadeia de bandeiras de um agente, só pra desenhar. */
export interface ChainInfo {
  /** Chave das bandeiras usada pra saber se o cache ainda vale. */
  key: string;
  /** Nós do trecho já "construído" (da 1ª à última bandeira). */
  open: number[];
  /** Nós do trecho que fecharia o laço (da última de volta à 1ª). */
  close: number[];
  /** Quarteirões que seriam capturados se o laço fechasse agora. */
  fill: Face[];
}

const caches = new WeakMap<GameState, Map<number, ChainInfo>>();

/** Calcula (com cache por partida) a geometria da cadeia do agente. */
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
