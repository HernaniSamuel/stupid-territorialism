/**
 * Busca evolutiva dos parâmetros de uma personalidade de bot.
 *
 *   npm run evolve                       # 25 gerações a partir do guloso (~15 min)
 *   START=classic GENS=40 npm run evolve # outro ponto de partida / mais gerações
 *
 * Como funciona (uma Estratégia Evolutiva simples):
 *  1. O "centro" é o vetor de parâmetros atual. Cada geração sorteia POP variações em volta dele (ruído gaussiano
 *     de tamanho σ, que encolhe com o tempo).
 *  2. Cada variação joga partidas de 4 contra os bots de referência (clássico, caçador, cauteloso, guloso),
 *     alternando o canto, e é pontuada pelo território médio que conquista.
 *  3. As melhores viram o novo centro (média delas).
 *
 * Contra o ruído e o "decorar as sementes":
 *  - Todos os candidatos de uma geração jogam nas MESMAS sementes (a diferença entre eles é menos ruidosa).
 *  - As sementes mudam a cada geração, e o resultado final é medido em sementes que o treino nunca viu.
 */
import { describe, it } from 'vitest';
import { CAUTIOUS, CLASSIC, GREEDY, HUNTER, type Personality } from '../src/config';
import { createRng } from '../src/core/rng';
import { env, playMatch } from './lib';

interface Gene {
  key: Exclude<keyof Personality, 'label'>;
  min: number;
  max: number;
  int?: boolean;
}

/** O que a evolução pode mexer, com os limites permitidos (planTries tem teto porque custa processamento). */
const GENES: Gene[] = [
  { key: 'loopMul', min: 0.5, max: 2 },
  { key: 'planTries', min: 14, max: 60, int: true },
  { key: 'riskWeight', min: 0, max: 3 },
  { key: 'stealBonus', min: 1, max: 2 },
  { key: 'leaderBias', min: 0, max: 2 },
  { key: 'huntFlagP', min: 0, max: 0.6 },
  { key: 'chaseP', min: 0, max: 0.3 },
  { key: 'chaseSteps', min: 1, max: 5, int: true },
  { key: 'dodge', min: 0, max: 1 },
  { key: 'defend', min: 0, max: 1 },
];

const GENS = Number(env('GENS', '25'));
const POP = Number(env('POP', '12'));
const TRAIN_SEEDS = Number(env('TRAIN_SEEDS', '4')); // cada semente joga com os 4 cantos
const SIGMA0 = Number(env('SIGMA0', '0.25'));
const SIGMA_END = 0.06;
const EVO_SEED = Number(env('EVO_SEED', '1'));
const FINAL_SEEDS = Number(env('FINAL_SEEDS', '40'));
const FINAL_SEED0 = 50000; // longe das sementes de treino (200000+) e das de rodadas anteriores
const START = env('START', 'greedy');

const STARTS: Record<string, Personality> = { classic: CLASSIC, hunter: HUNTER, cautious: CAUTIOUS, greedy: GREEDY };
const POOL = [CLASSIC, HUNTER, CAUTIOUS, GREEDY];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function decode(x: number[], label: string): Personality {
  const p: Personality = { ...CLASSIC, label };
  GENES.forEach((g, i) => {
    const v = g.min + clamp01(x[i]) * (g.max - g.min);
    p[g.key] = g.int ? Math.round(v) : v;
  });
  return p;
}

const encode = (p: Personality): number[] => GENES.map((g) => clamp01((p[g.key] - g.min) / (g.max - g.min)));

const fmt = (p: Personality) =>
  GENES.map((g) => `${g.key}=${g.int ? p[g.key] : p[g.key].toFixed(2)}`).join(' ');

interface Fit {
  share: number;
  win: number;
  kills: number;
  deaths: number;
}

/**
 * Joga `p` contra três dos quatro bots de referência (o que fica de fora gira a cada semente),
 * em cada um dos 4 cantos, e devolve as médias.
 */
function evaluate(p: Personality, seeds: number[]): Fit {
  const sum = { share: 0, win: 0, kills: 0, deaths: 0 };
  let n = 0;
  seeds.forEach((seed, si) => {
    const opponents = POOL.filter((_, i) => i !== si % POOL.length);
    for (let seat = 0; seat < 4; seat++) {
      let k = 0;
      const seats = [0, 1, 2, 3].map((i) => (i === seat ? p : opponents[k++]));
      const r = playMatch(seed, seats)[seat];
      sum.share += r.pct;
      sum.win += r.won ? 1 : 0;
      sum.kills += r.kills;
      sum.deaths += r.deaths;
      n++;
    }
  });
  return { share: sum.share / n, win: (100 * sum.win) / n, kills: sum.kills / n, deaths: sum.deaths / n };
}

/** Quatro personalidades disputando juntas, girando os cantos. Devolve vitória% e território médio de cada uma. */
function ffa(lineup: Personality[], seeds: number[]): Map<string, { win: number; share: number }> {
  const acc = new Map<string, { win: number; share: number; n: number }>();
  for (const seed of seeds) {
    for (let r = 0; r < 4; r++) {
      const seats = lineup.map((_, i, a) => a[(i + r) % 4]);
      for (const res of playMatch(seed, seats)) {
        const t = acc.get(res.persona.label) ?? { win: 0, share: 0, n: 0 };
        t.win += res.won ? 1 : 0;
        t.share += res.pct;
        t.n++;
        acc.set(res.persona.label, t);
      }
    }
  }
  return new Map([...acc].map(([k, t]) => [k, { win: (100 * t.win) / t.n, share: t.share / t.n }]));
}

describe('evolução de personalidade', () => {
  it(`evolui a partir de "${START}" por ${GENS} gerações`, () => {
    const start = STARTS[START];
    if (!start) throw new Error(`START inválido: ${START}. Use ${Object.keys(STARTS).join(', ')}.`);

    const rng = createRng(EVO_SEED);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
    const mu = Math.max(2, Math.floor(POP / 3));
    const decay = Math.pow(SIGMA_END / SIGMA0, 1 / Math.max(1, GENS - 1));

    let center = encode(start);
    let sigma = SIGMA0;
    const t0 = Date.now();
    console.log(`\nInício: ${START}\n  ${fmt(start)}\n  (${POP} variações/geração, ${TRAIN_SEEDS * 4} partidas por candidato)`);

    for (let gen = 0; gen < GENS; gen++) {
      const seeds = Array.from({ length: TRAIN_SEEDS }, (_, i) => 200000 + gen * TRAIN_SEEDS + i);
      const candidates = [
        center.slice(), // o próprio centro, pra saber como ele anda nas sementes desta geração
        ...Array.from({ length: POP }, () => center.map((v) => clamp01(v + sigma * gauss()))),
      ].map((x) => ({ x, fit: evaluate(decode(x, 'candidato'), seeds) }));

      const ranked = [...candidates].sort((a, b) => b.fit.share - a.fit.share);
      console.log(
        `ger ${String(gen + 1).padStart(2)}  σ=${sigma.toFixed(3)}  centro ${candidates[0].fit.share.toFixed(1)}%  ` +
          `melhor ${ranked[0].fit.share.toFixed(1)}%  média ${(candidates.reduce((s, c) => s + c.fit.share, 0) / candidates.length).toFixed(1)}%  ` +
          `(${((Date.now() - t0) / 1000).toFixed(0)}s)`,
      );

      const top = ranked.slice(0, mu);
      center = center.map((_, j) => top.reduce((s, c) => s + c.x[j], 0) / top.length);
      sigma *= decay;
      if ((gen + 1) % 5 === 0) console.log(`  centro: ${fmt(decode(center, 'x'))}`);
    }

    const champion = decode(center, 'campeão');
    console.log(`\nCampeão:\n  ${fmt(champion)}`);

    // Avaliação final em sementes que o treino nunca viu.
    const fresh = Array.from({ length: FINAL_SEEDS }, (_, i) => FINAL_SEED0 + i);
    console.log(`\n=== Avaliação em ${FINAL_SEEDS * 4} partidas inéditas (cada um contra 3 dos 4 bots de referência) ===`);
    console.log('                território   vitórias   ☠/partida  †/partida');
    for (const p of [champion, ...POOL]) {
      const f = evaluate(p, fresh);
      console.log(
        `${p.label.padEnd(14)}  ${f.share.toFixed(1).padStart(5)}%      ${f.win.toFixed(1).padStart(5)}%     ${f.kills.toFixed(1).padStart(5)}      ${f.deaths.toFixed(1).padStart(5)}`,
      );
    }

    console.log('\n=== Os quatro disputando juntos: campeão, caçador, cauteloso, guloso (base 25%) ===');
    const table = ffa([champion, HUNTER, CAUTIOUS, GREEDY], fresh);
    for (const [label, t] of table) console.log(`${label.padEnd(14)}  vitórias ${t.win.toFixed(1)}%   território ${t.share.toFixed(1)}%`);
  }, 7_200_000);
});
