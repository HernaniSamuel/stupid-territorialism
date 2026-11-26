/**
 * What a bot "sees" about danger: where a shot could come from and who
 * is threatening its flags. Read-only: nothing here changes the game state.
 */
import { CFG } from '../config';
import { tracePath, traceShot } from '../entities/bullets';
import { edgeLength } from '../map/graph';
import type { Agent, GameState, Vec, World } from '../types';

/** A line of fire: the sequence of points a shot would travel. */
export type FireLine = Vec[];

/** An enemy with its reload nearly done is treated as "about to shoot". */
const READY_WINDOW = 0.45;
/** Distance from a line of fire within which a point is considered hittable. */
const DANGER_RADIUS = CFG.hitR * 1.6;
/**
 * When testing a street leaving a node, we only look from `EDGE_SKIP` to `EDGE_LOOKAHEAD` pixels ahead.
 * The start is ignored because, standing at an intersection on top of the line of fire, every street
 * looks dangerous in its first pixels, including the side exit.
 */
const EDGE_SKIP = 30;
const EDGE_LOOKAHEAD = 120;
const EDGE_STEP = 12;
/**
 * How many samples of the stretch must fall on the line of fire for the street to count as dangerous.
 * Crossing the line sideways touches 1 or 2 samples and leaves time to get out before the shot arrives;
 * the real danger is walking along it.
 */
const EDGE_MIN_HITS = 4;

/**
 * Lines of fire that could hit `bot` soon: the shot each ready enemy
 * would fire now and the remaining path of the shots already in flight.
 * Only in 'street' mode; in 'free' the shots are straight and don't follow the streets, so it returns empty.
 */
export function incomingFire(state: GameState, bot: Agent): FireLine[] {
  if (CFG.shotMode !== 'street') return [];
  const { world } = state;
  const lines: FireLine[] = [];
  for (const o of state.agents) {
    if (o !== bot && o.alive && o.cd <= READY_WINDOW) lines.push(traceShot(world, o));
  }
  for (const b of state.bullets) {
    if (b.kind === 'street' && b.owner !== bot) lines.push(tracePath(world, b, b.left));
  }
  return lines;
}

/** Is the point close enough to some line of fire to be hit? */
export function inFire(p: Vec, lines: FireLine[]): boolean {
  for (const line of lines) {
    for (const q of line) if (Math.hypot(q.x - p.x, q.y - p.y) < DANGER_RADIUS) return true;
  }
  return false;
}

/** Would walking from `from` to `to` run inside some line of fire (and not just cross it)? */
export function edgeExposed(world: World, from: number, to: number, lines: FireLine[]): boolean {
  const A = world.nodes[from];
  const B = world.nodes[to];
  const len = edgeLength(world, from, to);
  if (!len) return false;
  let hits = 0;
  for (let d = EDGE_SKIP; d <= Math.min(len, EDGE_LOOKAHEAD); d += EDGE_STEP) {
    const t = d / len;
    if (inFire({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }, lines) && ++hits >= EDGE_MIN_HITS) return true;
  }
  return false;
}

/** It's only worth defending a chain with at least this many planted flags (otherwise there is little to lose). */
const DEFEND_MIN_FLAGS = 2;
/** An enemy standing still less than this (px) from a flag is already a threat, even without approaching. */
const TOUCH_RANGE = 60;
/** Minimum cosine between the enemy's velocity and the direction of the flag to count as "coming this way". */
const APPROACH_COS = 0.5;
/** Below this (px/s) the enemy is considered standing still. */
const MOVING_SPEED = 20;

/**
 * A living enemy that is actually about to destroy one of the bot's flags: within
 * `CFG.botDefendRange` of it and **coming toward it** (or already stuck to it). Someone who merely
 * passes nearby doesn't count, otherwise the bot would drop its plan all the time. Reaching a flag
 * destroys the entire chain, so it only defends when there is enough chain to lose.
 * @returns the enemy closest to a flag among those that threaten, or `null`.
 */
export function chainThreat(state: GameState, bot: Agent): Agent | null {
  if (bot.flags.length < DEFEND_MIN_FLAGS) return null;
  let threat: Agent | null = null;
  let best = CFG.botDefendRange;
  for (const o of state.agents) {
    if (o === bot || !o.alive) continue;
    const speed = Math.hypot(o.vx, o.vy);
    for (const f of bot.flags) {
      const n = state.world.nodes[f];
      const dx = n.x - o.x;
      const dy = n.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d >= best) continue;
      const approaching = speed > MOVING_SPEED && (o.vx * dx + o.vy * dy) / (d * speed || 1) > APPROACH_COS;
      if (d < TOUCH_RANGE || approaching) {
        best = d;
        threat = o;
      }
    }
  }
  return threat;
}
