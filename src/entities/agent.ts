/**
 * Agents (player and bots) and their movement along the street graph.
 *
 * A `Walker` is always on a street: it goes from node `a` to node `b`, and `d` is how far it
 * has traveled from `a`. It can only switch streets at nodes.
 */
import { CFG, TEAMS, type Personality } from '../config';
import { edgeLength, faceOnSide, nearestNode } from '../map/graph';
import type { Agent, Vec, Walker, World } from '../types';

/** Picks the next street on arriving at a node. Returns the destination node, or -1 to stop. */
export type PickFn = (node: number) => number;

/** Creates agent `id` (0 = human) at its corresponding spawn corner. */
export function makeAgent(world: World, id: number, human: boolean, persona: Personality): Agent {
  const { y0, x1, y1 } = world.bounds;
  // One corner per agent, so the game supports at most 4.
  const corners: [number, number][] = [
    [60, y1 - 40],
    [x1 - 60, y0 + 40],
    [60, y0 + 40],
    [x1 - 60, y1 - 40],
  ];
  const [cx, cy] = corners[id];
  const n = nearestNode(world, cx, cy);
  const team = TEAMS[id];
  return {
    id,
    human,
    name: team.name,
    color: team.color,
    persona,
    base: n,
    a: n,
    b: world.adj[n][0].to,
    d: 0,
    mv: 0,
    x: world.nodes[n].x,
    y: world.nodes[n].y,
    vx: 0,
    vy: 0,
    ang: -Math.PI / 2,
    alive: true,
    respawnT: 0,
    invT: CFG.invuln,
    cd: 0,
    kills: 0,
    deaths: 0,
    flags: [],
    route: [],
    plan: [],
    face: 1,
  };
}

/** Updates x,y from a, b and d. */
export function place(world: World, w: Walker): void {
  const A = world.nodes[w.a];
  const B = world.nodes[w.b];
  const L = edgeLength(world, w.a, w.b) || 1;
  const t = Math.min(1, Math.max(0, w.d / L));
  w.x = A.x + (B.x - A.x) * t;
  w.y = A.y + (B.y - A.y) * t;
}

/** Node the walker is exactly stopped at, or -1 if it is in the middle of a street. */
export function nodeAt(world: World, w: Walker): number {
  const L = edgeLength(world, w.a, w.b);
  if (w.d <= 0.001) return w.a;
  if (w.d >= L - 0.001) return w.b;
  return -1;
}

/** Node within `r` pixels of the point, or -1. */
export function nodeNear(world: World, p: Vec, r: number): number {
  const n = nearestNode(world, p.x, p.y);
  return Math.hypot(world.nodes[n].x - p.x, world.nodes[n].y - p.y) <= r ? n : -1;
}

/**
 * Moves `dist` pixels along the streets. At each node reached, `pick` decides the next
 * street; if it returns -1, the walker stops there (mv = 0).
 */
export function advance(world: World, w: Walker, dist: number, pick: PickFn): void {
  let rem = dist;
  let guard = 0;
  while (rem > 1e-6 && guard++ < 12) {
    if (w.mv === 0) {
      const n = nodeAt(world, w);
      if (n < 0) return;
      const next = pick(n);
      if (next < 0) return;
      w.a = n;
      w.b = next;
      w.d = 0;
      w.mv = 1;
    }
    const L = edgeLength(world, w.a, w.b);
    if (w.mv > 0) {
      const can = L - w.d;
      if (rem < can) {
        w.d += rem;
        rem = 0;
      } else {
        w.d = L;
        rem -= can;
        const n = w.b;
        const next = pick(n);
        if (next >= 0) {
          w.a = n;
          w.b = next;
          w.d = 0;
          w.mv = 1;
        } else {
          w.mv = 0;
          return;
        }
      }
    } else {
      const can = w.d;
      if (rem < can) {
        w.d -= rem;
        rem = 0;
      } else {
        w.d = 0;
        rem -= can;
        const n = w.a;
        const next = pick(n);
        if (next >= 0) {
          w.a = n;
          w.b = next;
          w.d = 0;
          w.mv = 1;
        } else {
          w.mv = 0;
          return;
        }
      }
    }
  }
}

/** Is the agent on a street bordering one of its own blocks? (grants a speed bonus) */
export function onOwnTurf(world: World, ag: Agent): boolean {
  return faceOnSide(world, ag.a, ag.b)?.owner === ag.id || faceOnSide(world, ag.b, ag.a)?.owner === ag.id;
}
