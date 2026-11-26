import type { Rng } from '../core/rng';
import type { Graph } from '../types';

/**
 * De onde vem o mapa. O resto do jogo só enxerga um `Graph` (cruzamentos e ruas),
 * então um gerador novo é só outro objeto assim.
 *
 * Requisitos do grafo devolvido: planar (ruas só se cruzam em nós), conexo,
 * e com cada nó ligado a pelo menos uma rua.
 */
export interface MapSource {
  id: string;
  label: string;
  build(rng: Rng): Graph;
}
