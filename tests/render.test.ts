import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CFG } from '../src/config';
import { shoot } from '../src/entities/bullets';
import { createGame, update } from '../src/game';
import { autoZoom, createCamera, screenToWorld, updateCamera, zoomBy } from '../src/render/camera';
import { createRenderer } from '../src/render/renderer';
import { plant } from '../src/rules/territory';
import type { PlayerCommand } from '../src/types';

/** Fake 2D context: accepts any call/assignment and only records the method names. */
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
  it.each(['street', 'free'] as const)('draws all layers without error (mode %s)', (mode) => {
    CFG.shotMode = mode;
    const state = createGame(9);
    for (let t = 0; t < 40; t += 1 / 30) update(state, 1 / 30, IDLE);
    // Put what the drawing needs to show: fence under construction, flags, shot, particles.
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

  it('also draws in the overview and after the match ends', () => {
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

describe('camera', () => {
  it('zoom respects the limits and leaves the overview', () => {
    const cam = createCamera();
    cam.overview = true;
    for (let i = 0; i < 100; i++) zoomBy(cam, -1);
    expect(cam.zoomTarget).toBe(2.2);
    expect(cam.overview).toBe(false);
    for (let i = 0; i < 100; i++) zoomBy(cam, 1);
    expect(cam.zoomTarget).toBe(0.6);
  });

  it('the default zoom follows the screen height: phone in landscape zooms out, monitor keeps it', () => {
    expect(autoZoom(1080)).toBe(1.35);
    expect(autoZoom(720)).toBe(1.35);
    expect(autoZoom(390)).toBeCloseTo(0.75);
    expect(autoZoom(200)).toBe(0.75); // never less than the minimum
    expect(autoZoom(450)).toBeGreaterThan(autoZoom(390));
  });

  it('the camera follows the automatic zoom until the person changes the zoom', () => {
    const state = createGame(2);
    const cam = createCamera();
    updateCamera(cam, state, 1 / 30, 844, 390);
    expect(cam.zoomTarget).toBeCloseTo(0.75);
    updateCamera(cam, state, 1 / 30, 1920, 1080);
    expect(cam.zoomTarget).toBe(1.35); // the window grew: follows
    zoomBy(cam, -1); // the person changed it: from here on the zoom is theirs
    const chosen = cam.zoomTarget;
    updateCamera(cam, state, 1 / 30, 844, 390);
    expect(cam.zoomTarget).toBe(chosen);
  });

  it('screenToWorld: the center of the screen is the camera point', () => {
    const cam = createCamera();
    cam.x = 300;
    cam.y = 200;
    expect(screenToWorld(cam, 640, 360, 1280, 720)).toEqual({ x: 300, y: 200 });
    const p = screenToWorld(cam, 640 + cam.zoom * 10, 360, 1280, 720);
    expect(p.x).toBeCloseTo(310);
  });
});
