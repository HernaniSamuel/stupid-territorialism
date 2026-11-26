import { describe, expect, it } from 'vitest';
import { edgeLength, enclosedFaces, loopLength, nearestNode, path, pointInPolygon, shortestPaths } from '../src/map/graph';
import { gridWorld } from './helpers';

// Grade 3x3 com espaçamento 100. Índices dos nós:
//   0 1 2
//   3 4 5
//   6 7 8
describe('faces de uma grade 3x3', () => {
  const world = gridWorld(3);

  it('acha os 4 quarteirões de 100x100 e descarta a face externa', () => {
    expect(world.faces).toHaveLength(4);
    for (const f of world.faces) expect(f.area).toBeCloseTo(10000);
    expect(world.totalArea).toBeCloseTo(40000);
  });

  it('calcula os limites do mapa', () => {
    expect(world.bounds).toMatchObject({ x0: 0, y0: 0, x1: 200, y1: 200, cx: 100, cy: 100, w: 200, h: 200 });
  });

  it('cada rua tem um quarteirão de cada lado, menos as da borda', () => {
    const N = world.nodes.length;
    // Rua 0-1 (borda de cima): só uma das duas meias-arestas pertence a um quarteirão.
    expect(Number(world.halfEdgeFace.has(0 * N + 1)) + Number(world.halfEdgeFace.has(1 * N + 0))).toBe(1);
    // Rua 1-4 (interna): as duas.
    expect(world.halfEdgeFace.has(1 * N + 4)).toBe(true);
    expect(world.halfEdgeFace.has(4 * N + 1)).toBe(true);
  });
});

describe('enclosedFaces', () => {
  const world = gridWorld(3);

  it('um laço em volta de um quarteirão cerca só ele', () => {
    expect(enclosedFaces(world, [0, 1, 4, 3])).toHaveLength(1);
  });

  it('um laço em volta do mapa cerca tudo', () => {
    expect(enclosedFaces(world, [0, 2, 8, 6])).toHaveLength(4);
  });

  it('um laço em volta de dois quarteirões cerca os dois', () => {
    expect(enclosedFaces(world, [0, 2, 5, 3])).toHaveLength(2);
  });

  it('precisa de 3 bandeiras ou mais', () => {
    expect(enclosedFaces(world, [])).toEqual([]);
    expect(enclosedFaces(world, [0, 8])).toEqual([]);
  });
});

describe('caminhos', () => {
  const world = gridWorld(3);

  it('caminho mínimo entre cantos opostos tem 5 nós e 400 de comprimento', () => {
    expect(path(world, 0, 8)).toHaveLength(5);
    expect(shortestPaths(world, 0).dist[8]).toBeCloseTo(400);
  });

  it('caminho de um nó até ele mesmo é só ele', () => {
    expect(path(world, 4, 4)).toEqual([4]);
  });

  it('o resultado é cacheado por origem', () => {
    expect(shortestPaths(world, 2)).toBe(shortestPaths(world, 2));
  });

  it('loopLength soma o perímetro por ruas', () => {
    expect(loopLength(world, [0, 2, 8, 6])).toBeCloseTo(800);
    expect(loopLength(world, [0, 1, 4, 3])).toBeCloseTo(400);
  });

  it('edgeLength devolve 0 pra nós sem rua entre si', () => {
    expect(edgeLength(world, 0, 1)).toBeCloseTo(100);
    expect(edgeLength(world, 0, 8)).toBe(0);
  });

  it('nearestNode acha o cruzamento mais próximo', () => {
    expect(nearestNode(world, 190, 15)).toBe(2);
    expect(nearestNode(world, 105, 95)).toBe(4);
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('distingue dentro de fora', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: -1 }, square)).toBe(false);
  });
});
