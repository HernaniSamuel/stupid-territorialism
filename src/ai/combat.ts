import { CFG } from '../config';
import { shoot, traceShot } from '../entities/bullets';
import type { Agent, GameState } from '../types';

/**
 * Decides whether the bot shoots this frame.
 *
 * 'street' mode: simulates its own shot and only fires if it would pass through an
 * enemy (the bot doesn't "aim": it only shoots when it happens to be lined up along the street).
 * 'free' mode: aims at the nearest enemy within `botSight`, with lead and error.
 */
export function botCombat(state: GameState, bot: Agent): void {
  if (bot.cd > 0) return;
  const { world, agents, rng } = state;

  if (CFG.shotMode === 'street') {
    const pts = traceShot(world, bot);
    for (const o of agents) {
      if (o === bot || !o.alive || o.invT > 0) continue;
      if (pts.some((p) => Math.hypot(p.x - o.x, p.y - o.y) < CFG.hitR * 1.4)) {
        shoot(state, bot);
        return;
      }
    }
    return;
  }

  let target: Agent | null = null;
  let bestDist = 1e9;
  for (const o of agents) {
    if (o === bot || !o.alive || o.invT > 0) continue;
    const d = Math.hypot(o.x - bot.x, o.y - bot.y);
    if (d < bestDist) {
      bestDist = d;
      target = o;
    }
  }
  if (!target || bestDist > CFG.botSight) return;
  const lead = (bestDist / CFG.bulletSpeed) * 0.6;
  shoot(state, bot, target.x + target.vx * lead, target.y + target.vy * lead, (rng() - 0.5) * 2 * CFG.botAimErr);
}
