/** Movimento dos projéteis e o que acontece quando acertam alguém. */
import { CFG } from '../config';
import { advance, place } from '../entities/agent';
import { pickStraight } from '../entities/bullets';
import type { GameState } from '../types';
import { kill } from './territory';

/** Move os projéteis, aplica acertos e remove os que acabaram. */
export function stepBullets(state: GameState, dt: number): void {
  const { world, agents } = state;
  for (const b of state.bullets) {
    b.px = b.x;
    b.py = b.y;
    if (b.kind === 'street') {
      const step = CFG.streetBulletSpeed * dt;
      advance(world, b, step, pickStraight(world, b));
      place(world, b);
      if (b.mv === 0) b.life = 0;
      else {
        b.left -= step;
        if (b.left <= 0) b.life = 0;
      }
      b.tr.push({ x: b.x, y: b.y });
      if (b.tr.length > 6) b.tr.shift();
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    for (const ag of agents) {
      if (ag === b.owner || !ag.alive || ag.invT > 0) continue;
      // Distância ponto–segmento: o tiro não atravessa o alvo entre dois frames.
      const sx = b.x - b.px;
      const sy = b.y - b.py;
      const l2 = sx * sx + sy * sy || 1;
      const t = Math.max(0, Math.min(1, ((ag.x - b.px) * sx + (ag.y - b.py) * sy) / l2));
      if (Math.hypot(b.px + sx * t - ag.x, b.py + sy * t - ag.y) < CFG.hitR) {
        kill(state, ag, b.owner);
        b.life = 0;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}
