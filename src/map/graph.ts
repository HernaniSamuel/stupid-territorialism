/**
 * Operations on the street graph: neighborhoods, shortest paths and "what a flag loop
 * encloses". Nothing here knows about agents or game rules.
 */
import type { Edge, Face, GNode, Neighbor, ShortestPaths, Vec, World } from '../types';

/** Builds each node's neighbor list, sorted by angle (needed to find faces). */
export function buildAdjacency(nodes: GNode[], edges: Edge[]): Neighbor[][] {
  const adj: Neighbor[][] = nodes.map(() => []);
  for (const [a, b] of edges) {
    const dx = nodes[b].x - nodes[a].x;
    const dy = nodes[b].y - nodes[a].y;
    const len = Math.hypot(dx, dy);
    adj[a].push({ to: b, len, ang: Math.atan2(dy, dx) });
    adj[b].push({ to: a, len, ang: Math.atan2(-dy, -dx) });
  }
  adj.forEach((l) => l.sort((p, q) => p.ang - q.ang));
  return adj;
}

/** Length of the street a–b, or 0 if there is no street. */
export function edgeLength(world: World, a: number, b: number): number {
  const l = world.adj[a];
  for (let i = 0; i < l.length; i++) if (l[i].to === b) return l[i].len;
  return 0;
}

/** City block on the left of the half-edge a→b, if any. */
export function faceOnSide(world: World, a: number, b: number): Face | undefined {
  const i = world.halfEdgeFace.get(a * world.nodes.length + b);
  return i === undefined ? undefined : world.faces[i];
}

/** Index of the node closest to the point. O(N). */
export function nearestNode(world: World, x: number, y: number): number {
  const nodes = world.nodes;
  let best = 0;
  let bestD = 1e12;
  for (let i = 0; i < nodes.length; i++) {
    const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Dijkstra from `src`, cached in `world.paths`.
 * It is O(N²) per source: great for hundreds of nodes, slow for thousands (use a heap).
 */
export function shortestPaths(world: World, src: number): ShortestPaths {
  const cached = world.paths.get(src);
  if (cached) return cached;
  const N = world.nodes.length;
  const dist = new Float64Array(N).fill(1e12);
  const prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  dist[src] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1;
    let bd = 1e12;
    for (let i = 0; i < N; i++) {
      if (!done[i] && dist[i] < bd) {
        bd = dist[i];
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    for (const e of world.adj[u]) {
      const nd = bd + e.len;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }
  const result = { dist, prev };
  world.paths.set(src, result);
  return result;
}

/** Shortest path of nodes from `a` to `b`, including both. */
export function path(world: World, a: number, b: number): number[] {
  const { prev } = shortestPaths(world, a);
  const p: number[] = [];
  for (let v = b; v !== -1; v = prev[v]) {
    p.push(v);
    if (v === a) break;
  }
  return p.reverse();
}

/** Nodes walked when connecting the flags in sequence and returning to the first (without repeating the last). */
export function loopNodes(world: World, flags: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < flags.length; i++) {
    const p = path(world, flags[i], flags[(i + 1) % flags.length]);
    for (let k = 0; k < p.length - 1; k++) out.push(p[k]);
  }
  return out;
}

/** Total length of the flag loop, walking along the streets. */
export function loopLength(world: World, flags: number[]): number {
  let s = 0;
  for (let i = 0; i < flags.length; i++) s += shortestPaths(world, flags[i]).dist[flags[(i + 1) % flags.length]];
  return s;
}

/** Point inside a polygon (even-odd rule). */
export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** City blocks enclosed by the loop formed by these flags (needs 3 or more). */
export function enclosedFaces(world: World, flags: number[]): Face[] {
  if (flags.length < 3) return [];
  const poly = loopNodes(world, flags).map((n) => world.nodes[n]);
  return world.faces.filter((f) => pointInPolygon(f.probe, poly));
}
