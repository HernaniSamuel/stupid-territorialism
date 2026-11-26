/** Peças compartilhadas pelos scripts de simulação (`tournament` e `evolve`). */
import type { Personality } from '../src/config';
import { createGame, update } from '../src/game';
import { standings } from '../src/rules/match';
import type { PlayerCommand } from '../src/types';

// Só o que usamos do Node: evita depender de @types/node.
declare const process: { env: Record<string, string | undefined> };

/** Lê uma variável de ambiente (ex.: `SEEDS=200 npm run sim`). */
export function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const DT = 1 / 30;
const IDLE: PlayerCommand = { dir: { x: 0, y: 0 }, fire: false, aim: { x: 0, y: 0 } };

export interface SeatResult {
  persona: Personality;
  /** Canto de nascimento (= id do agente). */
  seat: number;
  /** % do mapa no fim da partida. */
  pct: number;
  kills: number;
  deaths: number;
  won: boolean;
}

/** Joga uma partida inteira só de bots. `seats[i]` é a personalidade do agente `i` (0 a 3). */
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
