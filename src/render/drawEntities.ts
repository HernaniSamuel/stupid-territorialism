/** Desenho do que se move ou é colocado sobre o mapa: cercas, bandeiras, tiros, agentes. */
import { CFG } from '../config';
import { traceShot } from '../entities/bullets';
import type { GameState, Vec } from '../types';
import { chainInfo } from './chains';

function strokeNodes(ctx: CanvasRenderingContext2D, state: GameState, list: number[]): void {
  const { nodes } = state.world;
  ctx.beginPath();
  list.forEach((n, i) => (i ? ctx.lineTo(nodes[n].x, nodes[n].y) : ctx.moveTo(nodes[n].x, nodes[n].y)));
  ctx.stroke();
}

/** Cercas tracejadas das cadeias em construção (o trecho de fechamento fica mais fraco). */
export function drawFences(ctx: CanvasRenderingContext2D, state: GameState, t: number): void {
  for (const ag of state.agents) {
    if (!ag.flags.length) continue;
    const c = chainInfo(state, ag);
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = ag.color;
    ctx.lineWidth = 5;
    if (c.open.length) strokeNodes(ctx, state, c.open);
    ctx.globalAlpha = 0.4;
    if (c.close.length) strokeNodes(ctx, state, c.close);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, p: Vec, color: string, pulsing: boolean, t: number): void {
  if (pulsing) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 + Math.sin(t * 6) * 1.5, 0, 6.283);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - 22);
  ctx.strokeStyle = '#3c4043';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 22);
  ctx.lineTo(p.x + 15, p.y - 17);
  ctx.lineTo(p.x, p.y - 11);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, 6.283);
  ctx.fillStyle = '#3c4043';
  ctx.fill();
}

/** A primeira bandeira pulsa quando já dá pra fechar o laço (3 ou mais). */
export function drawFlags(ctx: CanvasRenderingContext2D, state: GameState, t: number): void {
  for (const ag of state.agents) {
    ag.flags.forEach((n, i) => drawFlag(ctx, state.world.nodes[n], ag.color, i === 0 && ag.flags.length >= 3, t));
  }
}

export function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const b of state.bullets) {
    ctx.beginPath();
    if (b.kind === 'street') {
      b.tr.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineTo(b.x, b.y);
    } else {
      ctx.moveTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = b.owner.color;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

/** Pontilhado mostrando por onde o tiro do jogador sairia (modo 'street'). */
export function drawShotPreview(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  if (CFG.shotMode !== 'street' || !player.alive) return;
  const pts = traceShot(state.world, player);
  ctx.globalAlpha = player.cd > 0 ? 0.18 : 0.5;
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = player.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Os triângulos. `aim` (ponto do mundo) só é usado pela mirinha do jogador no modo 'free'. */
export function drawAgents(ctx: CanvasRenderingContext2D, state: GameState, t: number, aim: Vec): void {
  for (const ag of state.agents) {
    if (!ag.alive) continue;
    if (ag.invT > 0 && Math.floor(t * 10) % 2) continue; // pisca enquanto invulnerável
    ctx.save();
    ctx.translate(ag.x, ag.y);
    if (ag.human) {
      ctx.beginPath();
      ctx.arc(0, 0, 20 + Math.sin(t * 5) * 2, 0, 6.283);
      ctx.fillStyle = 'rgba(26,115,232,.16)';
      ctx.fill();
      if (CFG.shotMode !== 'street') {
        const a = Math.atan2(aim.y - ag.y, aim.x - ag.x);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
        ctx.strokeStyle = 'rgba(26,115,232,.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    ctx.rotate(ag.ang);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = ag.color;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}
