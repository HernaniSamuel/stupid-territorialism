/** Como as teclas do jogador viram movimento pelo grafo. */
import type { Agent, Vec, World } from '../types';
import { nodeAt } from './agent';

/**
 * No meio de uma rua, define o sentido (ida ou volta) conforme a direção pedida;
 * sem direção, para. Nos cruzamentos quem decide é `pickPlayerEdge`.
 */
export function steerPlayer(world: World, ag: Agent, dir: Vec): void {
  if (!dir.x && !dir.y) {
    ag.mv = 0;
    return;
  }
  if (nodeAt(world, ag) >= 0) return;
  const A = world.nodes[ag.a];
  const B = world.nodes[ag.b];
  const l = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const dot = (dir.x * (B.x - A.x) + dir.y * (B.y - A.y)) / l;
  if (Math.abs(dot) > 0.35) ag.mv = dot > 0 ? 1 : -1;
}

/** Num cruzamento, escolhe a rua mais alinhada com a direção pedida (ou -1 se nenhuma serve). */
export function pickPlayerEdge(world: World, node: number, dir: Vec): number {
  if (!dir.x && !dir.y) return -1;
  let best = -1;
  let bestDot = 0.3;
  for (const e of world.adj[node]) {
    const d = dir.x * Math.cos(e.ang) + dir.y * Math.sin(e.ang);
    if (d > bestDot) {
      bestDot = d;
      best = e.to;
    }
  }
  return best;
}
