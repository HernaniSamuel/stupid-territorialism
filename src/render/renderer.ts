/** Canvas: sets size/DPR, applies the camera and draws the layers in the right order. */
import type { GameState, Vec } from '../types';
import type { Camera } from './camera';
import { drawAgents, drawBullets, drawFences, drawFlags, drawParticles, drawShotPreview } from './drawEntities';
import { drawBlocks, drawStreets, drawTerritoryBorders } from './drawWorld';

export interface Renderer {
  /** Viewport size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /**
   * @param t time in seconds (only for animations)
   * @param aim world point pointed at by the mouse
   */
  render(state: GameState, cam: Camera, t: number, aim: Vec): void;
}

const BACKGROUND = '#dcd8cc';

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize(): void {
    dpr = Math.min(2, devicePixelRatio || 1);
    width = innerWidth;
    height = innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  addEventListener('resize', resize);
  resize();

  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    render(state, cam, t, aim) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      drawBlocks(ctx, state);
      drawStreets(ctx, state);
      drawTerritoryBorders(ctx, state);
      drawFences(ctx, state, t);
      drawFlags(ctx, state, t);
      drawBullets(ctx, state);
      drawParticles(ctx, state);
      drawShotPreview(ctx, state);
      drawAgents(ctx, state, t, aim);

      ctx.restore();
    },
  };
}
