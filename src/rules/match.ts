/** Placar e fim de partida. */
import { CFG } from '../config';
import type { Agent, GameState } from '../types';

export interface Standing {
  agent: Agent;
  /** % do território total do mapa. */
  pct: number;
}

/** Área dominada por cada agente, indexada pelo id. */
export function territoryAreas(state: GameState): number[] {
  const areas = state.agents.map(() => 0);
  for (const f of state.world.faces) if (f.owner >= 0) areas[f.owner] += f.area;
  return areas;
}

/** Placar ordenado, do primeiro ao último. */
export function standings(state: GameState): Standing[] {
  const areas = territoryAreas(state);
  return state.agents
    .map((agent) => ({ agent, pct: (areas[agent.id] / state.world.totalArea) * 100 }))
    .sort((x, y) => y.pct - x.pct);
}

/** Quem lidera o placar, ou `null` se ninguém tem território ainda. */
export function leader(state: GameState): Agent | null {
  const top = standings(state)[0];
  return top.pct > 0 ? top.agent : null;
}

/** Encerra a partida (uma vez só). */
export function endMatch(state: GameState): void {
  if (state.over) return;
  state.over = true;
  state.events.push({ type: 'matchEnd' });
}

/** Encerra a partida se alguém já passou de `winPct`. */
export function checkVictory(state: GameState): void {
  if (!state.over && standings(state)[0].pct >= CFG.winPct) endMatch(state);
}
