/**
 * Traduz os eventos da simulação em som e mensagens na tela.
 * É a única ponte entre "o que aconteceu" e "como o jogador percebe".
 */
import { CFG } from '../config';
import type { Sfx } from '../audio/sfx';
import type { Agent, GameState } from '../types';
import type { Hud } from './hud';

/** Sons de bots só tocam se eles estiverem perto do jogador. */
const HEARING_RANGE = 320;

function audible(state: GameState, ag: Agent): boolean {
  if (ag.human) return true;
  const p = state.player;
  return Math.hypot(ag.x - p.x, ag.y - p.y) <= HEARING_RANGE;
}

/** Consome e trata todos os eventos pendentes de `state.events`. */
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
            ? 'Já tem bandeira sua aqui'
            : `Máximo de ${CFG.maxFlags} bandeiras – volte à primeira pra fechar`,
        );
        break;

      case 'loopReady':
        if (e.agent.human) hud.say('Agora volte à 1ª bandeira (botão direito) pra fechar o território');
        break;

      case 'claim':
        if (audible(state, e.agent)) sfx.play('claim');
        if (e.agent.human) hud.say(`Território fechado! +${pct(e.pct)}%`);
        else if (state.player.alive) hud.say(`${e.agent.name} tomou território (+${pct(e.pct)}%)`, 1600);
        break;

      case 'claimEmpty':
        if (e.agent.human) hud.say('Nada novo cercado');
        break;

      case 'chainDestroyed':
        if (audible(state, e.by)) sfx.play('break');
        if (e.owner.human) hud.say(`${e.by.name} destruiu suas bandeiras!`);
        else if (e.by.human) hud.say(`Você destruiu as bandeiras do ${e.owner.name}`);
        break;

      case 'kill':
        if (audible(state, e.victim)) sfx.play('kill');
        if (e.victim.human) hud.say(`${e.killer.name} te acertou!`);
        else if (e.killer.human) hud.say(`Você derrubou o ${e.victim.name}`, 1400);
        break;

      case 'matchEnd':
        hud.showEnd(state);
        break;
    }
  }
}
