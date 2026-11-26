import { beforeEach, describe, expect, it } from 'vitest';
import type { Sfx, SfxKind } from '../src/audio/sfx';
import { createGame } from '../src/game';
import { closeLoop, destroyChain, kill, plant } from '../src/rules/territory';
import { handleEvents } from '../src/ui/feedback';
import type { Hud } from '../src/ui/hud';
import type { GameState } from '../src/types';
import { gridSource } from './helpers';

let state: GameState;
let said: string[];
let played: SfxKind[];
let ended: number;

const hud: Hud = {
  say: (m) => void said.push(m),
  update: () => {},
  showEnd: () => void ended++,
  hideEnd: () => {},
  setShotHint: () => {},
};
const sfx: Sfx = { unlock: () => {}, play: (k) => void played.push(k), toggleMute: () => false };

beforeEach(() => {
  state = createGame(1, { source: gridSource(5) });
  said = [];
  played = [];
  ended = 0;
});

describe('handleEvents', () => {
  it('esvazia a fila de eventos', () => {
    plant(state, state.player, 0);
    handleEvents(state, hud, sfx);
    expect(state.events).toEqual([]);
  });

  it('jogador fecha laço: som e mensagem com a porcentagem', () => {
    for (const n of [0, 1, 6, 5]) plant(state, state.player, n);
    closeLoop(state, state.player);
    handleEvents(state, hud, sfx);
    expect(played).toContain('claim');
    expect(said).toContain('Território fechado! +6.3%');
    expect(said).toContain('Agora volte à 1ª bandeira (botão direito) pra fechar o território');
  });

  it('avisa quando o jogador é atingido e quando derruba alguém', () => {
    const bot = state.agents[1];
    kill(state, state.player, bot);
    kill(state, bot, state.player);
    handleEvents(state, hud, sfx);
    expect(said).toEqual([`${bot.name} te acertou!`, `Você derrubou o ${bot.name}`]);
  });

  it('avisa quando a cadeia de alguém é destruída', () => {
    const bot = state.agents[1];
    bot.flags = [0, 1, 6];
    destroyChain(state, bot, state.player);
    state.player.flags = [2];
    destroyChain(state, state.player, bot);
    handleEvents(state, hud, sfx);
    expect(said).toEqual([`Você destruiu as bandeiras do ${bot.name}`, `${bot.name} destruiu suas bandeiras!`]);
  });

  it('sons de bots distantes não tocam; os de bots perto, sim', () => {
    const bot = state.agents[1];
    bot.x = state.player.x + 5000;
    plant(state, bot, 0);
    handleEvents(state, hud, sfx);
    expect(played).toEqual([]);

    bot.x = state.player.x + 10;
    bot.y = state.player.y;
    bot.flags = [];
    plant(state, bot, 1);
    handleEvents(state, hud, sfx);
    expect(played).toEqual(['plant']);
  });

  it('bandeira repetida só avisa o jogador humano', () => {
    plant(state, state.player, 0);
    plant(state, state.player, 0);
    plant(state, state.agents[1], 3);
    plant(state, state.agents[1], 3);
    handleEvents(state, hud, sfx);
    expect(said).toEqual(['Já tem bandeira sua aqui']);
  });

  it('chama a tela de fim quando a partida acaba', () => {
    state.events.push({ type: 'matchEnd' });
    handleEvents(state, hud, sfx);
    expect(ended).toBe(1);
  });
});
