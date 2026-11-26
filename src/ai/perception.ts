/**
 * O que um bot "enxerga" sobre perigo: por onde um tiro poderia vir e quem está
 * ameaçando as suas bandeiras. Só leitura, nada aqui muda o estado do jogo.
 */
import { CFG } from '../config';
import { tracePath, traceShot } from '../entities/bullets';
import { edgeLength } from '../map/graph';
import type { Agent, GameState, Vec, World } from '../types';

/** Uma linha de fogo: a sequência de pontos que um tiro percorreria. */
export type FireLine = Vec[];

/** Um inimigo com a recarga acabando é tratado como "prestes a atirar". */
const READY_WINDOW = 0.45;
/** Distância de uma linha de fogo a partir da qual um ponto é considerado atingível. */
const DANGER_RADIUS = CFG.hitR * 1.6;
/**
 * Ao testar uma rua saindo de um nó, só olhamos de `EDGE_SKIP` a `EDGE_LOOKAHEAD` pixels adiante.
 * O começo é ignorado porque, parado num cruzamento em cima da linha de fogo, toda rua
 * parece perigosa nos primeiros pixels, inclusive a lateral que é a saída.
 */
const EDGE_SKIP = 30;
const EDGE_LOOKAHEAD = 120;
const EDGE_STEP = 12;
/**
 * Quantas amostras do trecho precisam cair na linha de fogo pra rua contar como perigosa.
 * Atravessar a linha de lado toca 1 ou 2 amostras e dá tempo de sair antes do tiro chegar;
 * o perigo de verdade é andar ao longo dela.
 */
const EDGE_MIN_HITS = 4;

/**
 * Linhas de fogo que poderiam atingir `bot` em breve: o tiro que cada inimigo pronto
 * soltaria agora e o trajeto restante dos tiros que já estão voando.
 * Só no modo 'street'; no 'free' os tiros são retos e não seguem as ruas, então devolve vazio.
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

/** O ponto está perto o bastante de alguma linha de fogo pra ser acertado? */
export function inFire(p: Vec, lines: FireLine[]): boolean {
  for (const line of lines) {
    for (const q of line) if (Math.hypot(q.x - p.x, q.y - p.y) < DANGER_RADIUS) return true;
  }
  return false;
}

/** Andar de `from` até `to` seguiria por dentro de alguma linha de fogo (e não só a cruzaria)? */
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

/** Só vale defender uma cadeia com pelo menos isso de bandeiras fincadas (senão há pouco a perder). */
const DEFEND_MIN_FLAGS = 2;
/** Um inimigo parado a menos que isso (px) de uma bandeira já é ameaça, mesmo sem estar se aproximando. */
const TOUCH_RANGE = 60;
/** Cosseno mínimo entre a velocidade do inimigo e a direção da bandeira pra contar como "vindo pra cá". */
const APPROACH_COS = 0.5;
/** Abaixo disso (px/s) o inimigo é considerado parado. */
const MOVING_SPEED = 20;

/**
 * Um inimigo vivo que está realmente indo destruir uma bandeira do bot: a menos de
 * `CFG.botDefendRange` dela e **vindo na direção dela** (ou já colado). Quem só passa
 * por perto não conta, senão o bot largaria o plano a toda hora. Chegar a uma bandeira
 * destrói a cadeia inteira, então só se defende quando há cadeia suficiente pra perder.
 * @returns o inimigo mais próximo de uma bandeira entre os que ameaçam, ou `null`.
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
