/** Teclado e mouse. Só guarda o que está pressionado; quem age é quem registrou os callbacks. */
import type { Vec } from '../types';

export interface InputCallbacks {
  onRestart(): void;
  onToggleOverview(): void;
  onToggleMute(): void;
  /** Botão direito: tentar fincar bandeira. */
  onPlant(): void;
  /** Roda do mouse (`deltaY` > 0 afasta). */
  onZoom(deltaY: number): void;
}

export interface Input {
  /** Direção WASD/setas, normalizada (ou 0,0). */
  dir(): Vec;
  /** Espaço ou botão esquerdo pressionado. */
  firing(): boolean;
  /** Posição do mouse em pixels de tela. */
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
  // Toques não devem virar "cliques de mouse" falsos (o navegador gera esses cliques depois do toque,
  // e eles disparariam o tiro). Quem cuida dos toques é o input/touch.ts.
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
