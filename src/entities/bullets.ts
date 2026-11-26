/**
 * Creation and trajectory of shots. In 'street' mode the projectile travels along the streets,
 * continuing straight at intersections; in 'free' mode it flies in a straight line.
 * (Projectile movement and hits live in `rules/combat.ts`.)
 */
import { CFG } from '../config';
import type { Agent, GameState, Vec, Walker, World } from '../types';
import { advance, place, type PickFn } from './agent';

/**
 * "Same street" continuation: at each node it follows the street that deviates least from the
 * current direction, as long as the turn is up to `streetMaxTurn` degrees. It reads the direction of the
 * walker at the time of the call, which is why it returns a function.
 */
export function pickStraight(world: World, w: Walker): PickFn {
  const minCos = Math.cos((CFG.streetMaxTurn * Math.PI) / 180);
  return (n) => {
    const A = world.nodes[w.a];
    const B = world.nodes[w.b];
    let dx = B.x - A.x;
    let dy = B.y - A.y;
    if (w.mv < 0) {
      dx = -dx;
      dy = -dy;
    }
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    let best = -1;
    let bestCos = minCos;
    for (const e of world.adj[n]) {
      const d = dx * Math.cos(e.ang) + dy * Math.sin(e.ang);
      if (d > bestCos) {
        bestCos = d;
        best = e.to;
      }
    }
    return best;
  };
}

/**
 * Points a 'street' projectile would pass through leaving `start`, up to `range` pixels,
 * continuing straight at intersections. Does not change `start`.
 */
export function tracePath(world: World, start: Walker, range: number): Vec[] {
  const probe: Walker = { a: start.a, b: start.b, d: start.d, mv: start.mv, x: start.x, y: start.y };
  const pick = pickStraight(world, probe);
  const pts: Vec[] = [{ x: probe.x, y: probe.y }];
  let left = range;
  while (left > 0) {
    const step = Math.min(10, left);
    advance(world, probe, step, pick);
    if (probe.mv === 0) break;
    place(world, probe);
    pts.push({ x: probe.x, y: probe.y });
    left -= step;
  }
  return pts;
}

/** Points a 'street' shot fired right now by `ag` would pass through (preview and bot aiming). */
export function traceShot(world: World, ag: Agent): Vec[] {
  return tracePath(world, { a: ag.a, b: ag.b, d: ag.d, mv: ag.face, x: ag.x, y: ag.y }, CFG.streetRange);
}

/**
 * Fires, if the reload allows it. In 'street' mode it ignores `tx`/`ty`;
 * in 'free' mode it aims at that point with an error of `err` radians.
 */
export function shoot(state: GameState, ag: Agent, tx = 0, ty = 0, err = 0): void {
  if (ag.cd > 0 || !ag.alive) return;
  if (CFG.shotMode === 'street') {
    state.bullets.push({
      kind: 'street',
      a: ag.a,
      b: ag.b,
      d: ag.d,
      mv: ag.face,
      x: ag.x,
      y: ag.y,
      px: ag.x,
      py: ag.y,
      left: CFG.streetRange,
      life: 1,
      owner: ag,
      tr: [],
    });
  } else {
    const a = Math.atan2(ty - ag.y, tx - ag.x) + err;
    state.bullets.push({
      kind: 'free',
      x: ag.x,
      y: ag.y,
      px: ag.x,
      py: ag.y,
      vx: Math.cos(a) * CFG.bulletSpeed,
      vy: Math.sin(a) * CFG.bulletSpeed,
      life: CFG.bulletRange / CFG.bulletSpeed,
      owner: ag,
    });
  }
  ag.cd = ag.human ? CFG.shotCd : CFG.botShotCd;
  state.events.push({ type: 'shot', agent: ag });
}
