/**
 * Entry point: connects the simulation (game.ts) to the screen, keyboard/mouse and sound,
 * and runs the main loop. All game logic lives in the other modules.
 */
import { CFG } from './config';
import { randomSeed } from './core/rng';
import { createSfx } from './audio/sfx';
import { nodeNear } from './entities/agent';
import { createGame, update } from './game';
import { createInput } from './input/input';
import { createTouchControls } from './input/touch';
import { createCamera, resetCamera, screenToWorld, updateCamera, zoomBy } from './render/camera';
import { createRenderer } from './render/renderer';
import { plant } from './rules/territory';
import { handleEvents } from './ui/feedback';
import { createHud } from './ui/hud';
import type { GameState } from './types';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = createRenderer(canvas);
const hud = createHud();
const sfx = createSfx();
const camera = createCamera();

/** `?seed=123` in the URL reproduces exactly the same map. */
function seedFromUrl(): number | null {
  const raw = new URLSearchParams(location.search).get('seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n >>> 0 : null;
}

let state: GameState;

function startGame(seed: number): void {
  state = createGame(seed);
  resetCamera(camera, state.player);
  hud.hideEnd();
  hud.setShotHint(CFG.shotMode);
  canvas.style.cursor = CFG.shotMode === 'street' ? 'default' : 'crosshair';
  hud.say(
    touch.active
      ? 'Walk with the joystick, tap the flag 🚩 at intersections and return to the 1st to enclose blocks'
      : 'Walk to an intersection, plant flags (right button) and return to the 1st to enclose blocks',
    4200,
  );
  console.info(`Map generated with seed ${seed} (use ?seed=${seed} in the URL to repeat it)`);
}

/** Actions that keyboard, mouse and touch trigger in the same way. */
const actions = {
  onRestart: () => startGame(randomSeed()),
  onToggleOverview: () => {
    camera.overview = !camera.overview;
  },
  onToggleMute: () => hud.say(sfx.toggleMute() ? 'Sound off' : 'Sound on', 900),
  onPlant: () => {
    if (state.over || !state.player.alive) return;
    const node = nodeNear(state.world, state.player, CFG.plantReach);
    if (node < 0) hud.say('Stop at an intersection to plant the flag');
    else plant(state, state.player, node);
  },
};

const input = createInput(canvas, { ...actions, onZoom: (deltaY) => zoomBy(camera, deltaY) });
const touch = createTouchControls(actions);
document.getElementById('again')?.addEventListener('click', actions.onRestart);

// Mobile browsers only unlock sound after a user gesture, and on a tap the gesture that counts is lifting
// the finger (pointerup), not touching down. So we try on every gesture; `unlock` is cheap once it's already unlocked.
for (const type of ['pointerup', 'keydown'] as const) addEventListener(type, () => sfx.unlock());

/** Phone upright: the game pauses until the person rotates the device (the notice is drawn by CSS). */
const portrait = matchMedia('(orientation: portrait)');

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const aim = screenToWorld(camera, input.mouse.x, input.mouse.y, renderer.width, renderer.height);
  if (!(touch.active && portrait.matches)) {
    // The joystick, if in use, takes priority over the keyboard.
    const stick = touch.dir();
    const dir = stick.x || stick.y ? stick : input.dir();
    update(state, dt, { dir, fire: input.firing() || touch.firing(), aim });
    handleEvents(state, hud, sfx);
  }
  updateCamera(camera, state, dt, renderer.width, renderer.height);
  renderer.render(state, camera, now / 1000, aim);

  requestAnimationFrame(frame);
}

startGame(seedFromUrl() ?? randomSeed());
setInterval(() => hud.update(state), 120);
requestAnimationFrame(frame);

// Debug hook in the console (development only): __game.state, __game.CFG
if (import.meta.env.DEV) {
  Object.defineProperty(window, '__game', {
    value: {
      get state() {
        return state;
      },
      CFG,
    },
  });
}
