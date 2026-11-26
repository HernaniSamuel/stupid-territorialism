/** HTML HUD: scoreboard, clock, flags, messages and end screen. The ids come from index.html. */
import { CFG, type ShotMode } from '../config';
import { standings } from '../rules/match';
import type { GameState } from '../types';

export interface Hud {
  /** Shows a short message at the top, for `ms` milliseconds. */
  say(msg: string, ms?: number): void;
  /** Redraws the scoreboard, clock, flags and the "respawns in" notice. */
  update(state: GameState): void;
  showEnd(state: GameState): void;
  hideEnd(): void;
  /** Adjusts the shooting control hint according to the mode. */
  setShotHint(mode: ShotMode): void;
}

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found in the HTML`);
  return e;
}

export function createHud(): Hud {
  const board = el('board');
  const timer = el('timer');
  const pips = el('pips');
  const dead = el('dead');
  const toast = el('toast');
  const endBox = el('end');
  const endTitle = el('endT');
  const endList = el('endL');
  const shotHint = el('hintShoot');
  let toastTimer = 0;

  return {
    say(msg, ms = 2400) {
      toast.textContent = msg;
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('on'), ms);
    },

    update(state) {
      const rows = standings(state);
      // Names and colors come from code constants, never from the user: innerHTML is safe here.
      board.innerHTML =
        '<h4>Territory</h4>' +
        rows
          .map(
            (r) =>
              `<div class="row ${r.agent.human ? 'me' : ''}"><svg width="14" height="14" viewBox="0 0 20 20"><path d="M18 10 3 18 3 2z" fill="${r.agent.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="nm">${r.agent.name}<span class="kd">${r.agent.kills}☠ ${r.agent.deaths}†</span></span><span class="pc">${r.pct.toFixed(0)}%</span><div class="bar"><i style="width:${Math.min(100, r.pct * 2)}%;background:${r.agent.color}"></i></div></div>`,
          )
          .join('');

      const m = Math.floor(state.timeLeft / 60);
      const s = Math.floor(state.timeLeft % 60);
      timer.textContent = m + ':' + String(s).padStart(2, '0');

      const { player } = state;
      pips.style.setProperty('--c', player.color);
      pips.innerHTML =
        '<span style="margin-right:4px">Flags</span>' +
        Array.from({ length: CFG.maxFlags }, (_, i) => `<i class="${i < player.flags.length ? 'on' : ''}"></i>`).join('');

      if (!player.alive && !state.over) {
        dead.style.display = 'block';
        dead.textContent = 'Respawns in ' + Math.ceil(player.respawnT);
      } else dead.style.display = 'none';
    },

    showEnd(state) {
      const rows = standings(state);
      endTitle.textContent = rows[0].agent.human ? 'You won! 🏆' : 'Victory of ' + rows[0].agent.name;
      endList.innerHTML = rows
        .map(
          (r, i) =>
            `<div class="row ${r.agent.human ? 'me' : ''}" style="grid-template-columns:20px 1fr 50px"><span>${i + 1}.</span><span class="nm" style="color:${r.agent.color}">${r.agent.name}</span><span class="pc">${r.pct.toFixed(1)}%</span></div>`,
        )
        .join('');
      endBox.style.display = 'flex';
    },

    hideEnd() {
      endBox.style.display = 'none';
    },

    setShotHint(mode) {
      shotHint.innerHTML =
        mode === 'street'
          ? '<b>space/left click</b> shoot forward along the street (<b>S</b> reverses)'
          : '<b>mouse</b> aim · <b>click/space</b> shoot';
    },
  };
}
