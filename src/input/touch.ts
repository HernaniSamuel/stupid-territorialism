/**
 * Touch controls (phone/tablet, landscape): floating joystick on the left, shoot and
 * plant-flag buttons on the right, and small map, sound, restart and fullscreen buttons.
 *
 * They produce the same things as the keyboard (direction, "shooting", actions), so the simulation
 * doesn't know the difference. The controls' HTML is in index.html; the look is in styles/touch.css.
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
  /** Joystick direction (unit) or (0, 0). */
  dir(): Vec;
  /** Is the shoot button pressed? */
  firing(): boolean;
  /** Does the device use touch (controls visible)? */
  readonly active: boolean;
}

/** Joystick radius in px: how far the knob can travel. */
const STICK_RADIUS = 56;

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found in the HTML`);
  return e;
}

/**
 * Binds a button via pointer events: `onPress` runs on touch. The ids of the fingers that are
 * holding it are kept in `held` (if given), to know whether the button is still pressed, even
 * with several fingers at once (walk with one thumb and shoot with the other).
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
  // Touch device from the start; hybrid device (laptop with touchscreen) enables it on the first touch.
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') enable();
    },
    { capture: true },
  );

  // iPhone Safari ignores `user-scalable=no`: pinch zoom has to be blocked here.
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Holding a finger must not open the context menu or select anything.
  el('touch').addEventListener('contextmenu', (e) => e.preventDefault());

  // --- floating joystick: appears wherever the thumb lands, in the left half of the screen ---
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
    if (stickId !== -1) return; // a finger is already on the joystick
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

  // --- buttons ---
  const fireHeld = new Set<number>();
  bindButton(el('btnFire'), undefined, fireHeld);
  bindButton(el('btnPlant'), actions.onPlant);
  bindButton(el('btnMap'), actions.onToggleOverview);
  bindButton(el('btnSound'), actions.onToggleMute);
  bindButton(el('btnRestart'), actions.onRestart);

  // Fullscreen: hides the browser bar and (on Android) allows locking to landscape.
  // Must be requested on a `click`: it's a gesture the browser accepts for this (a touch pointerdown isn't).
  const full = el('btnFull');
  full.hidden = !document.fullscreenEnabled;
  full.addEventListener('click', () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen().then(
      () => {
        // `lock` is not in the TypeScript types; only some browsers (Android) accept it.
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
