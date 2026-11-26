/**
 * Finds the city blocks (faces) of a planar graph.
 *
 * Technique: walking half-edges. Each street becomes two half-edges (a→b and b→a).
 * Starting from one, at each node we turn to the street immediately before (by angle)
 * the one we came from; this goes around the same face until we return to the start. The face with the most
 * negative signed area is the outside of the map and is discarded.
 */
import type { Face, GNode, Neighbor } from '../types';

interface RawFace {
  loop: number[];
  halfEdges: [number, number][];
  /** Signed area (shoelace). Negative for the outer face. */
  area: number;
}

export interface FacesResult {
  faces: Face[];
  /** Half-edge (key `a*N+b`) → index in `faces`. */
  halfEdgeFace: Map<number, number>;
}

/** @param minArea city blocks with an area smaller than this are discarded. */
export function buildFaces(nodes: GNode[], adj: Neighbor[][], minArea: number): FacesResult {
  const N = nodes.length;
  const visited = new Set<number>();
  const raw: RawFace[] = [];

  for (let u = 0; u < N; u++) {
    for (const e of adj[u]) {
      const v0 = e.to;
      if (visited.has(u * N + v0)) continue;
      const loop: number[] = [];
      const halfEdges: [number, number][] = [];
      let a = u;
      let b = v0;
      do {
        visited.add(a * N + b);
        loop.push(a);
        halfEdges.push([a, b]);
        const nb = adj[b];
        const idx = nb.findIndex((x) => x.to === a);
        const w = nb[(idx - 1 + nb.length) % nb.length].to;
        a = b;
        b = w;
      } while (!(a === u && b === v0));

      let s = 0;
      for (let k = 0; k < loop.length; k++) {
        const p = nodes[loop[k]];
        const q = nodes[loop[(k + 1) % loop.length]];
        s += p.x * q.y - q.x * p.y;
      }
      raw.push({ loop, halfEdges, area: s / 2 });
    }
  }

  let outer = 0;
  raw.forEach((f, i) => {
    if (f.area < raw[outer].area) outer = i;
  });

  const faces: Face[] = [];
  const halfEdgeFace = new Map<number, number>();
  raw.forEach((f, i) => {
    if (i === outer || f.area < minArea) return;
    // Test point: just "inside" from the midpoint of the longest edge of the face.
    let best: [number, number] = f.halfEdges[0];
    let bestLen = 0;
    for (const [a, b] of f.halfEdges) {
      const l = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].y - nodes[a].y);
      if (l > bestLen) {
        bestLen = l;
        best = [a, b];
      }
    }
    const A = nodes[best[0]];
    const B = nodes[best[1]];
    const nx = -(B.y - A.y) / bestLen;
    const ny = (B.x - A.x) / bestLen;
    const probe = { x: (A.x + B.x) / 2 + nx * 3, y: (A.y + B.y) / 2 + ny * 3 };
    const idx = faces.length;
    faces.push({
      loop: f.loop,
      pts: f.loop.map((n) => nodes[n]),
      area: f.area,
      probe,
      owner: -1,
      flash: 0,
      park: false,
    });
    for (const [a, b] of f.halfEdges) halfEdgeFace.set(a * N + b, idx);
  });

  return { faces, halfEdgeFace };
}
