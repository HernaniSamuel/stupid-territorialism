/**
 * Criação e trajetória dos tiros. No modo 'street' o projétil anda pelas ruas,
 * seguindo em frente nos cruzamentos; no modo 'free' voa em linha reta.
 * (Movimento dos projéteis e acertos ficam em `rules/combat.ts`.)
 */
import { CFG } from '../config';
import type { Agent, GameState, Vec, Walker, World } from '../types';
import { advance, place, type PickFn } from './agent';

/**
 * Continuação "na mesma rua": em cada nó segue a rua que menos desvia da direção
 * atual, desde que a curva seja de até `streetMaxTurn` graus. Lê a direção do
 * walker no momento da chamada, por isso devolve uma função.
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
 * Pontos por onde um projétil 'street' passaria saindo de `start`, até `range` pixels,
 * seguindo em frente nos cruzamentos. Não altera `start`.
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

/** Pontos por onde um tiro 'street' disparado agora por `ag` passaria (prévia e mira dos bots). */
export function traceShot(world: World, ag: Agent): Vec[] {
  return tracePath(world, { a: ag.a, b: ag.b, d: ag.d, mv: ag.face, x: ag.x, y: ag.y }, CFG.streetRange);
}

/**
 * Dispara, se a recarga permitir. No modo 'street' ignora `tx`/`ty`;
 * no 'free' mira nesse ponto com um erro de `err` radianos.
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
