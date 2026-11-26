import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { botPick } from '../src/ai/bot';
import { chainThreat, edgeExposed, incomingFire } from '../src/ai/perception';
import { planClaim } from '../src/ai/planner';
import { CFG, CLASSIC, GREEDY, HUNTER, type Personality } from '../src/config';
import { place } from '../src/entities/agent';
import { traceShot, tracePath } from '../src/entities/bullets';
import { createGame } from '../src/game';
import { leader } from '../src/rules/match';
import type { Agent, GameState } from '../src/types';
import { gridSource } from './helpers';

// 5x5 grid, spacing 100. Index = row*5 + column:
//    0  1  2  3  4        y=0
//    5  6  7  8  9        y=100
//   10 11 12 13 14        y=200
//   15 16 17 18 19        y=300
//   20 21 22 23 24        y=400
const personas = (bot: Personality): Personality[] => [CLASSIC, bot, CLASSIC, CLASSIC];

let state: GameState;
let shooter: Agent;
let bot: Agent;

/** Places the agent exactly on the node, facing the direction of `a` → `b`. */
function standAt(ag: Agent, a: number, b: number): void {
  ag.a = a;
  ag.b = b;
  ag.d = state.world.adj[a].find((e) => e.to === b)!.len;
  ag.mv = 0;
  ag.face = 1;
  place(state.world, ag);
}

function setup(botPersona: Personality, source = gridSource(5)): void {
  state = createGame(1, { source, personalities: personas(botPersona) });
  [shooter, bot] = [state.agents[0], state.agents[1]];
  for (const o of state.agents.slice(2)) o.alive = false; // only the shooter and the bot on stage
  shooter.cd = 0;
}

describe('line of fire', () => {
  beforeEach(() => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11); // on node 11 (x=100,y=200), facing right: the shot runs along the line y=200
  });

  it('an enemy ready to shoot creates a line of fire; one that just fired does not', () => {
    expect(incomingFire(state, bot)).toHaveLength(1);
    shooter.cd = 1;
    expect(incomingFire(state, bot)).toHaveLength(0);
  });

  it('shots in flight count, except the bot\'s own', () => {
    shooter.cd = 1;
    state.bullets.push({ kind: 'street', a: 11, b: 12, d: 10, mv: 1, x: 110, y: 200, px: 110, py: 200, left: 200, life: 1, owner: shooter, tr: [] });
    state.bullets.push({ kind: 'street', a: 6, b: 11, d: 10, mv: 1, x: 100, y: 110, px: 100, py: 110, left: 200, life: 1, owner: bot, tr: [] });
    expect(incomingFire(state, bot)).toHaveLength(1);
  });

  it('walking along the line is dangerous; leaving it sideways is not', () => {
    const lines = incomingFire(state, bot);
    expect(edgeExposed(state.world, 13, 14, lines)).toBe(true); // forward, on the line
    expect(edgeExposed(state.world, 13, 12, lines)).toBe(true); // backward, on the line
    expect(edgeExposed(state.world, 13, 8, lines)).toBe(false); // sideways
    expect(edgeExposed(state.world, 13, 18, lines)).toBe(false);
  });

  it('merely crossing the line does not count as exposure', () => {
    // 7 → 12 goes down to the line y=200 and ends on it: it only touches one sample.
    expect(edgeExposed(state.world, 7, 12, incomingFire(state, bot))).toBe(false);
  });

  it('only the street mode has lines of fire that follow the streets', () => {
    CFG.shotMode = 'free';
    try {
      expect(incomingFire(state, bot)).toEqual([]);
    } finally {
      CFG.shotMode = 'street';
    }
  });

  it('tracePath does not change the starting point, and traceShot is the particular case', () => {
    const start = { a: shooter.a, b: shooter.b, d: shooter.d, mv: 1 as const, x: shooter.x, y: shooter.y };
    const copy = { ...start };
    const pts = tracePath(state.world, start, CFG.streetRange);
    expect(start).toEqual(copy);
    expect(pts).toEqual(traceShot(state.world, shooter));
    expect(pts.length).toBeGreaterThan(5);
  });
});

describe('shot dodging', () => {
  it('swaps an exposed street for a side street and discards the route', () => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11);
    bot.route = [14];
    const next = botPick(state, bot, 13);
    expect([8, 18]).toContain(next);
    expect(bot.route).toEqual([]);
  });

  it('without the ability to dodge, keeps straight ahead', () => {
    setup(CLASSIC);
    standAt(shooter, 10, 11);
    bot.route = [14];
    expect(botPick(state, bot, 13)).toBe(14);
  });

  it('if there is no safe exit, keeps the street', () => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11);
    // At corner 14 (x=400,y=200) the only exits are the line of fire (13) and the sides 9 and 19; we block the sides.
    state.bullets.push(
      { kind: 'street', a: 14, b: 9, d: 0, mv: 1, x: 400, y: 200, px: 400, py: 200, left: 200, life: 1, owner: shooter, tr: [] },
      { kind: 'street', a: 14, b: 19, d: 0, mv: 1, x: 400, y: 200, px: 400, py: 200, left: 200, life: 1, owner: shooter, tr: [] },
    );
    bot.route = [13];
    expect(botPick(state, bot, 14)).toBe(13);
  });
});

describe('flag defense', () => {
  beforeEach(() => {
    setup({ ...CLASSIC, defend: 1 });
    shooter.cd = 5; // no shots in this scenario
    bot.flags = [12, 13];
  });

  const enemyAt = (x: number, y: number, vx: number, vy: number) => Object.assign(shooter, { x, y, vx, vy });

  it('an enemy coming toward a flag, nearby, is a threat', () => {
    enemyAt(400, 200, -100, 0);
    expect(chainThreat(state, bot)).toBe(shooter);
  });

  it('someone passing nearby and moving away is not a threat', () => {
    enemyAt(400, 200, 100, 0);
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('an enemy standing still right on a flag is a threat; standing still farther away, not', () => {
    enemyAt(340, 200, 0, 0);
    expect(chainThreat(state, bot)).toBe(shooter);
    enemyAt(400, 200, 0, 0);
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('only defends a chain with at least 2 flags', () => {
    enemyAt(340, 200, 0, 0);
    bot.flags = [13];
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('the bot drops the route and goes to intercept the enemy', () => {
    enemyAt(400, 200, -100, 0);
    bot.route = [11, 10]; // a route that would move it away from them
    expect(botPick(state, bot, 12)).toBe(13);
    expect(bot.route).toEqual([14]);
  });

  it('with defend = 0 it does not react', () => {
    bot.persona = CLASSIC;
    enemyAt(400, 200, -100, 0);
    bot.route = [11, 10];
    expect(botPick(state, bot, 12)).toBe(11);
  });
});

describe('planning', () => {
  it('returns a closed loop of 3 to 5 distinct flags', () => {
    for (const p of [CLASSIC, HUNTER, GREEDY]) {
      state = createGame(7, { personalities: personas(p) });
      const b = state.agents[1];
      const plan = planClaim(state, b, b.a);
      expect(plan).not.toBeNull();
      expect(plan![0]).toBe(plan!.at(-1));
      const distinct = new Set(plan);
      expect(distinct.size).toBeGreaterThanOrEqual(3);
      expect(distinct.size).toBeLessThanOrEqual(5);
    }
  });

  it('with a risk weight, prefers loops far from enemies', () => {
    const meanDistToEnemy = (riskWeight: number): number => {
      setup({ ...CLASSIC, riskWeight }, gridSource(9));
      const enemy = state.agents[0];
      standAt(enemy, 36, 37); // node 37: column 1, row 4 → x=100, y=400
      standAt(bot, 39, 40); // node 40: the center
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 60; i++) {
        const plan = planClaim(state, bot, 40);
        if (!plan) continue;
        for (const f of plan) {
          const p = state.world.nodes[f];
          sum += Math.hypot(p.x - enemy.x, p.y - enemy.y);
          n++;
        }
      }
      return sum / n;
    };
    expect(meanDistToEnemy(5)).toBeGreaterThan(meanDistToEnemy(0) + 20);
  });
});

describe('scoreboard leader', () => {
  it('is null while nobody has territory, and afterwards is whoever has the most', () => {
    state = createGame(2);
    expect(leader(state)).toBeNull();
    state.world.faces[0].owner = 2;
    expect(leader(state)).toBe(state.agents[2]);
  });
});

describe('personalities', () => {
  afterEach(() => {
    CFG.botBrain = 'smart';
  });

  it('in smart mode each bot has its own; in classic all are classic', () => {
    state = createGame(1);
    expect(state.agents.slice(1).map((a) => a.persona.label)).toEqual(['hunter', 'cautious', 'greedy']);
    CFG.botBrain = 'classic';
    state = createGame(1);
    expect(state.agents.slice(1).every((a) => a.persona === CLASSIC)).toBe(true);
  });

  it('explicit personalities win, and human:false turns agent 0 into a bot', () => {
    state = createGame(1, { human: false, personalities: [GREEDY, GREEDY, HUNTER, CLASSIC] });
    expect(state.agents[0].human).toBe(false);
    expect(state.agents.map((a) => a.persona)).toEqual([GREEDY, GREEDY, HUNTER, CLASSIC]);
    expect(createGame(1).agents[0].human).toBe(true);
  });
});
