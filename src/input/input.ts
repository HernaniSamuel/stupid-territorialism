/** Keyboard and mouse. Only stores what is pressed; whoever registered the callbacks does the acting. */
import type { Vec } from '../types';

export interface InputCallbacks {
  onRestart(): void;
  onToggleOverview(): void;
  onToggleMute(): void;
  /** Right button: try to plant a flag. */
  onPlant(): void;
  /** Mouse wheel (`deltaY` > 0 zooms out). */
  onZoom(deltaY: number): void;
}

export interface Input {
  /** WASD/arrow direction, normalized (or 0,0). */
  dir(): Vec;
  /** Space or left button pressed. */
  firing(): boolean;
  /** Mouse position in screen pixels. */
  readonly mouse: Vec;
}

export function createInput(canvas: HTMLCanvasElement, cb: InputCallbacks): Input {
  const keys: Record<string, boolean> = {};
  const mouse: Vec = { x: 0, y: 0 };
  let mouseDown = false;

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyR') cb.onRestart();
    if (e.code === 'KeyM') cb.onToggleOverview();
    if (e.code === 'KeyN') cb.onToggleMute();
  });
  addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  addEventListener('mouseup', () => {
    mouseDown = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Touches must not turn into fake "mouse clicks" (the browser generates those clicks after a touch,
  // and they would fire a shot). input/touch.ts takes care of touches.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') e.preventDefault();
  });
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) cb.onPlant();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cb.onZoom(e.deltaY);
    },
    { passive: false },
  );

  return {
    dir() {
      const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      const m = Math.hypot(x, y);
      return m ? { x: x / m, y: y / m } : { x: 0, y: 0 };
    },
    firing: () => mouseDown || !!keys.Space,
    mouse,
  };
}
