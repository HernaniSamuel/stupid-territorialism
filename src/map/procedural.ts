import { CFG, type Config } from '../config';
import { shuffle, type Rng } from '../core/rng';
import type { Edge, GNode, Graph } from '../types';
import type { MapSource } from './source';

type GridParams = Pick<Config, 'cols' | 'rows' | 'sp' | 'jit' | 'keepEdge' | 'diag'>;

/**
 * Grade de cruzamentos deslocados aleatoriamente, com algumas ruas removidas e
 * algumas diagonais. A borda quase não é deslocada e mantém todas as ruas, e o
 * grafo final é sempre conexo (ruas removidas voltam se isolariam uma parte).
 */
export function generateProceduralGraph(rng: Rng, params: GridParams = CFG): Graph {
  const { cols, rows, sp, jit, keepEdge, diag } = params;
  const id = (i: number, j: number) => j * cols + i;

  const nodes: GNode[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const border = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
      const J = sp * (border ? 0.07 : jit);
      nodes.push({ x: i * sp + (rng() - 0.5) * 2 * J, y: j * sp + (rng() - 0.5) * 2 * J });
    }
  }

  // União-busca pra garantir conectividade.
  const parent = nodes.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));

  const edges: Edge[] = [];
  const has = new Set<number>();
  const key = (a: number, b: number) => (a < b ? a * 10000 + b : b * 10000 + a);
  const add = (a: number, b: number): boolean => {
    const k = key(a, b);
    if (has.has(k)) return false;
    has.add(k);
    edges.push([a, b]);
    parent[find(a)] = find(b);
    return true;
  };

  interface Candidate {
    a: number;
    b: number;
    /** Ruas da borda externa nunca são removidas. */
    onBorder: boolean;
  }
  const candidates: Candidate[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < cols - 1) candidates.push({ a: id(i, j), b: id(i + 1, j), onBorder: j === 0 || j === rows - 1 });
      if (j < rows - 1) candidates.push({ a: id(i, j), b: id(i, j + 1), onBorder: i === 0 || i === cols - 1 });
    }
  }

  const removed: Candidate[] = [];
  for (const c of candidates) {
    if (c.onBorder || rng() < keepEdge) add(c.a, c.b);
    else removed.push(c);
  }
  shuffle(removed, rng);
  for (const r of removed) if (find(r.a) !== find(r.b)) add(r.a, r.b);

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      if (rng() < diag) {
        if (rng() < 0.5) add(id(i, j), id(i + 1, j + 1));
        else add(id(i + 1, j), id(i, j + 1));
      }
    }
  }

  return { nodes, edges };
}

export const proceduralSource: MapSource = {
  id: 'procedural',
  label: 'Procedural',
  build: (rng) => generateProceduralGraph(rng),
};
