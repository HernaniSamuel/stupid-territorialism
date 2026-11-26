import type { Rng } from '../core/rng';
import type { Graph } from '../types';

/**
 * Where the map comes from. The rest of the game only sees a `Graph` (intersections and streets),
 * so a new generator is just another object like this.
 *
 * Requirements for the returned graph: planar (streets only cross at nodes), connected,
 * and with every node connected to at least one street.
 */
export interface MapSource {
  id: string;
  label: string;
  build(rng: Rng): Graph;
}
