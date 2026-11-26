import { describe, expect, it } from 'vitest';
import { edgeLength, enclosedFaces, loopLength, nearestNode, path, pointInPolygon, shortestPaths } from '../src/map/graph';
import { gridWorld } from './helpers';

// 3x3 grid with spacing 100. Node indices:
//   0 1 2
//   3 4 5
//   6 7 8
describe('faces of a 3x3 grid', () => {
  const world = gridWorld(3);

  it('finds the 4 blocks of 100x100 and discards the outer face', () => {
    expect(world.faces).toHaveLength(4);
    for (const f of world.faces) expect(f.area).toBeCloseTo(10000);
    expect(world.totalArea).toBeCloseTo(40000);
  });

  it('computes the map bounds', () => {
    expect(world.bounds).toMatchObject({ x0: 0, y0: 0, x1: 200, y1: 200, cx: 100, cy: 100, w: 200, h: 200 });
  });

  it('each street has a block on each side, except those on the border', () => {
    const N = world.nodes.length;
    // Street 0-1 (top border): only one of the two half-edges belongs to a block.
    expect(Number(world.halfEdgeFace.has(0 * N + 1)) + Number(world.halfEdgeFace.has(1 * N + 0))).toBe(1);
    // Street 1-4 (inner): both.
    expect(world.halfEdgeFace.has(1 * N + 4)).toBe(true);
    expect(world.halfEdgeFace.has(4 * N + 1)).toBe(true);
  });
});

describe('enclosedFaces', () => {
  const world = gridWorld(3);

  it('a loop around one block encloses only that block', () => {
    expect(enclosedFaces(world, [0, 1, 4, 3])).toHaveLength(1);
  });

  it('a loop around the whole map encloses everything', () => {
    expect(enclosedFaces(world, [0, 2, 8, 6])).toHaveLength(4);
  });

  it('a loop around two blocks encloses both', () => {
    expect(enclosedFaces(world, [0, 2, 5, 3])).toHaveLength(2);
  });

  it('needs 3 or more flags', () => {
    expect(enclosedFaces(world, [])).toEqual([]);
    expect(enclosedFaces(world, [0, 8])).toEqual([]);
  });
});

describe('paths', () => {
  const world = gridWorld(3);

  it('shortest path between opposite corners has 5 nodes and length 400', () => {
    expect(path(world, 0, 8)).toHaveLength(5);
    expect(shortestPaths(world, 0).dist[8]).toBeCloseTo(400);
  });

  it('the path from a node to itself is just that node', () => {
    expect(path(world, 4, 4)).toEqual([4]);
  });

  it('the result is cached per source', () => {
    expect(shortestPaths(world, 2)).toBe(shortestPaths(world, 2));
  });

  it('loopLength sums the perimeter along the streets', () => {
    expect(loopLength(world, [0, 2, 8, 6])).toBeCloseTo(800);
    expect(loopLength(world, [0, 1, 4, 3])).toBeCloseTo(400);
  });

  it('edgeLength returns 0 for nodes with no street between them', () => {
    expect(edgeLength(world, 0, 1)).toBeCloseTo(100);
    expect(edgeLength(world, 0, 8)).toBe(0);
  });

  it('nearestNode finds the closest intersection', () => {
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
  it('distinguishes inside from outside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: -1 }, square)).toBe(false);
  });
});
