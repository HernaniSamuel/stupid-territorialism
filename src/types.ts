/**
 * Shared types. Only data here: no functions, no dependencies.
 *
 * Important convention: a "node" is an intersection and is always referred to by its
 * INDEX in `World.nodes`. A "face" is a city block, referred to by its index in
 * `World.faces`. Both are `number`, so be careful not to mix them up.
 */
import type { Personality } from './config';
import type { Rng } from './core/rng';

export interface Vec {
  x: number;
  y: number;
}

/** Intersection (or street end). Called `GNode` so it doesn't clash with the DOM's `Node`. */
export type GNode = Vec;

/** Street between two nodes, by index. */
export type Edge = [a: number, b: number];

/** Output of a map source: only the street geometry. */
export interface Graph {
  nodes: GNode[];
  edges: Edge[];
}

/** Street leaving a node. */
export interface Neighbor {
  /** Node on the other side. */
  to: number;
  len: number;
  /** Angle of the street leaving the node, in radians. The lists are sorted by it. */
  ang: number;
}

/** City block: a region enclosed by streets. */
export interface Face {
  /** Nodes of the outline, in order. */
  loop: number[];
  /** Same points as `loop`, for drawing. */
  pts: GNode[];
  area: number;
  /** Point just inside the block, used to test whether a loop contains it. */
  probe: Vec;
  /** Id of the owning agent, or -1. */
  owner: number;
  /** 0..1, recent capture glow (visual only). */
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
  /** Previous node on the shortest path from the source, or -1. */
  prev: Int32Array;
}

/** The map, ready to play: street graph + blocks + caches. */
export interface World {
  nodes: GNode[];
  edges: Edge[];
  adj: Neighbor[][];
  faces: Face[];
  /** Half-edge (a→b, key `a*N+b`) → index of the face on its left. */
  halfEdgeFace: Map<number, number>;
  totalArea: number;
  bounds: Bounds;
  /** Cache of shortest paths per source node. */
  paths: Map<number, ShortestPaths>;
}

/** -1: moving from `b` to `a`; 0: stopped; 1: moving from `a` to `b`. */
export type Dir = -1 | 0 | 1;

/** Something that walks along a street: from `a` to `b`, `d` pixels from `a`. */
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
  /** Way of playing (only bots use it; ignored for the human). */
  persona: Personality;
  /** Initial spawn node. */
  base: number;
  vx: number;
  vy: number;
  /** Drawing angle (smoothed). */
  ang: number;
  alive: boolean;
  respawnT: number;
  /** Remaining invulnerability. */
  invT: number;
  /** Remaining shot reload. */
  cd: number;
  kills: number;
  deaths: number;
  /** Nodes with a flag, in the order they were planted. */
  flags: number[];
  /** (bots) nodes to walk through until the immediate destination. */
  route: number[];
  /** (bots) flags to plant, ending at the first one to close the loop. */
  plan: number[];
  /** Last movement direction (1 or -1); sets where the shot goes out. */
  face: 1 | -1;
}

export interface StreetBullet extends Walker {
  kind: 'street';
  /** Position in the previous step (for segment collision). */
  px: number;
  py: number;
  /** Remaining distance. */
  left: number;
  life: number;
  owner: Agent;
  /** Recent trail, for drawing. */
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
 * Facts that happened in the simulation. The simulation only publishes them to
 * `GameState.events`; the UI layer decides what to do (sound, on-screen message).
 */
export type GameEvent =
  | { type: 'shot'; agent: Agent }
  | { type: 'plant'; agent: Agent }
  | { type: 'plantRejected'; agent: Agent; reason: 'duplicate' | 'maxFlags' }
  /** The agent reached 3 flags: the loop can be closed now. */
  | { type: 'loopReady'; agent: Agent }
  /** Closed loop that yielded territory. `pct` = % of the map gained. */
  | { type: 'claim'; agent: Agent; pct: number }
  | { type: 'claimEmpty'; agent: Agent }
  | { type: 'chainDestroyed'; owner: Agent; by: Agent }
  | { type: 'kill'; victim: Agent; killer: Agent }
  | { type: 'matchEnd' };

/** What the human player is asking for this frame. */
export interface PlayerCommand {
  /** Desired direction, normalized (or 0,0). */
  dir: Vec;
  fire: boolean;
  /** World point being aimed at (only matters in 'free' mode). */
  aim: Vec;
}

export interface GameState {
  seed: number;
  rng: Rng;
  world: World;
  agents: Agent[];
  /** The human agent (always `agents[0]`). */
  player: Agent;
  bullets: Bullet[];
  particles: Particle[];
  timeLeft: number;
  over: boolean;
  /** Queue of events not yet consumed by the UI. */
  events: GameEvent[];
}
