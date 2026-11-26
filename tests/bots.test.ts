import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { botPick } from '../src/ai/bot';
import { chainThreat, edgeExposed, incomingFire } from '../src/ai/perception';
import { planClaim } from '../src/ai/planner';
import { CFG, CLASSIC, GREEDY, HUNTER, type Personality } from '../src/config';
import { place } from '../src/entities/agent';
import { traceShot, tracePath } from '../src/entities/bullets';
import { createGame } from '../src/game';
import { leader } from '../src/rules/match';
import type { Agent, GameState } from '../src/types';
import { gridSource } from './helpers';

// Grade 5x5, espaçamento 100. Índice = linha*5 + coluna:
//    0  1  2  3  4        y=0
//    5  6  7  8  9        y=100
//   10 11 12 13 14        y=200
//   15 16 17 18 19        y=300
//   20 21 22 23 24        y=400
const personas = (bot: Personality): Personality[] => [CLASSIC, bot, CLASSIC, CLASSIC];

let state: GameState;
let shooter: Agent;
let bot: Agent;

/** Põe o agente exatamente sobre o nó, virado pro sentido de `a` → `b`. */
function standAt(ag: Agent, a: number, b: number): void {
  ag.a = a;
  ag.b = b;
  ag.d = state.world.adj[a].find((e) => e.to === b)!.len;
  ag.mv = 0;
  ag.face = 1;
  place(state.world, ag);
}

function setup(botPersona: Personality, source = gridSource(5)): void {
  state = createGame(1, { source, personalities: personas(botPersona) });
  [shooter, bot] = [state.agents[0], state.agents[1]];
  for (const o of state.agents.slice(2)) o.alive = false; // só o atirador e o bot em cena
  shooter.cd = 0;
}

describe('linha de fogo', () => {
  beforeEach(() => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11); // no nó 11 (x=100,y=200), virado pra direita: o tiro corre pela linha y=200
  });

  it('um inimigo pronto pra atirar gera uma linha de fogo; um recém-atirado, não', () => {
    expect(incomingFire(state, bot)).toHaveLength(1);
    shooter.cd = 1;
    expect(incomingFire(state, bot)).toHaveLength(0);
  });

  it('tiros em voo contam, exceto os do próprio bot', () => {
    shooter.cd = 1;
    state.bullets.push({ kind: 'street', a: 11, b: 12, d: 10, mv: 1, x: 110, y: 200, px: 110, py: 200, left: 200, life: 1, owner: shooter, tr: [] });
    state.bullets.push({ kind: 'street', a: 6, b: 11, d: 10, mv: 1, x: 100, y: 110, px: 100, py: 110, left: 200, life: 1, owner: bot, tr: [] });
    expect(incomingFire(state, bot)).toHaveLength(1);
  });

  it('andar ao longo da linha é perigoso; sair de lado, não', () => {
    const lines = incomingFire(state, bot);
    expect(edgeExposed(state.world, 13, 14, lines)).toBe(true); // pra frente, na linha
    expect(edgeExposed(state.world, 13, 12, lines)).toBe(true); // de volta, na linha
    expect(edgeExposed(state.world, 13, 8, lines)).toBe(false); // lateral
    expect(edgeExposed(state.world, 13, 18, lines)).toBe(false);
  });

  it('apenas cruzar a linha não conta como exposição', () => {
    // 7 → 12 desce até a linha y=200 e termina nela: toca só uma amostra.
    expect(edgeExposed(state.world, 7, 12, incomingFire(state, bot))).toBe(false);
  });

  it('só o modo street tem linhas de fogo que seguem as ruas', () => {
    CFG.shotMode = 'free';
    try {
      expect(incomingFire(state, bot)).toEqual([]);
    } finally {
      CFG.shotMode = 'street';
    }
  });

  it('tracePath não altera o ponto de partida e traceShot é o caso particular', () => {
    const start = { a: shooter.a, b: shooter.b, d: shooter.d, mv: 1 as const, x: shooter.x, y: shooter.y };
    const copy = { ...start };
    const pts = tracePath(state.world, start, CFG.streetRange);
    expect(start).toEqual(copy);
    expect(pts).toEqual(traceShot(state.world, shooter));
    expect(pts.length).toBeGreaterThan(5);
  });
});

describe('desvio de tiro', () => {
  it('troca uma rua exposta por uma lateral e descarta a rota', () => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11);
    bot.route = [14];
    const next = botPick(state, bot, 13);
    expect([8, 18]).toContain(next);
    expect(bot.route).toEqual([]);
  });

  it('sem a habilidade de desviar, segue em frente', () => {
    setup(CLASSIC);
    standAt(shooter, 10, 11);
    bot.route = [14];
    expect(botPick(state, bot, 13)).toBe(14);
  });

  it('se não há saída segura, mantém a rua', () => {
    setup({ ...CLASSIC, dodge: 1 });
    standAt(shooter, 10, 11);
    // No canto 14 (x=400,y=200) as únicas saídas são a linha de fogo (13) e as laterais 9 e 19; bloqueamos as laterais.
    state.bullets.push(
      { kind: 'street', a: 14, b: 9, d: 0, mv: 1, x: 400, y: 200, px: 400, py: 200, left: 200, life: 1, owner: shooter, tr: [] },
      { kind: 'street', a: 14, b: 19, d: 0, mv: 1, x: 400, y: 200, px: 400, py: 200, left: 200, life: 1, owner: shooter, tr: [] },
    );
    bot.route = [13];
    expect(botPick(state, bot, 14)).toBe(13);
  });
});

describe('defesa das bandeiras', () => {
  beforeEach(() => {
    setup({ ...CLASSIC, defend: 1 });
    shooter.cd = 5; // sem tiros nesse cenário
    bot.flags = [12, 13];
  });

  const enemyAt = (x: number, y: number, vx: number, vy: number) => Object.assign(shooter, { x, y, vx, vy });

  it('um inimigo vindo na direção de uma bandeira, perto, é ameaça', () => {
    enemyAt(400, 200, -100, 0);
    expect(chainThreat(state, bot)).toBe(shooter);
  });

  it('quem passa por perto indo embora não é ameaça', () => {
    enemyAt(400, 200, 100, 0);
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('um inimigo parado colado na bandeira é ameaça; parado mais longe, não', () => {
    enemyAt(340, 200, 0, 0);
    expect(chainThreat(state, bot)).toBe(shooter);
    enemyAt(400, 200, 0, 0);
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('só se defende cadeia com pelo menos 2 bandeiras', () => {
    enemyAt(340, 200, 0, 0);
    bot.flags = [13];
    expect(chainThreat(state, bot)).toBeNull();
  });

  it('o bot larga a rota e vai interceptar o inimigo', () => {
    enemyAt(400, 200, -100, 0);
    bot.route = [11, 10]; // rota que se afastaria dele
    expect(botPick(state, bot, 12)).toBe(13);
    expect(bot.route).toEqual([14]);
  });

  it('com defend = 0 não reage', () => {
    bot.persona = CLASSIC;
    enemyAt(400, 200, -100, 0);
    bot.route = [11, 10];
    expect(botPick(state, bot, 12)).toBe(11);
  });
});

describe('planejamento', () => {
  it('devolve um laço fechado de 3 a 5 bandeiras distintas', () => {
    for (const p of [CLASSIC, HUNTER, GREEDY]) {
      state = createGame(7, { personalities: personas(p) });
      const b = state.agents[1];
      const plan = planClaim(state, b, b.a);
      expect(plan).not.toBeNull();
      expect(plan![0]).toBe(plan!.at(-1));
      const distinct = new Set(plan);
      expect(distinct.size).toBeGreaterThanOrEqual(3);
      expect(distinct.size).toBeLessThanOrEqual(5);
    }
  });

  it('com peso de risco, prefere laços longe dos inimigos', () => {
    const meanDistToEnemy = (riskWeight: number): number => {
      setup({ ...CLASSIC, riskWeight }, gridSource(9));
      const enemy = state.agents[0];
      standAt(enemy, 36, 37); // nó 37: coluna 1, linha 4 → x=100, y=400
      standAt(bot, 39, 40); // nó 40: o centro
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 60; i++) {
        const plan = planClaim(state, bot, 40);
        if (!plan) continue;
        for (const f of plan) {
          const p = state.world.nodes[f];
          sum += Math.hypot(p.x - enemy.x, p.y - enemy.y);
          n++;
        }
      }
      return sum / n;
    };
    expect(meanDistToEnemy(5)).toBeGreaterThan(meanDistToEnemy(0) + 20);
  });
});

describe('líder do placar', () => {
  it('é null enquanto ninguém tem território e depois é quem mais tem', () => {
    state = createGame(2);
    expect(leader(state)).toBeNull();
    state.world.faces[0].owner = 2;
    expect(leader(state)).toBe(state.agents[2]);
  });
});

describe('personalidades', () => {
  afterEach(() => {
    CFG.botBrain = 'smart';
  });

  it('no modo smart cada bot tem a sua; no classic todos são clássicos', () => {
    state = createGame(1);
    expect(state.agents.slice(1).map((a) => a.persona.label)).toEqual(['caçador', 'cauteloso', 'guloso']);
    CFG.botBrain = 'classic';
    state = createGame(1);
    expect(state.agents.slice(1).every((a) => a.persona === CLASSIC)).toBe(true);
  });

  it('personalities explícitas ganham, e human:false torna o agente 0 um bot', () => {
    state = createGame(1, { human: false, personalities: [GREEDY, GREEDY, HUNTER, CLASSIC] });
    expect(state.agents[0].human).toBe(false);
    expect(state.agents.map((a) => a.persona)).toEqual([GREEDY, GREEDY, HUNTER, CLASSIC]);
    expect(createGame(1).agents[0].human).toBe(true);
  });
});
