/** Shared pieces used by the simulation scripts (`tournament` and `evolve`). */
import type { Personality } from '../src/config';
import { createGame, update } from '../src/game';
import { standings } from '../src/rules/match';
import type { PlayerCommand } from '../src/types';

// Only what we use from Node: avoids depending on @types/node.
declare const process: { env: Record<string, string | undefined> };

/** Reads an environment variable (e.g. `SEEDS=200 npm run sim`). */
export function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const DT = 1 / 30;
const IDLE: PlayerCommand = { dir: { x: 0, y: 0 }, fire: false, aim: { x: 0, y: 0 } };

export interface SeatResult {
  persona: Personality;
  /** Spawn corner (= agent id). */
  seat: number;
  /** % of the map at the end of the match. */
  pct: number;
  kills: number;
  deaths: number;
  won: boolean;
}

/** Plays a full match with bots only. `seats[i]` is the personality of agent `i` (0 to 3). */
export function playMatch(seed: number, seats: Personality[]): SeatResult[] {
  const state = createGame(seed, { human: false, personalities: seats });
  while (!state.over) {
    update(state, DT, IDLE);
    state.events.length = 0;
  }
  const table = standings(state);
  const winner = table[0].agent;
  return state.agents.map((a) => ({
    persona: seats[a.id],
    seat: a.id,
    pct: table.find((r) => r.agent === a)!.pct,
    kills: a.kills,
    deaths: a.deaths,
    won: a === winner,
  }));
}
