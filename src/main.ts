/**
 * Ponto de entrada: liga a simulação (game.ts) à tela, ao teclado/mouse e ao som,
 * e roda o laço principal. Toda a lógica de jogo fica nos outros módulos.
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

/** `?seed=123` na URL reproduz exatamente o mesmo mapa. */
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
      ? 'Ande com o joystick, toque na bandeira 🚩 nos cruzamentos e volte à 1ª pra cercar quarteirões'
      : 'Ande até um cruzamento, finque bandeiras (botão direito) e volte à 1ª pra cercar quarteirões',
    4200,
  );
  console.info(`Mapa gerado com seed ${seed} (use ?seed=${seed} na URL pra repetir)`);
}

/** Ações que teclado, mouse e toque disparam do mesmo jeito. */
const actions = {
  onRestart: () => startGame(randomSeed()),
  onToggleOverview: () => {
    camera.overview = !camera.overview;
  },
  onToggleMute: () => hud.say(sfx.toggleMute() ? 'Som desligado' : 'Som ligado', 900),
  onPlant: () => {
    if (state.over || !state.player.alive) return;
    const node = nodeNear(state.world, state.player, CFG.plantReach);
    if (node < 0) hud.say('Pare num cruzamento pra fincar a bandeira');
    else plant(state, state.player, node);
  },
};

const input = createInput(canvas, { ...actions, onZoom: (deltaY) => zoomBy(camera, deltaY) });
const touch = createTouchControls(actions);
document.getElementById('again')?.addEventListener('click', actions.onRestart);

// Navegadores de celular só liberam o som depois de um gesto da pessoa, e num toque o gesto que conta é soltar
// o dedo (pointerup), não pousar. Por isso tentamos a cada gesto; `unlock` é barato quando já está liberado.
for (const type of ['pointerup', 'keydown'] as const) addEventListener(type, () => sfx.unlock());

/** Telefone em pé: o jogo pausa até a pessoa girar o aparelho (o aviso é desenhado pelo CSS). */
const portrait = matchMedia('(orientation: portrait)');

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const aim = screenToWorld(camera, input.mouse.x, input.mouse.y, renderer.width, renderer.height);
  if (!(touch.active && portrait.matches)) {
    // O joystick, se estiver em uso, tem prioridade sobre o teclado.
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

// Gancho de depuração no console (só em desenvolvimento): __game.state, __game.CFG
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
