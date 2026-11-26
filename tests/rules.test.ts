import { beforeEach, describe, expect, it } from 'vitest';
import { CFG } from '../src/config';
import { createGame } from '../src/game';
import { checkVictory, standings } from '../src/rules/match';
import { closeLoop, destroyChain, kill, plant, respawn } from '../src/rules/territory';
import type { GameState } from '../src/types';
import { gridSource } from './helpers';

// 5x5 grid, spacing 100: 16 blocks of 10000 (total 160000). Index = j*5 + i.
// The top-left block is enclosed by nodes 0, 1, 6, 5.
const CELL = [0, 1, 6, 5];
const CELL_PCT = (10000 / 160000) * 100;

let state: GameState;
beforeEach(() => {
  state = createGame(1, { source: gridSource(5) });
});

const types = () => state.events.map((e) => e.type);

describe('flags and loops', () => {
  it('3 flags warn that the loop can be closed now', () => {
    plant(state, state.player, 0);
    plant(state, state.player, 1);
    expect(types()).not.toContain('loopReady');
    plant(state, state.player, 6);
    expect(types()).toContain('loopReady');
  });

  it('returning to the first flag closes the loop and gives the block to the player', () => {
    const p = state.player;
    for (const n of CELL) plant(state, p, n);
    expect(p.flags).toEqual(CELL);
    expect(plant(state, p, CELL[0])).toBe(true);

    expect(p.flags).toEqual([]);
    expect(state.world.faces.filter((f) => f.owner === p.id)).toHaveLength(1);
    const claim = state.events.find((e) => e.type === 'claim');
    expect(claim).toMatchObject({ type: 'claim', agent: p });
    expect(claim && claim.type === 'claim' ? claim.pct : 0).toBeCloseTo(CELL_PCT);
    expect(standings(state)[0].agent).toBe(p);
    expect(standings(state)[0].pct).toBeCloseTo(CELL_PCT);
  });

  it('closing a loop that encloses nothing new reports it and does not change the owner', () => {
    const p = state.player;
    for (const n of CELL) plant(state, p, n);
    closeLoop(state, p);
    for (const n of CELL) plant(state, p, n);
    state.events.length = 0;
    closeLoop(state, p);
    expect(types()).toEqual(['claimEmpty']);
  });

  it("another agent's loop steals the block", () => {
    const [me, rival] = [state.player, state.agents[1]];
    for (const n of CELL) plant(state, me, n);
    closeLoop(state, me);
    for (const n of CELL) plant(state, rival, n);
    closeLoop(state, rival);
    expect(state.world.faces.filter((f) => f.owner === rival.id)).toHaveLength(1);
    expect(state.world.faces.filter((f) => f.owner === me.id)).toHaveLength(0);
  });

  it('rejects a repeated flag and going over the maximum', () => {
    const p = state.player;
    plant(state, p, 0);
    expect(plant(state, p, 0)).toBe(false);
    expect(state.events.at(-1)).toMatchObject({ type: 'plantRejected', reason: 'duplicate' });

    for (let n = 1; n < CFG.maxFlags; n++) plant(state, p, n);
    expect(p.flags).toHaveLength(CFG.maxFlags);
    expect(plant(state, p, 24)).toBe(false);
    expect(state.events.at(-1)).toMatchObject({ type: 'plantRejected', reason: 'maxFlags' });
  });

  it('a dead agent cannot plant a flag', () => {
    state.player.alive = false;
    expect(plant(state, state.player, 0)).toBe(false);
    expect(state.player.flags).toEqual([]);
  });
});

describe('destruction and death', () => {
  it('destroyChain clears the owner\'s flags, plan and route', () => {
    const rival = state.agents[1];
    rival.flags = [0, 1, 6];
    rival.plan = [6, 0];
    rival.route = [1];
    destroyChain(state, rival, state.player);
    expect(rival.flags).toEqual([]);
    expect(rival.plan).toEqual([]);
    expect(rival.route).toEqual([]);
    expect(state.events.at(-1)).toMatchObject({ type: 'chainDestroyed', owner: rival, by: state.player });
  });

  it('destroyChain does nothing if there were no flags', () => {
    destroyChain(state, state.agents[1], state.player);
    expect(state.events).toEqual([]);
  });

  it('kill takes down the target, counts on the scoreboard, loses flags and releases particles', () => {
    const [killer, victim] = [state.player, state.agents[1]];
    victim.flags = [0, 1, 6];
    kill(state, victim, killer);
    expect(victim.alive).toBe(false);
    expect(victim.flags).toEqual([]);
    expect(victim.deaths).toBe(1);
    expect(killer.kills).toBe(1);
    expect(victim.respawnT).toBe(CFG.respawn);
    expect(state.particles.length).toBe(16);
    expect(state.events.at(-1)).toMatchObject({ type: 'kill', victim, killer });
  });

  it('killing someone who is already dead is ignored', () => {
    const victim = state.agents[1];
    kill(state, victim, state.player);
    kill(state, victim, state.player);
    expect(state.player.kills).toBe(1);
  });

  it('respawns on a node of its own territory, or at the base if it has none', () => {
    const p = state.player;
    kill(state, p, state.agents[1]);
    respawn(state, p);
    expect(p.alive).toBe(true);
    expect(p.invT).toBe(CFG.invuln);
    expect([p.a, p.b]).toContain(p.base);

    for (const n of CELL) plant(state, p, n);
    closeLoop(state, p);
    kill(state, p, state.agents[1]);
    respawn(state, p);
    expect(CELL).toContain(p.a);
  });
});

describe('end of match', () => {
  it('ends when someone passes winPct, announcing it only once', () => {
    const half = state.world.faces.slice(0, Math.ceil(state.world.faces.length * 0.6));
    for (const f of half) f.owner = state.player.id;
    checkVictory(state);
    checkVictory(state);
    expect(state.over).toBe(true);
    expect(types().filter((t) => t === 'matchEnd')).toHaveLength(1);
  });

  it('does not end with little territory', () => {
    state.world.faces[0].owner = state.player.id;
    checkVictory(state);
    expect(state.over).toBe(false);
  });
});
