import { CFG } from '../config';
import type { Rng } from '../core/rng';
import type { Bounds, Graph, World } from '../types';
import { buildFaces } from './faces';
import { buildAdjacency } from './graph';

/** Turns a street graph (from any source) into a playable world. */
export function buildWorld(graph: Graph, rng: Rng): World {
  const { nodes, edges } = graph;
  const adj = buildAdjacency(nodes, edges);
  const { faces, halfEdgeFace } = buildFaces(nodes, adj, CFG.minFaceArea);
  for (const f of faces) f.park = rng() < CFG.parkP;
  const totalArea = faces.reduce((s, f) => s + f.area, 0);

  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x);
    y1 = Math.max(y1, n.y);
  }
  const bounds: Bounds = { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };

  return { nodes, edges, adj, faces, halfEdgeFace, totalArea, bounds, paths: new Map() };
}
