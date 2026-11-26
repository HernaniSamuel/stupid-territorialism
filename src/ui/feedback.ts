/**
 * Turns simulation events into sound and on-screen messages.
 * It is the only bridge between "what happened" and "how the player perceives it".
 */
import { CFG } from '../config';
import type { Sfx } from '../audio/sfx';
import type { Agent, GameState } from '../types';
import type { Hud } from './hud';

/** Bot sounds only play if they are close to the player. */
const HEARING_RANGE = 320;

function audible(state: GameState, ag: Agent): boolean {
  if (ag.human) return true;
  const p = state.player;
  return Math.hypot(ag.x - p.x, ag.y - p.y) <= HEARING_RANGE;
}

/** Consumes and handles all pending events in `state.events`. */
export function handleEvents(state: GameState, hud: Hud, sfx: Sfx): void {
  const events = state.events.splice(0);
  const pct = (v: number) => v.toFixed(1);

  for (const e of events) {
    switch (e.type) {
      case 'shot':
        if (audible(state, e.agent)) sfx.play('shot');
        break;

      case 'plant':
        if (audible(state, e.agent)) sfx.play('plant');
        break;

      case 'plantRejected':
        if (!e.agent.human) break;
        hud.say(
          e.reason === 'duplicate'
            ? 'You already have a flag here'
            : `Maximum of ${CFG.maxFlags} flags – return to the first one to close`,
        );
        break;

      case 'loopReady':
        if (e.agent.human) hud.say('Now return to the 1st flag (right button) to close the territory');
        break;

      case 'claim':
        if (audible(state, e.agent)) sfx.play('claim');
        if (e.agent.human) hud.say(`Territory closed! +${pct(e.pct)}%`);
        else if (state.player.alive) hud.say(`${e.agent.name} took territory (+${pct(e.pct)}%)`, 1600);
        break;

      case 'claimEmpty':
        if (e.agent.human) hud.say('Nothing new enclosed');
        break;

      case 'chainDestroyed':
        if (audible(state, e.by)) sfx.play('break');
        if (e.owner.human) hud.say(`${e.by.name} destroyed your flags!`);
        else if (e.by.human) hud.say(`You destroyed the ${e.owner.name}'s flags`);
        break;

      case 'kill':
        if (audible(state, e.victim)) sfx.play('kill');
        if (e.victim.human) hud.say(`${e.killer.name} hit you!`);
        else if (e.killer.human) hud.say(`You took down the ${e.victim.name}`, 1400);
        break;

      case 'matchEnd':
        hud.showEnd(state);
        break;
    }
  }
}
