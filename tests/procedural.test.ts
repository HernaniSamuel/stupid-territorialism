import { describe, expect, it } from 'vitest';
import { CFG } from '../src/config';
import { createRng, shuffle } from '../src/core/rng';
import { generateProceduralGraph } from '../src/map/procedural';
import { buildWorld } from '../src/map/world';

function isConnected(nodeCount: number, edges: [number, number][]): boolean {
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    for (const v of adj[stack.pop()!]) if (!seen.has(v)) (seen.add(v), stack.push(v));
  }
  return seen.size === nodeCount;
}

describe('mapa procedural', () => {
  const seeds = [1, 2, 3, 42, 1234, 99999];

  it.each(seeds)('seed %i: grafo conexo, sem arestas repetidas e com quarteirões', (seed) => {
    const rng = createRng(seed);
    const graph = generateProceduralGraph(rng);
    expect(graph.nodes).toHaveLength(CFG.cols * CFG.rows);
    expect(isConnected(graph.nodes.length, graph.edges)).toBe(true);

    const keys = graph.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`);
    expect(new Set(keys).size).toBe(keys.length);

    const world = buildWorld(graph, rng);
    expect(world.faces.length).toBeGreaterThan(50);
    // Cada quarteirão tem área positiva e a soma bate com o total.
    for (const f of world.faces) expect(f.area).toBeGreaterThan(0);
    expect(world.faces.reduce((s, f) => s + f.area, 0)).toBeCloseTo(world.totalArea);
  });

  it('a mesma semente gera o mesmo mapa; sementes diferentes, mapas diferentes', () => {
    const a = generateProceduralGraph(createRng(7));
    const b = generateProceduralGraph(createRng(7));
    const c = generateProceduralGraph(createRng(8));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('rng', () => {
  it('produz valores em [0, 1) e é determinístico', () => {
    const a = createRng(5);
    const b = createRng(5);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(b()).toBe(v);
    }
  });

  it('shuffle só reordena os elementos', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const copy = [...arr];
    shuffle(copy, createRng(3));
    expect([...copy].sort((x, y) => x - y)).toEqual(arr);
    expect(copy).not.toEqual(arr);
  });
});
