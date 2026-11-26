import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CFG } from '../src/config';
import { shoot } from '../src/entities/bullets';
import { createGame, update } from '../src/game';
import { autoZoom, createCamera, screenToWorld, updateCamera, zoomBy } from '../src/render/camera';
import { createRenderer } from '../src/render/renderer';
import { plant } from '../src/rules/territory';
import type { PlayerCommand } from '../src/types';

/** Contexto 2D falso: aceita qualquer chamada/atribuição e só registra os nomes dos métodos. */
function fakeCanvas() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => (typeof prop === 'string' ? (..._a: unknown[]) => void calls.push(prop) : undefined),
      set: () => true,
    },
  );
  const canvas = { width: 0, height: 0, getContext: () => ctx, style: {} } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

const IDLE: PlayerCommand = { dir: { x: 0, y: 0 }, fire: false, aim: { x: 0, y: 0 } };

beforeEach(() => {
  vi.stubGlobal('addEventListener', () => {});
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('innerHeight', 720);
  vi.stubGlobal('devicePixelRatio', 2);
});
afterEach(() => {
  vi.unstubAllGlobals();
  CFG.shotMode = 'street';
});

describe('renderer', () => {
  it.each(['street', 'free'] as const)('desenha todas as camadas sem erro (modo %s)', (mode) => {
    CFG.shotMode = mode;
    const state = createGame(9);
    for (let t = 0; t < 40; t += 1 / 30) update(state, 1 / 30, IDLE);
    // Coloca o que o desenho precisa mostrar: cerca em construção, bandeiras, tiro, partículas.
    for (const n of [0, 1, 14]) plant(state, state.player, n);
    state.player.cd = 0;
    shoot(state, state.player, 100, 100);
    state.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, color: '#fff' });

    const { canvas, calls } = fakeCanvas();
    const renderer = createRenderer(canvas);
    expect(canvas.width).toBe(2560); // 1280 * dpr
    expect(renderer.width).toBe(1280);

    const cam = createCamera();
    updateCamera(cam, state, 0.1, renderer.width, renderer.height);
    renderer.render(state, cam, 1.5, { x: 50, y: 50 });

    expect(calls.filter((c) => c === 'save')).toHaveLength(calls.filter((c) => c === 'restore').length);
    expect(calls.filter((c) => c === 'fill').length).toBeGreaterThan(state.world.faces.length);
    expect(calls).toContain('stroke');
    expect(calls).toContain('setLineDash');
  });

  it('também desenha na visão geral e depois do fim da partida', () => {
    const state = createGame(4);
    state.over = true;
    const { canvas } = fakeCanvas();
    const renderer = createRenderer(canvas);
    const cam = createCamera();
    cam.overview = true;
    for (let i = 0; i < 60; i++) updateCamera(cam, state, 1 / 30, renderer.width, renderer.height);
    expect(cam.x).toBeCloseTo(state.world.bounds.cx, 0);
    expect(() => renderer.render(state, cam, 0, { x: 0, y: 0 })).not.toThrow();
  });
});

describe('câmera', () => {
  it('zoom respeita os limites e sai da visão geral', () => {
    const cam = createCamera();
    cam.overview = true;
    for (let i = 0; i < 100; i++) zoomBy(cam, -1);
    expect(cam.zoomTarget).toBe(2.2);
    expect(cam.overview).toBe(false);
    for (let i = 0; i < 100; i++) zoomBy(cam, 1);
    expect(cam.zoomTarget).toBe(0.6);
  });

  it('o zoom padrão acompanha a altura da tela: telefone deitado afasta, monitor mantém', () => {
    expect(autoZoom(1080)).toBe(1.35);
    expect(autoZoom(720)).toBe(1.35);
    expect(autoZoom(390)).toBeCloseTo(0.75);
    expect(autoZoom(200)).toBe(0.75); // nunca menos que o mínimo
    expect(autoZoom(450)).toBeGreaterThan(autoZoom(390));
  });

  it('a câmera segue o zoom automático até a pessoa mexer no zoom', () => {
    const state = createGame(2);
    const cam = createCamera();
    updateCamera(cam, state, 1 / 30, 844, 390);
    expect(cam.zoomTarget).toBeCloseTo(0.75);
    updateCamera(cam, state, 1 / 30, 1920, 1080);
    expect(cam.zoomTarget).toBe(1.35); // a janela cresceu: acompanha
    zoomBy(cam, -1); // a pessoa mexeu: a partir daqui o zoom é dela
    const chosen = cam.zoomTarget;
    updateCamera(cam, state, 1 / 30, 844, 390);
    expect(cam.zoomTarget).toBe(chosen);
  });

  it('screenToWorld: o centro da tela é o ponto da câmera', () => {
    const cam = createCamera();
    cam.x = 300;
    cam.y = 200;
    expect(screenToWorld(cam, 640, 360, 1280, 720)).toEqual({ x: 300, y: 200 });
    const p = screenToWorld(cam, 640 + cam.zoom * 10, 360, 1280, 720);
    expect(p.x).toBeCloseTo(310);
  });
});
