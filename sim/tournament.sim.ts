/**
 * Bot tournament: runs many bot-only matches (no screen) and compares personalities.
 * Used to measure whether a change to the bots actually improved anything.
 *
 *   npm run sim                      # everything, 60 seeds
 *   SEEDS=200 npm run sim            # more matches = less noise (in PowerShell: $env:SEEDS=200; npm run sim)
 *   SEED0=5000 npm run sim           # other matches, to confirm a result without repeating the sample
 *   ONLY=hunter npm run sim          # only the matchups whose name contains the text
 *
 * How to read it: the "base" is the expected win rate if everyone were equal (50% in a duel, 25% in a four-way fight).
 * Differences of a few points may just be luck; increase SEEDS to confirm.
 */
import { describe, it } from 'vitest';
import { CAUTIOUS, CFG, CLASSIC, GREEDY, HUNTER, type Config, type Personality } from '../src/config';
import { EVOLVED_A, EVOLVED_B, EVOLVED_MEAN, LEGACY_CAUTIOUS, LEGACY_GREEDY, LEGACY_HUNTER } from './champions';
import { env, playMatch, type SeatResult } from './lib';

const SEEDS = Number(env('SEEDS', '60'));
/** First seed. Change it to measure on matches different from a previous run. */
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

/** Plays each seed with each corner arrangement and prints the table per personality and per corner. */
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

  // How many slots each personality occupies per match (2 in a duel, 1 in four different ones).
  const slots = (label: string) => patterns[0].filter((p) => p.label === label).length;

  out(`\n=== ${title}  (${matches} matches, ${((Date.now() - started) / 1000).toFixed(1)}s) ===`);
  out(`${pad('', 12)}${pad('wins', 11)}${pad('base', 7)}${pad('territory', 12)}${pad('☠/match', 11)}†/match`);
  for (const [label, t] of byPersona) {
    const perMatch = t.seats / slots(label); // = number of matches
    const winPct = (100 * t.wins) / perMatch;
    const base = (100 * slots(label)) / players;
    out(
      `${pad(label, 12)}${pad(f1(winPct) + '%', 11)}${pad(f1(base) + '%', 7)}${pad(f1(t.pct / t.seats) + '%', 12)}` +
        `${pad(f1(t.kills / t.seats), 11)}${f1(t.deaths / t.seats)}`,
    );
  }
  out(
    `corners (avg territory): ` +
      bySeat.map((t, i) => `#${i} ${f1(t.pct / t.seats)}% (wins ${f1((100 * t.wins) / t.seats)}%)`).join('  '),
  );
}

const C = CLASSIC;

/** Two sides alternated (a good corner doesn't favor anyone): `p` against the classic. */
const duel = (p: Personality): Personality[][] => [
  [p, C, p, C],
  [C, p, C, p],
];

/** The classic with ONE new behavior turned on, to measure the effect of each one in isolation. */
const ablations: [name: string, tweak: Partial<Personality>, cfg?: Partial<Config>][] = [
  ['shot dodging', { dodge: 1 }],
  ['risk in planning', { riskWeight: 1 }],
  ['focus on the leader', { leaderBias: 1, stealBonus: 1.5 }],
  ['long chase', { chaseP: 0.3, chaseSteps: 4 }],
  ['wide defense (range 220, 3 steps)', { defend: 1 }, { botDefendRange: 220, botInterceptSteps: 3 }],
  ['lean defense (range 120, 2 steps)', { defend: 1 }],
  ['planning with 40 attempts', { planTries: 40 }],
  ['planning with 80 attempts', { planTries: 80 }],
  ['loops 30% larger', { loopMul: 1.3 }],
  ['stealing more (x1.8)', { stealBonus: 1.8 }],
];

const matchups: { title: string; patterns: Personality[][]; cfg?: Partial<Config> }[] = [
  { title: 'Sanity: 4 classics', patterns: [[C, C, C, C]] },
  ...[HUNTER, CAUTIOUS, GREEDY].map((p) => ({ title: `${p.label} vs classic (2 vs 2)`, patterns: duel(p) })),
  {
    title: 'Everyone vs everyone (classic, hunter, cautious, greedy)',
    patterns: [0, 1, 2, 3].map((r) => [C, HUNTER, CAUTIOUS, GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  // The current game personalities against the best bot of the previous version.
  ...[HUNTER, CAUTIOUS, GREEDY].map((p) => ({
    title: `new vs old: ${p.label} vs old greedy`,
    patterns: [
      [p, LEGACY_GREEDY, p, LEGACY_GREEDY],
      [LEGACY_GREEDY, p, LEGACY_GREEDY, p],
    ],
  })),
  {
    title: 'new vs old: the three new + old greedy',
    patterns: [0, 1, 2, 3].map((r) => [HUNTER, CAUTIOUS, GREEDY, LEGACY_GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  {
    title: 'new vs old: new lineup vs old lineup',
    patterns: [0, 1].map((r) => [HUNTER, LEGACY_HUNTER, CAUTIOUS, LEGACY_CAUTIOUS].map((_, i, a) => a[(i + r) % 4])),
  },
  // Candidates found by the evolutionary search: against the classic and against the current best bot (greedy).
  ...[EVOLVED_A, EVOLVED_B, EVOLVED_MEAN].flatMap((p) => [
    { title: `evolved: ${p.label} vs classic`, patterns: duel(p) },
    { title: `evolved: ${p.label} vs greedy`, patterns: [[p, GREEDY, p, GREEDY], [GREEDY, p, GREEDY, p]] },
  ]),
  {
    title: 'evolved: mean, hunter, cautious, greedy',
    patterns: [0, 1, 2, 3].map((r) => [EVOLVED_MEAN, HUNTER, CAUTIOUS, GREEDY].map((_, i, a) => a[(i + r) % 4])),
  },
  ...ablations.map(([name, tweak, cfg]) => ({
    title: `ablation: ${name} vs classic`,
    patterns: duel({ ...CLASSIC, label: name, ...tweak }),
    cfg,
  })),
];

describe('bot tournament', () => {
  for (const m of matchups) {
    it.skipIf(!m.title.includes(ONLY))(m.title, () => runMatchup(m.title, m.patterns, m.cfg), 3_600_000);
  }
});
