/**
 * Tipos compartilhados. Aqui só há dados: nenhuma função, nenhuma dependência.
 *
 * Convenção importante: um "nó" é um cruzamento e é sempre referido pelo seu
 * ÍNDICE em `World.nodes`. Uma "face" é um quarteirão, referida pelo índice em
 * `World.faces`. Os dois são `number`, então cuidado pra não confundir.
 */
import type { Personality } from './config';
import type { Rng } from './core/rng';

export interface Vec {
  x: number;
  y: number;
}

/** Cruzamento (ou ponta de rua). Chamado `GNode` pra não colidir com o `Node` do DOM. */
export type GNode = Vec;

/** Rua entre dois nós, por índice. */
export type Edge = [a: number, b: number];

/** Saída de uma fonte de mapa: só a geometria das ruas. */
export interface Graph {
  nodes: GNode[];
  edges: Edge[];
}

/** Rua saindo de um nó. */
export interface Neighbor {
  /** Nó do outro lado. */
  to: number;
  len: number;
  /** Ângulo da rua saindo do nó, em radianos. As listas são ordenadas por ele. */
  ang: number;
}

/** Quarteirão: região fechada por ruas. */
export interface Face {
  /** Nós do contorno, em ordem. */
  loop: number[];
  /** Mesmos pontos de `loop`, pra desenhar. */
  pts: GNode[];
  area: number;
  /** Ponto logo dentro do quarteirão, usado pra testar se um laço o contém. */
  probe: Vec;
  /** Id do agente dono, ou -1. */
  owner: number;
  /** 0..1, brilho de captura recente (só visual). */
  flash: number;
  park: boolean;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface ShortestPaths {
  dist: Float64Array;
  /** Nó anterior no caminho mínimo desde a origem, ou -1. */
  prev: Int32Array;
}

/** O mapa pronto pra jogar: grafo de ruas + quarteirões + caches. */
export interface World {
  nodes: GNode[];
  edges: Edge[];
  adj: Neighbor[][];
  faces: Face[];
  /** Meia-aresta (a→b, chave `a*N+b`) → índice da face à sua esquerda. */
  halfEdgeFace: Map<number, number>;
  totalArea: number;
  bounds: Bounds;
  /** Cache de caminhos mínimos por nó de origem. */
  paths: Map<number, ShortestPaths>;
}

/** -1: andando de `b` pra `a`; 0: parado; 1: andando de `a` pra `b`. */
export type Dir = -1 | 0 | 1;

/** Algo que anda numa rua: de `a` pra `b`, a `d` pixels de `a`. */
export interface Walker extends Vec {
  a: number;
  b: number;
  d: number;
  mv: Dir;
}

export interface Agent extends Walker {
  id: number;
  human: boolean;
  name: string;
  color: string;
  /** Jeito de jogar (só os bots usam; no humano é ignorado). */
  persona: Personality;
  /** Nó de spawn inicial. */
  base: number;
  vx: number;
  vy: number;
  /** Ângulo do desenho (suavizado). */
  ang: number;
  alive: boolean;
  respawnT: number;
  /** Invulnerabilidade restante. */
  invT: number;
  /** Recarga restante do tiro. */
  cd: number;
  kills: number;
  deaths: number;
  /** Nós com bandeira, na ordem em que foram fincadas. */
  flags: number[];
  /** (bots) nós a percorrer até o destino imediato. */
  route: number[];
  /** (bots) bandeiras a fincar, terminando na primeira pra fechar o laço. */
  plan: number[];
  /** Último sentido de movimento (1 ou -1); define pra onde o tiro sai. */
  face: 1 | -1;
}

export interface StreetBullet extends Walker {
  kind: 'street';
  /** Posição no passo anterior (pra colisão por segmento). */
  px: number;
  py: number;
  /** Distância restante. */
  left: number;
  life: number;
  owner: Agent;
  /** Rastro recente, pra desenhar. */
  tr: Vec[];
}

export interface FreeBullet extends Vec {
  kind: 'free';
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  owner: Agent;
}

export type Bullet = StreetBullet | FreeBullet;

export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/**
 * Fatos que aconteceram na simulação. A simulação só os publica em
 * `GameState.events`; quem decide o que fazer (som, mensagem na tela) é a camada de UI.
 */
export type GameEvent =
  | { type: 'shot'; agent: Agent }
  | { type: 'plant'; agent: Agent }
  | { type: 'plantRejected'; agent: Agent; reason: 'duplicate' | 'maxFlags' }
  /** O agente chegou a 3 bandeiras: já dá pra fechar o laço. */
  | { type: 'loopReady'; agent: Agent }
  /** Laço fechado que rendeu território. `pct` = % do mapa ganho. */
  | { type: 'claim'; agent: Agent; pct: number }
  | { type: 'claimEmpty'; agent: Agent }
  | { type: 'chainDestroyed'; owner: Agent; by: Agent }
  | { type: 'kill'; victim: Agent; killer: Agent }
  | { type: 'matchEnd' };

/** O que o jogador humano está pedindo neste frame. */
export interface PlayerCommand {
  /** Direção desejada, normalizada (ou 0,0). */
  dir: Vec;
  fire: boolean;
  /** Ponto do mundo mirado (só importa no modo 'free'). */
  aim: Vec;
}

export interface GameState {
  seed: number;
  rng: Rng;
  world: World;
  agents: Agent[];
  /** O agente humano (sempre `agents[0]`). */
  player: Agent;
  bullets: Bullet[];
  particles: Particle[];
  timeLeft: number;
  over: boolean;
  /** Fila de eventos ainda não consumidos pela UI. */
  events: GameEvent[];
}
