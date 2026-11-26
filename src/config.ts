/**
 * Parâmetros de jogo. Mexa à vontade pra testar o "fun".
 * Unidades: distâncias em pixels de mundo, tempos em segundos, velocidades em px/s.
 */

/** 'street': o tiro sai pra frente seguindo a rua. 'free': linha reta na direção do mouse. */
export type ShotMode = 'street' | 'free';

export interface Config {
  // --- mapa procedural -------------------------------------------------------
  /** Colunas da grade de cruzamentos. */
  cols: number;
  /** Linhas da grade de cruzamentos. */
  rows: number;
  /** Distância média entre cruzamentos vizinhos. */
  sp: number;
  /** Quanto cada cruzamento interno é deslocado (fração de `sp`). */
  jit: number;
  /** Chance de manter cada rua da grade (as removidas só voltam se isolarem o mapa). */
  keepEdge: number;
  /** Chance de cada quarteirão ganhar uma rua diagonal. */
  diag: number;
  /** Chance de um quarteirão ser um parque (só muda a cor). */
  parkP: number;
  /** Quarteirões menores que isso (em px²) são ignorados. Depende da escala do mapa. */
  minFaceArea: number;

  // --- movimento -------------------------------------------------------------
  /** Velocidade do jogador. */
  speed: number;
  /** Velocidade dos bots. */
  botSpeed: number;
  /** Multiplicador de velocidade quando se está andando em território próprio. */
  ownBonus: number;

  // --- partida ---------------------------------------------------------------
  /** Máximo de bandeiras na cadeia de cada jogador. */
  maxFlags: number;
  /** Quantidade de bots (máximo 3: há 4 cantos de spawn). */
  botCount: number;
  /** Duração da partida. */
  round: number;
  /** Porcentagem do mapa que encerra a partida com vitória antecipada. */
  winPct: number;
  /** Distância máxima do cruzamento pra conseguir fincar uma bandeira. */
  plantReach: number;

  // --- tiro ------------------------------------------------------------------
  shotMode: ShotMode;
  /** (free) velocidade do projétil. */
  bulletSpeed: number;
  /** (free) alcance do projétil. */
  bulletRange: number;
  /** Recarga do jogador. */
  shotCd: number;
  /** Recarga dos bots. */
  botShotCd: number;
  /** (free) erro de mira dos bots, em radianos. */
  botAimErr: number;
  /** (free) distância máxima em que um bot enxerga alvos. */
  botSight: number;
  /** (street) alcance do tiro pela rua. */
  streetRange: number;
  /** (street) velocidade do projétil. */
  streetBulletSpeed: number;
  /** (street) curva máxima, em graus, que o tiro aceita ao passar por um cruzamento. */
  streetMaxTurn: number;

  // --- combate e regras ------------------------------------------------------
  /** Raio de acerto de um tiro num agente. */
  hitR: number;
  /** Raio em que encostar numa bandeira inimiga destrói a cadeia dela. */
  flagR: number;
  /** Tempo morto até renascer. */
  respawn: number;
  /** Invulnerabilidade depois de renascer. */
  invuln: number;

  // --- bots ------------------------------------------------------------------
  /** 'smart': cada bot tem uma personalidade e reage ao jogo. 'classic': todos iguais, sem reação (comportamento antigo). */
  botBrain: 'smart' | 'classic';
  /** Perímetro máximo (em px) de um laço planejado por um bot (multiplicado por `loopMul` da personalidade). */
  botMaxLoop: number;
  /** Só considera bandeiras inimigas a até essa distância de rua. */
  botFlagRange: number;
  /** Um inimigo a menos que isso (px) de uma bandeira plantada de um bot aciona a defesa. */
  botDefendRange: number;
  /** Quantos passos de rota um bot dá a cada vez que vai interceptar um inimigo. */
  botInterceptSteps: number;
}

/**
 * Jeito de jogar de um bot. Todos os campos são "o quanto", então dá pra criar
 * variações misturando valores. `CLASSIC` reproduz o comportamento original.
 */
export interface Personality {
  label: string;
  /** Multiplica `botMaxLoop`: laços maiores rendem mais, mas deixam as bandeiras expostas por mais tempo. */
  loopMul: number;
  /** Quantos laços aleatórios avalia ao planejar uma conquista. */
  planTries: number;
  /** Quanto penaliza laços com inimigos perto das bandeiras (0 = ignora o risco). */
  riskWeight: number;
  /** Multiplicador do ganho de quarteirões que já são de outro (1 = sem preferência por roubar). */
  stealBonus: number;
  /** Atenção extra ao líder do placar ao roubar, caçar bandeiras e perseguir (0 = ignora quem lidera). */
  leaderBias: number;
  /** Chance, ao decidir, de ir atrás de uma bandeira inimiga. */
  huntFlagP: number;
  /** Chance, ao decidir, de perseguir um inimigo (somada à de cima). */
  chaseP: number;
  /** Quantos passos da rota de perseguição ele segue antes de reavaliar. */
  chaseSteps: number;
  /** 0..1: chance de desviar quando a rua que ia pegar está na linha de fogo de alguém. */
  dodge: number;
  /** 0..1: chance de largar o plano e ir atrás de um inimigo que chegou perto das suas bandeiras. */
  defend: number;
}

export const CFG: Config = {
  cols: 13,
  rows: 9,
  sp: 96,
  jit: 0.2,
  keepEdge: 0.9,
  diag: 0.14,
  parkP: 0.12,
  minFaceArea: 150,

  speed: 150,
  botSpeed: 132,
  ownBonus: 1.2,

  maxFlags: 6,
  botCount: 3,
  round: 240,
  winPct: 50,
  plantReach: 30,

  shotMode: 'street',
  bulletSpeed: 700,
  bulletRange: 330,
  shotCd: 0.45,
  botShotCd: 1.0,
  botAimErr: 0.14,
  botSight: 250,
  streetRange: 300,
  streetBulletSpeed: 420,
  streetMaxTurn: 35,

  hitR: 12,
  flagR: 14,
  respawn: 3,
  invuln: 1.6,

  botBrain: 'smart',
  botMaxLoop: 950,
  botFlagRange: 700,
  botDefendRange: 120,
  botInterceptSteps: 2,
};

/** O comportamento original dos bots: sem reação, sem risco, todos iguais. */
export const CLASSIC: Personality = {
  label: 'clássico',
  loopMul: 1,
  planTries: 14,
  riskWeight: 0,
  stealBonus: 1.3,
  leaderBias: 0,
  huntFlagP: 0.35,
  chaseP: 0.15,
  chaseSteps: 2,
  dodge: 0,
  defend: 0,
};

/**
 * Base dos bots 'smart': a média de duas buscas evolutivas (`npm run evolve`) que partiram de pontos bem diferentes
 * (do guloso e do clássico) e chegaram a regiões parecidas. Em partidas inéditas ganha ~83% contra o clássico e ~60%
 * contra a versão anterior do melhor bot. O que convergiu: planejar com ~50 tentativas, dar bastante peso ao risco,
 * preferir roubar, laços moderados e pouca caça a bandeiras. Detalhes em docs/BOTS.md.
 */
const SMART: Personality = {
  ...CLASSIC,
  label: 'inteligente',
  loopMul: 1.2,
  planTries: 50,
  riskWeight: 2.1,
  stealBonus: 1.5,
  leaderBias: 0.5,
  huntFlagP: 0.1,
  chaseP: 0.1,
  chaseSteps: 1,
  dodge: 0.6,
  defend: 0.3,
};

/** Vai atrás de bandeiras e de quem lidera, persegue de leve e defende as próprias bandeiras de quem se aproxima. */
export const HUNTER: Personality = {
  ...SMART,
  label: 'caçador',
  leaderBias: 1,
  huntFlagP: 0.25,
  chaseP: 0.12,
  chaseSteps: 2,
  defend: 0.45,
};

/** Laços menores e bem longe dos inimigos, e quase sempre desvia de tiro. */
export const CAUTIOUS: Personality = {
  ...SMART,
  label: 'cauteloso',
  loopMul: 1.05,
  riskWeight: 2.8,
  dodge: 0.9,
};

/** Laços grandes: busca muito território de uma vez. */
export const GREEDY: Personality = {
  ...SMART,
  label: 'guloso',
  loopMul: 1.35,
  stealBonus: 1.6,
};

/** Personalidade de cada bot quando `CFG.botBrain` é 'smart', na ordem dos ids 1, 2, 3. */
export const BOT_LINEUP: Personality[] = [HUNTER, CAUTIOUS, GREEDY];

/** Times, na ordem dos ids de agente: 0 é o jogador humano. */
export const TEAMS = [
  { name: 'Você', color: '#1a73e8' },
  { name: 'Vermelho', color: '#ea4335' },
  { name: 'Roxo', color: '#9334e6' },
  { name: 'Laranja', color: '#f29900' },
] as const;
