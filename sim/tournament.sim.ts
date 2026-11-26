/**
 * Torneio de bots: roda muitas partidas só de bots (sem tela) e compara personalidades.
 * Serve pra medir se uma mudança nos bots realmente melhorou alguma coisa.
 *
 *   npm run sim                      # tudo, 60 sementes
 *   SEEDS=200 npm run sim            # mais partidas = menos ruído (no PowerShell: $env:SEEDS=200; npm run sim)
 *   SEED0=5000 npm run sim           # outras partidas, pra confirmar um resultado sem repetir a amostra
 *   ONLY=caçador npm run sim         # só os confrontos cujo nome contém o texto
 *
 * Como ler: a "base" é a vitória esperada se todos fossem iguais (50% numa dupla contra outra, 25% em quatro).
 * Diferenças de poucos pontos podem ser só sorte; aumente SEEDS pra confirmar.
 */
import { describe, it } from 'vitest';
import { CAUTIOUS, CFG, CLASSIC, GREEDY, HUNTER, type Config, type Personality } from '../src/config';
import { EVOLVED_A, EVOLVED_B, EVOLVED_MEAN, LEGACY_CAUTIOUS, LEGACY_GREEDY, LEGACY_HUNTER } from './champions';
import { env, playMatch, type SeatResult } from './lib';

const SEEDS = Number(env('SEEDS', '60'));
/** Primeira semente. Mude pra medir em partidas diferentes das de uma rodada anterior. */
const SEED0 = Number(env('SEED0', '1'));
const ONLY = env('ONLY', '');

class Tally {
  seats = 0;
  pct = 0;
  kills = 0;
  deaths = 0;
  wins = 0;
  add(r: SeatResult): void {
    this.seats++;
    this.pct += r.pct;
    this.kills += r.kills;
    this.deaths += r.deaths;
    this.wins += r.won ? 1 : 0;
  }
}

const out = (s: string) => console.log(s);
const f1 = (n: number) => n.toFixed(1);
const pad = (s: string, n: number) => s.padEnd(n);

/** Joga cada semente com cada disposição de cantos e imprime a tabela por personalidade e por canto. */
function runMatchup(title: string, patterns: Personality[][], cfg: Partial<Config> = {}): void {
  const saved = { ...CFG };
  Object.assign(CFG, cfg);
  try {
    runMatchupInner(title, patterns);
  } finally {
    Object.assign(CFG, saved);
  }
}

function runMatchupInner(title: string, patterns: Personality[][]): void {
  const byPersona = new Map<string, Tally>();
  const bySeat = [0, 1, 2, 3].map(() => new Tally());
  const players = patterns[0].length;
  let matches = 0;
  const started = Date.now();

  for (let seed = SEED0; seed < SEED0 + SEEDS; seed++) {
    for (const seats of patterns) {
      matches++;
      for (const r of playMatch(seed, seats)) {
        if (!byPersona.has(r.persona.label)) byPersona.set(r.persona.label, new Tally());
        byPersona.get(r.persona.label)!.add(r);
        bySeat[r.seat].add(r);
      }
    }
  }

  // Quantas vagas cada personalidade ocupa por partida (2 numa dupla, 1 em quatro diferentes).
  const slots = (label: string) => patterns[0].filter((p) => p.label === label).length;

  out(`\n=== ${title}  (${matches} partidas, ${((Date.now() - started) / 1000).toFixed(1)}s) ===`);
  out(`${pad('', 12)}${pad('vitórias', 11)}${pad('base', 7)}${pad('território', 12)}${pad('☠/partida', 11)}†/partida`);
  for (const [label, t] of byPersona) {
    const perMatch = t.seats / slots(label); // = número de partidas
    const winPct = (100 * t.wins) / perMatch;
    const base = (100 * slots(label)) / players;
    out(
      `${pad(label, 12)}${pad(f1(winPct) + '%', 11)}${pad(f1(base) + '%', 7)}${pad(f1(t.pct / t.seats) + '%', 12)}` +
        `${pad(f1(t.kills / t.seats), 11)}${f1(t.deaths / t.seats)}`,
    );
  }
  out(
    `cantos (território médio): ` +
      bySeat.map((t, i) => `#${i} ${f1(t.pct / t.seats)}% (vence ${f1((100 * t.wins) / t.seats)}%)`).join('  '),
  );
}

const C = CLASSIC;

/** Dois lados alternados (um canto bom não favorece ninguém): `p` contra o clássico. */
const duel = (p: Personality): Personality[][] => [
  [p, C, p, C],
  [C, p, C, p],
];

/** O clássico com UM comportamento novo ligado, pra medir o efeito de cada um isoladamente. */
const ablations: [name: string, tweak: Partial<Personality>, cfg?: Partial<Config>][] = [
  ['desvio de tiro', { dodge: 1 }],
  ['risco no planejamento', { riskWeight: 1 }],
  ['foco no líder', { leaderBias: 1, stealBonus: 1.5 }],
  ['perseguição longa', { chaseP: 0.3, chaseSteps: 4 }],
  ['defesa larga (alcance 220, 3 passos)', { defend: 1 }, { botDefendRange: 220, botInterceptSteps: 3 }],
  ['defesa enxuta (alcance 120, 2 passos)', { defend: 1 }],
  ['planejar com 40 tentativas', { planTries: 40 }],
  ['planejar com 80 tentativas', { planTries: 80 }],
  ['laços 30% maiores', { loopMul: 1.3 }],
  ['roubar mais (x1,8)', { stealBonus: 1.8 }],
];

const matchups: { title: string; patterns: Personality[][]; cfg?: Partial<Config> }[] = [
  { title: 'Sanidade: 4 clássicos', patterns: [[C, C, C, C]] },
  ...[HUNTER, CAUTIOUS, GREEDY].map((p) => ({ title: `${p.label} x clássico (2 contra 2)`, patterns: duel(p) })),
  {
    title: 'Todos contra todos (clássico, caçador, cauteloso, guloso)',
    patterns: [0, 1, 2, 3].map((r) => [C, HUNTER, CAUTIOUS, GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  // As personalidades atuais do jogo contra o melhor bot da versão anterior.
  ...[HUNTER, CAUTIOUS, GREEDY].map((p) => ({
    title: `novo x antigo: ${p.label} x guloso antigo`,
    patterns: [
      [p, LEGACY_GREEDY, p, LEGACY_GREEDY],
      [LEGACY_GREEDY, p, LEGACY_GREEDY, p],
    ],
  })),
  {
    title: 'novo x antigo: os três novos + guloso antigo',
    patterns: [0, 1, 2, 3].map((r) => [HUNTER, CAUTIOUS, GREEDY, LEGACY_GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  {
    title: 'novo x antigo: lineup novo contra lineup antigo',
    patterns: [0, 1].map((r) => [HUNTER, LEGACY_HUNTER, CAUTIOUS, LEGACY_CAUTIOUS].map((_, i, a) => a[(i + r) % 4])),
  },
  // Candidatos achados pela busca evolutiva: contra o clássico e contra o melhor bot atual (guloso).
  ...[EVOLVED_A, EVOLVED_B, EVOLVED_MEAN].flatMap((p) => [
    { title: `evoluído: ${p.label} x clássico`, patterns: duel(p) },
    { title: `evoluído: ${p.label} x guloso`, patterns: [[p, GREEDY, p, GREEDY], [GREEDY, p, GREEDY, p]] },
  ]),
  {
    title: 'evoluído: médio, caçador, cauteloso, guloso',
    patterns: [0, 1, 2, 3].map((r) => [EVOLVED_MEAN, HUNTER, CAUTIOUS, GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  ...ablations.map(([name, tweak, cfg]) => ({
    title: `ablação: ${name} x clássico`,
    patterns: duel({ ...CLASSIC, label: name, ...tweak }),
    cfg,
  })),
];

describe('torneio de bots', () => {
  for (const m of matchups) {
    it.skipIf(!m.title.includes(ONLY))(m.title, () => runMatchup(m.title, m.patterns, m.cfg), 3_600_000);
  }
});
