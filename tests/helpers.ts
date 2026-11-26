import { createRng } from '../src/core/rng';
import type { MapSource } from '../src/map/source';
import { buildWorld } from '../src/map/world';
import type { Edge, GNode, Graph, World } from '../src/types';

/** Regular `n`×`n` grid of nodes (index = j*n + i), with all horizontal and vertical streets. */
export function gridGraph(n: number, spacing = 100): Graph {
  const nodes: GNode[] = [];
  const edges: Edge[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) nodes.push({ x: i * spacing, y: j * spacing });
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i < n - 1) edges.push([j * n + i, j * n + i + 1]);
      if (j < n - 1) edges.push([j * n + i, (j + 1) * n + i]);
    }
  }
  return { nodes, edges };
}

export function gridWorld(n: number, spacing = 100): World {
  return buildWorld(gridGraph(n, spacing), createRng(1));
}

export function gridSource(n: number, spacing = 100): MapSource {
  return { id: 'grid', label: 'Grid', build: () => gridGraph(n, spacing) };
}
