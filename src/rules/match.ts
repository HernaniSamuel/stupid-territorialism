/** Scoreboard and end of match. */
import { CFG } from '../config';
import type { Agent, GameState } from '../types';

export interface Standing {
  agent: Agent;
  /** % of the map's total territory. */
  pct: number;
}

/** Area dominated by each agent, indexed by id. */
export function territoryAreas(state: GameState): number[] {
  const areas = state.agents.map(() => 0);
  for (const f of state.world.faces) if (f.owner >= 0) areas[f.owner] += f.area;
  return areas;
}

/** Sorted scoreboard, from first to last. */
export function standings(state: GameState): Standing[] {
  const areas = territoryAreas(state);
  return state.agents
    .map((agent) => ({ agent, pct: (areas[agent.id] / state.world.totalArea) * 100 }))
    .sort((x, y) => y.pct - x.pct);
}

/** Who leads the scoreboard, or `null` if nobody has territory yet. */
export function leader(state: GameState): Agent | null {
  const top = standings(state)[0];
  return top.pct > 0 ? top.agent : null;
}

/** Ends the match (only once). */
export function endMatch(state: GameState): void {
  if (state.over) return;
  state.over = true;
  state.events.push({ type: 'matchEnd' });
}

/** Ends the match if someone has already passed `winPct`. */
export function checkVictory(state: GameState): void {
  if (!state.over && standings(state)[0].pct >= CFG.winPct) endMatch(state);
}
