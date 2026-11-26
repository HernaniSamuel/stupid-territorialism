/** Desenho do mapa: quarteirões, ruas e bordas de território. */
import { TEAMS } from '../config';
import type { GameState, Vec } from '../types';
import { chainInfo } from './chains';

export function polyPath(ctx: CanvasRenderingContext2D, pts: Vec[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/** Quarteirões com a cor do dono, e a prévia (translúcida) do que cada laço aberto cercaria. */
export function drawBlocks(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const f of state.world.faces) {
    polyPath(ctx, f.pts);
    ctx.fillStyle = f.park ? '#cfe6c2' : '#f3f0e8';
    ctx.fill();
    if (f.owner >= 0) {
      ctx.globalAlpha = 0.34 + f.flash * 0.45;
      ctx.fillStyle = TEAMS[f.owner].color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  for (const ag of state.agents) {
    if (ag.flags.length < 3) continue;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = ag.color;
    for (const f of chainInfo(state, ag).fill) {
      polyPath(ctx, f.pts);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawStreets(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { nodes, edges } = state.world;
  ctx.beginPath();
  for (const [a, b] of edges) {
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);
  }
  ctx.strokeStyle = '#bfc4c9';
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 9;
  ctx.stroke();
}

/** Pinta as ruas que separam territórios diferentes; disputa vira tracejado. */
export function drawTerritoryBorders(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { nodes, edges, faces, halfEdgeFace } = state.world;
  const N = nodes.length;
  const ownerOf = (i: number | undefined) => (i !== undefined ? faces[i].owner : -1);
  for (const [a, b] of edges) {
    const o1 = ownerOf(halfEdgeFace.get(a * N + b));
    const o2 = ownerOf(halfEdgeFace.get(b * N + a));
    if (o1 === o2) continue;
    ctx.beginPath();
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);
    if (o1 >= 0) {
      ctx.setLineDash([]);
      ctx.strokeStyle = TEAMS[o1].color;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    if (o2 >= 0) {
      ctx.setLineDash(o1 >= 0 ? [8, 8] : []);
      ctx.strokeStyle = TEAMS[o2].color;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
