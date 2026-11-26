import { afterEach, describe, expect, it } from 'vitest';
import { CAUTIOUS, CFG, CLASSIC, GREEDY, HUNTER } from '../src/config';
import { edgeLength } from '../src/map/graph';
import { createGame, update } from '../src/game';
import { standings } from '../src/rules/match';
import type { GameState, PlayerCommand } from '../src/types';

const IDLE: PlayerCommand = { dir: { x: 0, y: 0 }, fire: false, aim: { x: 0, y: 0 } };
const DT = 1 / 30;

function run(state: GameState, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    update(state, DT, IDLE);
    state.events.length = 0; // nobody is consuming the events
  }
}

function checkInvariants(state: GameState): void {
  const { world, agents } = state;
  for (const f of world.faces) {
    expect(f.owner).toBeGreaterThanOrEqual(-1);
    expect(f.owner).toBeLessThan(agents.length);
  }
  for (const ag of agents) {
    expect(Number.isFinite(ag.x) && Number.isFinite(ag.y)).toBe(true);
    const len = edgeLength(world, ag.a, ag.b);
    expect(len).toBeGreaterThan(0); // always on a street that exists
    expect(ag.d).toBeGreaterThanOrEqual(-1e-6);
    expect(ag.d).toBeLessThanOrEqual(len + 1e-6);
    expect(ag.flags.length).toBeLessThanOrEqual(CFG.maxFlags);
  }
  const total = standings(state).reduce((s, r) => s + r.pct, 0);
  expect(total).toBeLessThanOrEqual(100.0001);
}

describe('full simulation (idle player, 3 bots)', () => {
  const originalMode = CFG.shotMode;
  afterEach(() => {
    CFG.shotMode = originalMode;
  });

  it('a full match finishes without error and the bots conquer territory', () => {
    const state = createGame(11);
    run(state, CFG.round + 5);
    expect(state.over).toBe(true);
    checkInvariants(state);
    const botShare = standings(state)
      .filter((r) => !r.agent.human)
      .reduce((s, r) => s + r.pct, 0);
    expect(botShare).toBeGreaterThan(5);
  }, 60_000);

  it('keeps the invariants throughout the match, in both shooting modes', () => {
    for (const mode of ['street', 'free'] as const) {
      CFG.shotMode = mode;
      const state = createGame(5);
      for (let i = 0; i < 20; i++) {
        run(state, 5);
        checkInvariants(state);
      }
    }
  }, 60_000);

  it('a bots-only match, with all four personalities, finishes without error and keeps the invariants', () => {
    const state = createGame(8, { human: false, personalities: [CLASSIC, HUNTER, CAUTIOUS, GREEDY] });
    for (let i = 0; i < 12; i++) {
      run(state, 20);
      checkInvariants(state);
    }
    run(state, 10); // slack: the floating-point clock may stop a moment before 240 s
    expect(state.over).toBe(true);
    expect(standings(state).every((r) => r.pct > 0)).toBe(true);
  }, 60_000);

  it('is deterministic: same seed, same result', () => {
    const summary = (seed: number) => {
      const state = createGame(seed);
      run(state, 90);
      return standings(state).map((r) => [r.agent.id, r.pct.toFixed(6), r.agent.kills, r.agent.deaths]);
    };
    expect(summary(21)).toEqual(summary(21));
  }, 60_000);

  it('time runs out even if nobody reaches winPct', () => {
    const state = createGame(3);
    state.timeLeft = 1;
    run(state, 2);
    expect(state.over).toBe(true);
    expect(state.timeLeft).toBe(0);
  });
});
