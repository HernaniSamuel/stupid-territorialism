/**
 * Operações sobre o grafo de ruas: vizinhança, caminho mínimo e "o que um laço
 * de bandeiras cerca". Nada aqui conhece agentes ou regras do jogo.
 */
import type { Edge, Face, GNode, Neighbor, ShortestPaths, Vec, World } from '../types';

/** Monta as listas de vizinhos de cada nó, ordenadas por ângulo (necessário pra achar faces). */
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

/** Comprimento da rua a–b, ou 0 se não houver rua. */
export function edgeLength(world: World, a: number, b: number): number {
  const l = world.adj[a];
  for (let i = 0; i < l.length; i++) if (l[i].to === b) return l[i].len;
  return 0;
}

/** Quarteirão à esquerda da meia-aresta a→b, se houver. */
export function faceOnSide(world: World, a: number, b: number): Face | undefined {
  const i = world.halfEdgeFace.get(a * world.nodes.length + b);
  return i === undefined ? undefined : world.faces[i];
}

/** Índice do nó mais próximo do ponto. O(N). */
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
 * Dijkstra a partir de `src`, com cache em `world.paths`.
 * É O(N²) por origem: ótimo para centenas de nós, lento para milhares (use um heap).
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

/** Caminho mínimo de nós de `a` até `b`, incluindo os dois. */
export function path(world: World, a: number, b: number): number[] {
  const { prev } = shortestPaths(world, a);
  const p: number[] = [];
  for (let v = b; v !== -1; v = prev[v]) {
    p.push(v);
    if (v === a) break;
  }
  return p.reverse();
}

/** Nós percorridos ao ligar as bandeiras em sequência e voltar à primeira (sem repetir o último). */
export function loopNodes(world: World, flags: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < flags.length; i++) {
    const p = path(world, flags[i], flags[(i + 1) % flags.length]);
    for (let k = 0; k < p.length - 1; k++) out.push(p[k]);
  }
  return out;
}

/** Comprimento total do laço de bandeiras, andando pelas ruas. */
export function loopLength(world: World, flags: number[]): number {
  let s = 0;
  for (let i = 0; i < flags.length; i++) s += shortestPaths(world, flags[i]).dist[flags[(i + 1) % flags.length]];
  return s;
}

/** Ponto dentro de polígono (regra par-ímpar). */
export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Quarteirões cercados pelo laço formado por essas bandeiras (precisa de 3 ou mais). */
export function enclosedFaces(world: World, flags: number[]): Face[] {
  if (flags.length < 3) return [];
  const poly = loopNodes(world, flags).map((n) => world.nodes[n]);
  return world.faces.filter((f) => pointInPolygon(f.probe, poly));
}
