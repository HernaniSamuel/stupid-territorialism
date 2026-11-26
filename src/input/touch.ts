/**
 * Controles de toque (telefone/tablet, deitado): joystick flutuante à esquerda, botões de
 * atirar e fincar bandeira à direita, e botões pequenos de mapa, som, reiniciar e tela cheia.
 *
 * Gera as mesmas coisas que o teclado (direção, "atirando", ações), então a simulação não
 * sabe a diferença. O HTML dos controles está em index.html; o visual, em styles/touch.css.
 */
import type { Vec } from '../types';
import { clampToRadius, stickDirection } from './stick';

export interface TouchActions {
  onPlant(): void;
  onToggleOverview(): void;
  onToggleMute(): void;
  onRestart(): void;
}

export interface TouchControls {
  /** Direção do joystick (unitária) ou (0, 0). */
  dir(): Vec;
  /** O botão de atirar está pressionado? */
  firing(): boolean;
  /** O aparelho usa toque (controles visíveis)? */
  readonly active: boolean;
}

/** Raio do joystick em px: até onde a bolinha vai. */
const STICK_RADIUS = 56;

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Elemento #${id} não encontrado no HTML`);
  return e;
}

/**
 * Liga um botão por pointer events: `onPress` roda ao tocar. Os ids dos dedos que estão
 * segurando ficam em `held` (se informado), pra saber se o botão segue pressionado, inclusive
 * com vários dedos ao mesmo tempo (andar com um polegar e atirar com o outro).
 */
function bindButton(btn: HTMLElement, onPress?: () => void, held?: Set<number>): void {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    btn.classList.add('down');
    held?.add(e.pointerId);
    onPress?.();
  });
  const release = (e: Event) => {
    const id = (e as PointerEvent).pointerId;
    held?.delete(id);
    if (!held || held.size === 0) btn.classList.remove('down');
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, release);
}

export function createTouchControls(actions: TouchActions): TouchControls {
  const root = document.documentElement;
  let active = false;
  const enable = () => {
    if (active) return;
    active = true;
    root.classList.add('touch');
  };
  // Aparelho de toque de cara; aparelho híbrido (notebook com tela) ativa no primeiro toque.
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') enable();
    },
    { capture: true },
  );

  // O Safari do iPhone ignora o `user-scalable=no`: o zoom por pinça precisa ser barrado aqui.
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Segurar o dedo não pode abrir menu de contexto nem selecionar nada.
  el('touch').addEventListener('contextmenu', (e) => e.preventDefault());

  // --- joystick flutuante: aparece onde o polegar pousar, na metade esquerda da tela ---
  const zone = el('stickZone');
  const base = el('stickBase');
  const knob = el('stickKnob');
  let stickId = -1;
  let origin: Vec = { x: 0, y: 0 };
  let direction: Vec = { x: 0, y: 0 };

  const moveStick = (e: PointerEvent) => {
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    direction = stickDirection(dx, dy, STICK_RADIUS);
    const k = clampToRadius(dx, dy, STICK_RADIUS);
    knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
  };
  const endStick = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1;
    direction = { x: 0, y: 0 };
    base.classList.remove('on');
    knob.style.transform = 'translate(0px, 0px)';
  };

  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== -1) return; // já há um dedo no joystick
    e.preventDefault();
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    origin = { x: e.clientX, y: e.clientY };
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
    base.classList.add('on');
    moveStick(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(type, (e) => endStick(e as PointerEvent));
  }

  // --- botões ---
  const fireHeld = new Set<number>();
  bindButton(el('btnFire'), undefined, fireHeld);
  bindButton(el('btnPlant'), actions.onPlant);
  bindButton(el('btnMap'), actions.onToggleOverview);
  bindButton(el('btnSound'), actions.onToggleMute);
  bindButton(el('btnRestart'), actions.onRestart);

  // Tela cheia: esconde a barra do navegador e (no Android) permite travar em paisagem.
  // Precisa ser pedida num `click`: é um gesto que o navegador aceita pra isso (pointerdown de toque, não).
  const full = el('btnFull');
  full.hidden = !document.fullscreenEnabled;
  full.addEventListener('click', () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen().then(
      () => {
        // `lock` não está nos tipos do TypeScript; só alguns navegadores (Android) o aceitam.
        const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
        void orientation.lock?.('landscape')?.catch(() => {});
      },
      () => {},
    );
  });

  return {
    dir: () => direction,
    firing: () => fireHeld.size > 0,
    get active() {
      return active;
    },
  };
}
