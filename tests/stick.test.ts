import { describe, expect, it } from 'vitest';
import { clampToRadius, STICK_DEADZONE, stickDirection } from '../src/input/stick';

const R = 56;

describe('stickDirection', () => {
  it('dentro da zona morta não há direção', () => {
    expect(stickDirection(0, 0, R)).toEqual({ x: 0, y: 0 });
    expect(stickDirection(R * STICK_DEADZONE * 0.9, 0, R)).toEqual({ x: 0, y: 0 });
  });

  it('fora da zona morta devolve a direção unitária, como o WASD', () => {
    expect(stickDirection(30, 0, R)).toEqual({ x: 1, y: 0 });
    expect(stickDirection(0, -40, R)).toEqual({ x: 0, y: -1 });
    const d = stickDirection(30, 30, R);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(d.y);
  });

  it('não importa o quanto passou do raio: a direção é a mesma', () => {
    expect(stickDirection(500, 0, R)).toEqual({ x: 1, y: 0 });
  });
});

describe('clampToRadius', () => {
  it('mantém o que está dentro e limita o que passa', () => {
    expect(clampToRadius(10, 20, R)).toEqual({ x: 10, y: 20 });
    const c = clampToRadius(300, 400, R);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(R);
    expect(c.y / c.x).toBeCloseTo(4 / 3); // mesma direção
  });
});
